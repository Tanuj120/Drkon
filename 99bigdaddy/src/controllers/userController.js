import connection from "../config/connectDB.js";
import jwt from 'jsonwebtoken'
import md5 from "md5";
import request from 'request';

import axios from 'axios';
let timeNow = Date.now();

const FIXED_DEPOSIT_PLANS = [
    { days: 10, dailyRate: 0.50 },
    { days: 30, dailyRate: 1.11 },
    { days: 90, dailyRate: 2.22 },
];
const COPY_GAMING_AMOUNT_STEP = 500;
const MINIMUM_DEPOSIT_AMOUNT = 500;
const MINIMUM_WITHDRAW_AMOUNT = 1000;
const DAY_IN_MS = 86400000;
const LEVEL_INCOME_PERCENTAGES = [5, 3, 2, 1, 1, 1, 1, 1];
const LEVEL_INCOME_PACKAGE_DAYS = 90;

const formatMoney = (value) => Number(Number(value || 0).toFixed(2));

const getFixedDepositPlan = (days) => {
    return FIXED_DEPOSIT_PLANS.find((plan) => Number(plan.days) === Number(days));
}

const calculateCopyGamingValues = (source = {}) => {
    const amount = formatMoney(source.amount);
    const storedTenureDays = Number(source.tenure_days ?? source.tenureDays ?? source.days ?? 0);
    const plan = getFixedDepositPlan(storedTenureDays);
    const tenureDays = Number(plan?.days || storedTenureDays || 0);
    const dailyRate = formatMoney(plan?.dailyRate ?? source.daily_rate ?? source.dailyRate ?? 0);
    const startTime = Number(source.start_time ?? source.startTime ?? source.created_at ?? source.createdAt ?? 0);
    const storedMaturityTime = Number(source.maturity_time ?? source.maturityTime ?? 0);
    const maturityTime = startTime && tenureDays ? startTime + (tenureDays * DAY_IN_MS) : storedMaturityTime;
    const totalInterest = formatMoney((amount * dailyRate * tenureDays) / 100);
    const maturityAmount = formatMoney(amount + totalInterest);

    return {
        amount,
        tenureDays,
        dailyRate,
        totalInterest,
        maturityAmount,
        startTime,
        maturityTime,
    };
}

const ensureFixedDepositsTable = async () => {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS fixed_deposits (
            id INT NOT NULL AUTO_INCREMENT,
            phone VARCHAR(20) NOT NULL,
            amount DECIMAL(20,2) NOT NULL DEFAULT 0,
            tenure_days INT NOT NULL,
            daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_interest DECIMAL(20,2) NOT NULL DEFAULT 0,
            maturity_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            start_time BIGINT NOT NULL DEFAULT 0,
            maturity_time BIGINT NOT NULL DEFAULT 0,
            withdrawn_time BIGINT NOT NULL DEFAULT 0,
            created_at BIGINT NOT NULL DEFAULT 0,
            referral_transaction_id VARCHAR(100) DEFAULT NULL,
            referral_processed TINYINT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_fixed_deposits_phone_status (phone, status),
            KEY idx_fixed_deposits_maturity (maturity_time)
        )
    `);
    await addColumnIfMissing('fixed_deposits', 'referral_transaction_id', 'ALTER TABLE fixed_deposits ADD COLUMN referral_transaction_id VARCHAR(100) DEFAULT NULL');
    await addColumnIfMissing('fixed_deposits', 'referral_processed', 'ALTER TABLE fixed_deposits ADD COLUMN referral_processed TINYINT NOT NULL DEFAULT 0');
}

const addColumnIfMissing = async (tableName, columnName, sql) => {
    try {
        const [rows] = await connection.query(
            'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [tableName, columnName]
        );
        if (Number(rows?.[0]?.count || 0) > 0) return;
        await connection.execute(sql);
    } catch (error) {
        if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
    }
}

const ensureReferralLevelIncomeTable = async () => {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS referral_level_income (
            id INT NOT NULL AUTO_INCREMENT,
            transaction_id VARCHAR(100) NOT NULL,
            fixed_deposit_id INT NOT NULL,
            from_phone VARCHAR(20) NOT NULL,
            from_code VARCHAR(64) DEFAULT NULL,
            to_phone VARCHAR(20) NOT NULL,
            to_code VARCHAR(64) DEFAULT NULL,
            level_no INT NOT NULL,
            percentage DECIMAL(10,2) NOT NULL DEFAULT 0,
            package_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
            income_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'credited',
            created_at BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY uq_referral_level_transaction (transaction_id, level_no),
            KEY idx_referral_level_to_phone (to_phone),
            KEY idx_referral_level_from_phone (from_phone),
            KEY idx_referral_level_deposit (fixed_deposit_id)
        )
    `);
}

const ensureCopyGamingReferralSchema = async () => {
    await ensureFixedDepositsTable();
    await ensureReferralLevelIncomeTable();
}

const getTransactionClient = async () => {
    const skipDb = (process.env.SKIP_DB || '').toString().trim().toLowerCase() === 'true';
    if (skipDb || typeof connection.getConnection !== 'function') {
        return {
            db: connection,
            begin: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        };
    }

    const db = await connection.getConnection();
    return {
        db,
        begin: () => db.beginTransaction(),
        commit: () => db.commit(),
        rollback: () => db.rollback(),
        release: () => db.release(),
    };
}

const distributeCopyGamingLevelIncome = async (db, { buyer, amount, fixedDepositId, transactionId }) => {
    const credited = [];
    const [existingRows] = await db.query(
        'SELECT COUNT(*) AS count FROM referral_level_income WHERE transaction_id = ?',
        [transactionId]
    );
    if (Number(existingRows?.[0]?.count || 0) > 0) {
        return credited;
    }

    let referralCode = String(buyer.invite || '').trim();
    const buyerCode = String(buyer.code || '').trim();
    const visitedCodes = new Set([buyerCode].filter(Boolean));
    const visitedPhones = new Set([String(buyer.phone || '')].filter(Boolean));

    for (let index = 0; index < LEVEL_INCOME_PERCENTAGES.length; index++) {
        if (!referralCode || visitedCodes.has(referralCode)) break;

        const [referrerRows] = await db.query(
            'SELECT phone, code, invite, status, veri FROM users WHERE code = ? LIMIT 1',
            [referralCode]
        );
        const referrer = referrerRows?.[0];
        if (!referrer) break;

        const referrerPhone = String(referrer.phone || '');
        const referrerCode = String(referrer.code || '').trim();
        if (!referrerPhone || !referrerCode || visitedPhones.has(referrerPhone) || referrerPhone === buyer.phone || referrerCode === buyerCode) {
            break;
        }

        visitedPhones.add(referrerPhone);
        visitedCodes.add(referrerCode);

        const isActiveUser = Number(referrer.status) === 1 && Number(referrer.veri) === 1;
        if (isActiveUser) {
            const levelNo = index + 1;
            const percentage = LEVEL_INCOME_PERCENTAGES[index];
            const incomeAmount = formatMoney((amount * percentage) / 100);
            if (incomeAmount > 0) {
                const [insertResult] = await db.execute(
                    `INSERT IGNORE INTO referral_level_income
                    (transaction_id, fixed_deposit_id, from_phone, from_code, to_phone, to_code, level_no, percentage, package_amount, income_amount, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [transactionId, fixedDepositId, buyer.phone, buyerCode, referrerPhone, referrerCode, levelNo, percentage, amount, incomeAmount, 'credited', Date.now()]
                );

                if (insertResult.affectedRows > 0) {
                    const directIncome = levelNo === 1 ? incomeAmount : 0;
                    await db.execute(
                        'UPDATE users SET money = money + ?, roses_f = roses_f + ?, roses_f1 = roses_f1 + ?, roses_today = roses_today + ? WHERE phone = ? AND status = 1 AND veri = 1',
                        [incomeAmount, incomeAmount, directIncome, incomeAmount, referrerPhone]
                    );
                    credited.push({ level: levelNo, phone: referrerPhone, amount: incomeAmount, percentage });
                }
            }
        }

        referralCode = String(referrer.invite || '').trim();
    }

    return credited;
}

const getUserByAuth = async (auth) => {
    const [userRows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);
    if (!userRows || userRows.length === 0) {
        return null;
    }
    return userRows[0];
}

const getFixedDepositRows = async (phone) => {
    await ensureFixedDepositsTable();
    const [rows] = await connection.query(
        'SELECT * FROM fixed_deposits WHERE phone = ? ORDER BY created_at DESC, id DESC',
        [phone]
    );
    return rows || [];
}

const buildFixedDepositSummary = (rows = []) => {
    const now = Date.now();
    const active = [];
    const history = [];
    let lockedAmount = 0;
    let projectedInterest = 0;
    let projectedMaturityAmount = 0;
    let withdrawableAmount = 0;

    rows.forEach((row) => {
        const {
            amount,
            tenureDays,
            dailyRate,
            totalInterest,
            maturityAmount,
            startTime,
            maturityTime,
        } = calculateCopyGamingValues(row);
        const elapsedDays = Math.max(0, Math.floor((Math.min(now, maturityTime) - startTime) / DAY_IN_MS));
        const earnedInterest = formatMoney((amount * dailyRate * Math.min(elapsedDays, tenureDays)) / 100);
        const status = row.status === 'withdrawn' ? 'withdrawn' : (maturityTime <= now ? 'matured' : 'active');

        const normalized = {
            id: row.id,
            amount,
            tenureDays,
            dailyRate,
            totalInterest,
            maturityAmount,
            startTime,
            maturityTime,
            withdrawnTime: Number(row.withdrawn_time || 0),
            earnedInterest,
            status
        };

        history.push(normalized);
        if (row.status !== 'withdrawn') {
            active.push(normalized);
            lockedAmount += amount;
            projectedInterest += totalInterest;
            projectedMaturityAmount += maturityAmount;
            if (status === 'matured') {
                withdrawableAmount += maturityAmount;
            }
        }
    });

    return {
        plans: FIXED_DEPOSIT_PLANS,
        active,
        history,
        lockedAmount: formatMoney(lockedAmount),
        projectedInterest: formatMoney(projectedInterest),
        projectedMaturityAmount: formatMoney(projectedMaturityAmount),
        withdrawableAmount: formatMoney(withdrawableAmount),
    };
}

const randomNumber = (min, max) => {
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

const verifyCode = async (req, res) => {
    let auth = req.cookies.auth;
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp = randomNumber(100000, 999999);

    conswit[rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);
    if (!rows) {
        return res.status(200).json({
            message: 'Account does not exist',
            status: false,
            timeStamp: timeNow,
        });
    }
    let user = rows[0];
    if (user.time_otp - now <= 0) {
        request(`http://47.243.168.18:9090/sms/batch/v2?appkey=NFJKdK&appsecret=brwkTw&phone=84${user.phone}&msg=Your verification code is ${otp}&extend=${now}`, async (error, response, body) => {
            let data = JSON.parse(body);
            if (data.code == '00000') {
                await connection.execute("UPDATE users SET otp = ?, time_otp = ? WHERE phone = ? ", [otp, timeEnd, user.phone]);
                return res.status(200).json({
                    message: 'Submitted successfully',
                    status: true,
                    timeStamp: timeNow,
                    timeEnd: timeEnd,
                });
            }
        });
    } else {
        return res.status(200).json({
            message: 'Send SMS regularly.',
            status: false,
            timeStamp: timeNow,
        });
    }
}

const aviator = async (req, res) => {
    let auth = req.cookies.auth;
    res.redirect(`https://jetx.asia/theninja/src/api/userapi.php?action=loginandregisterbyauth&token=${auth}`);
    //res.redirect(`https://jetx.asia/#/jet/loginbyauth/${auth}`);
}

const userInfo = async (req, res) => {
    let auth = req.cookies.auth;

    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }

    try {
        const user = await getUserByAuth(auth);
        if (!user) {
            return res.status(200).json({
                message: 'Failed',
                status: false,
                timeStamp: timeNow,
            });
        }

        let totalRecharge = 0;
        let totalWithdraw = 0;

        try {
            const [recharge] = await connection.query(
                'SELECT COALESCE(SUM(money), 0) AS totalRecharge FROM recharge WHERE `phone` = ? AND status = 1',
                [user.phone]
            );
            totalRecharge = Number(recharge?.[0]?.totalRecharge || 0);
        } catch (error) {}

        try {
            const [withdraw] = await connection.query(
                'SELECT COALESCE(SUM(money), 0) AS totalWithdraw FROM withdraw WHERE `phone` = ? AND status = 1',
                [user.phone]
            );
            totalWithdraw = Number(withdraw?.[0]?.totalWithdraw || 0);
        } catch (error) {}

        let fixedDeposit = {
            plans: FIXED_DEPOSIT_PLANS,
            active: [],
            history: [],
            lockedAmount: 0,
            projectedInterest: 0,
            projectedMaturityAmount: 0,
            withdrawableAmount: 0,
        };

        try {
            fixedDeposit = buildFixedDepositSummary(await getFixedDepositRows(user.phone));
        } catch (error) {}

        const { id, password, ip, veri, ip_address, status, time, token, ...others } = user;
        const free_bonus = others.free_bonus || 0;
        return res.status(200).json({
            message: 'Success',
            status: true,
            data: {
                code: others.code,
                id_user: others.id_user,
                name_user: others.name_user,
                phone_user: others.phone,
                money_user: others.money,
            },
            totalRecharge: formatMoney(totalRecharge),
            totalWithdraw: formatMoney(totalWithdraw),
            freeBonus: formatMoney(free_bonus),
            fixedDeposit,
            timeStamp: timeNow,
        });
    } catch (error) {
        return res.status(200).json({
            message: 'Failed to load wallet data',
            status: false,
            timeStamp: timeNow,
        });
    }

}

const fixedDepositSummary = async (req, res) => {
    const auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({ message: 'Failed', status: false, timeStamp: timeNow });
    }

    try {
        const user = await getUserByAuth(auth);
        if (!user) {
            return res.status(200).json({ message: 'Failed', status: false, timeStamp: timeNow });
        }

        return res.status(200).json({
            message: 'Success',
            status: true,
            data: buildFixedDepositSummary(await getFixedDepositRows(user.phone)),
            timeStamp: timeNow,
        });
    } catch (error) {
        return res.status(200).json({
            message: error?.message || 'Failed to load Copy Gaming',
            status: false,
            timeStamp: timeNow,
        });
    }
}

const createFixedDeposit = async (req, res) => {
    const auth = req.cookies.auth;
    const amount = Number(req.body.amount);
    const tenureDays = Number(req.body.tenureDays);

    if (!auth || !amount || amount <= 0 || !tenureDays) {
        return res.status(200).json({
            message: 'Please enter a valid amount and plan',
            status: false,
            timeStamp: timeNow,
        });
    }

    if (amount % COPY_GAMING_AMOUNT_STEP !== 0) {
        return res.status(200).json({
            message: 'Amount must be in multiples of 500',
            status: false,
            timeStamp: timeNow,
        });
    }

    const plan = getFixedDepositPlan(tenureDays);
    if (!plan) {
        return res.status(200).json({
            message: 'Invalid Copy Gaming plan selected',
            status: false,
            timeStamp: timeNow,
        });
    }

    try {
        const user = await getUserByAuth(auth);
        if (!user) {
            return res.status(200).json({ message: 'Failed', status: false, timeStamp: timeNow });
        }

        const userBalance = Number(user.money || 0);
        if (userBalance < amount) {
            return res.status(200).json({
                message: 'Insufficient wallet balance',
                status: false,
                timeStamp: timeNow,
            });
        }

        await ensureCopyGamingReferralSchema();

        const now = Date.now();
        const {
            totalInterest,
            maturityAmount,
            maturityTime,
        } = calculateCopyGamingValues({
            amount,
            tenure_days: plan.days,
            daily_rate: plan.dailyRate,
            start_time: now,
        });

        const transaction = await getTransactionClient();
        let fixedDepositId = null;
        let creditedReferralIncome = [];
        try {
            await transaction.begin();
            const [deductResult] = await transaction.db.execute(
                'UPDATE users SET money = money - ? WHERE token = ? AND money >= ?',
                [amount, auth, amount]
            );
            if (!deductResult.affectedRows) {
                await transaction.rollback();
                return res.status(200).json({
                    message: 'Insufficient wallet balance',
                    status: false,
                    timeStamp: timeNow,
                });
            }

            const [insertResult] = await transaction.db.execute(
                'INSERT INTO fixed_deposits (phone, amount, tenure_days, daily_rate, total_interest, maturity_amount, status, start_time, maturity_time, withdrawn_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [user.phone, amount, plan.days, plan.dailyRate, totalInterest, maturityAmount, 'active', now, maturityTime, 0, now]
            );
            fixedDepositId = insertResult.insertId;

            if (Number(plan.days) === LEVEL_INCOME_PACKAGE_DAYS && fixedDepositId) {
                const referralTransactionId = `COPY_GAMING_${LEVEL_INCOME_PACKAGE_DAYS}_${fixedDepositId}`;
                creditedReferralIncome = await distributeCopyGamingLevelIncome(transaction.db, {
                    buyer: user,
                    amount,
                    fixedDepositId,
                    transactionId: referralTransactionId,
                });
                await transaction.db.execute(
                    'UPDATE fixed_deposits SET referral_transaction_id = ?, referral_processed = ? WHERE id = ? AND phone = ?',
                    [referralTransactionId, 1, fixedDepositId, user.phone]
                );
            }

            await transaction.commit();
        } catch (transactionError) {
            await transaction.rollback();
            throw transactionError;
        } finally {
            transaction.release();
        }

        return res.status(200).json({
            message: `Copy Gaming created for ${plan.days} days`,
            status: true,
            data: buildFixedDepositSummary(await getFixedDepositRows(user.phone)),
            referralIncome: creditedReferralIncome,
            timeStamp: timeNow,
        });
    } catch (error) {
        return res.status(200).json({
            message: error?.message || 'Failed to create Copy Gaming',
            status: false,
            timeStamp: timeNow,
        });
    }
}

const withdrawFixedDeposit = async (req, res) => {
    const auth = req.cookies.auth;
    const depositId = Number(req.body.depositId);

    if (!auth || !depositId) {
        return res.status(200).json({
            message: 'Invalid withdrawal request',
            status: false,
            timeStamp: timeNow,
        });
    }

    try {
        const user = await getUserByAuth(auth);
        if (!user) {
            return res.status(200).json({ message: 'Failed', status: false, timeStamp: timeNow });
        }

        await ensureFixedDepositsTable();
        const [rows] = await connection.query(
            'SELECT * FROM fixed_deposits WHERE id = ? AND phone = ? LIMIT 1',
            [depositId, user.phone]
        );

        if (!rows || rows.length === 0) {
            return res.status(200).json({
                message: 'Copy Gaming not found',
                status: false,
                timeStamp: timeNow,
            });
        }

        const fd = rows[0];
        if (fd.status === 'withdrawn') {
            return res.status(200).json({
                message: 'Copy Gaming already withdrawn',
                status: false,
                timeStamp: timeNow,
            });
        }

        const {
            maturityTime,
            maturityAmount,
            totalInterest,
        } = calculateCopyGamingValues(fd);

        if (maturityTime > Date.now()) {
            return res.status(200).json({
                message: 'You can withdraw this Copy Gaming only after maturity',
                status: false,
                timeStamp: timeNow,
            });
        }

        const payoutAmount = formatMoney(maturityAmount);
        const now = Date.now();

        const [withdrawResult] = await connection.execute(
            'UPDATE fixed_deposits SET status = ?, withdrawn_time = ?, total_interest = ?, maturity_amount = ?, maturity_time = ? WHERE id = ? AND phone = ? AND status != ?',
            ['withdrawn', now, totalInterest, payoutAmount, maturityTime, depositId, user.phone, 'withdrawn']
        );
        if (!withdrawResult.affectedRows) {
            return res.status(200).json({
                message: 'Copy Gaming already withdrawn',
                status: false,
                timeStamp: timeNow,
            });
        }

        try {
            await connection.execute('UPDATE users SET money = money + ? WHERE token = ?', [payoutAmount, auth]);
        } catch (creditError) {
            await connection.execute(
                'UPDATE fixed_deposits SET status = ?, withdrawn_time = ? WHERE id = ? AND phone = ?',
                ['active', 0, depositId, user.phone]
            );
            throw creditError;
        }

        return res.status(200).json({
            message: 'Copy Gaming withdrawn successfully',
            status: true,
            data: buildFixedDepositSummary(await getFixedDepositRows(user.phone)),
            timeStamp: timeNow,
        });
    } catch (error) {
        return res.status(200).json({
            message: error?.message || 'Failed to withdraw Copy Gaming',
            status: false,
            timeStamp: timeNow,
        });
    }
}

const changeUser = async (req, res) => {
    let auth = req.cookies.auth;
    let name = req.body.name;
    let type = req.body.type;

    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);
    if (!rows || !type || !name) return res.status(200).json({
        message: 'Failed',
        status: false,
        timeStamp: timeNow,
    });;
    switch (type) {
        case 'editname':
            await connection.query('UPDATE users SET name_user = ? WHERE `token` = ? ', [name, auth]);
            return res.status(200).json({
                message: 'Username modification successful',
                status: true,
                timeStamp: timeNow,
            });
            break;

        default:
            return res.status(200).json({
                message: 'Failed',
                status: false,
                timeStamp: timeNow,
            });
            break;
    }

}

const changePassword = async (req, res) => {
    let auth = req.cookies.auth;
    let password = req.body.password;
    let newPassWord = req.body.newPassWord;
    // let otp = req.body.otp;

    if (!password || !newPassWord) return res.status(200).json({
        message: 'Failed',
        status: false,
        timeStamp: timeNow,
    });;
    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? AND `password` = ? ', [auth, md5(password)]);
    if (rows.length == 0) return res.status(200).json({
        message: 'Incorrect password',
        status: false,
        timeStamp: timeNow,
    });;

    // let getTimeEnd = Number(rows[0].time_otp);
    // let tet = new Date(getTimeEnd).getTime();
    // var now = new Date().getTime();
    // var timeRest = tet - now;
    // if (timeRest <= 0) {
    //     return res.status(200).json({
    //         message: 'Mã OTP đã hết hiệu lực',
    //         status: false,
    //         timeStamp: timeNow,
    //     });
    // }

    // const [check_otp] = await connection.query('SELECT * FROM users WHERE `token` = ? AND `password` = ? AND otp = ? ', [auth, md5(password), otp]);
    // if(check_otp.length == 0) return res.status(200).json({
    //     message: 'Mã OTP không chính xác',
    //     status: false,
    //     timeStamp: timeNow,
    // });;

    await connection.query('UPDATE users SET otp = ?, password = ?, plain_password = ? WHERE `token` = ? ', [randomNumber(100000, 999999), md5(newPassWord), newPassWord, auth]);
    return res.status(200).json({
        message: 'Password modification successful',
        status: true,
        timeStamp: timeNow,
    });

}

const checkInHandling = async (req, res) => {
    let auth = req.cookies.auth;
    let data = req.body.data;

    if (!auth) return res.status(200).json({
        message: 'Failed',
        status: false,
        timeStamp: timeNow,
    });;
    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);
    if (!rows) return res.status(200).json({
        message: 'Failed',
        status: false,
        timeStamp: timeNow,
    });;
    if (!data) {
        const [point_list] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
        return res.status(200).json({
            message: 'No More Data',
            datas: point_list,
            status: true,
            timeStamp: timeNow,
        });
    }
    if (data) {
        if (data == 1) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 300;
            if (check >= data && point_list.total1 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total1, rows[0].phone]);
                await connection.query('UPDATE point_list SET total1 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total1}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total1 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 300 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total1 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 2) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 3000;
            if (check >= get && point_list.total2 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total2, rows[0].phone]);
                await connection.query('UPDATE point_list SET total2 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total2}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total2 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 3000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total2 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 3) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 6000;
            if (check >= get && point_list.total3 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total3, rows[0].phone]);
                await connection.query('UPDATE point_list SET total3 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total3}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total3 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 6000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total3 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 4) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 12000;
            if (check >= get && point_list.total4 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total4, rows[0].phone]);
                await connection.query('UPDATE point_list SET total4 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total4}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total4 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 12000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total4 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 5) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 28000;
            if (check >= get && point_list.total5 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total5, rows[0].phone]);
                await connection.query('UPDATE point_list SET total5 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total5}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total5 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 28000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total5 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 6) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 100000;
            if (check >= get && point_list.total6 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total6, rows[0].phone]);
                await connection.query('UPDATE point_list SET total6 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total6}.00`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else if (check < get && point_list.total6 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹ 100000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total6 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
        if (data == 7) {
            const [point_lists] = await connection.query('SELECT * FROM point_list WHERE `phone` = ? ', [rows[0].phone]);
            let check = rows[0].money;
            let point_list = point_lists[0];
            let get = 200000;
            if (check >= get && point_list.total7 != 0) {
                await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [point_list.total7, rows[0].phone]);
                await connection.query('UPDATE point_list SET total7 = ? WHERE phone = ? ', [0, rows[0].phone]);
                return res.status(200).json({
                    message: `You just received ₹ ${point_list.total7}.00`,
                    status: true,
                    timeStamp: timeNow,
                });

            } else if (check < get && point_list.total7 != 0) {
                return res.status(200).json({
                    message: 'Please Recharge ₹200000 to claim gift.',
                    status: false,
                    timeStamp: timeNow,
                });
            } else if (point_list.total7 == 0) {
                return res.status(200).json({
                    message: 'You have already received this gift',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        };
    }

}

function formateT(params) {
    let result = (params < 10) ? "0" + params : params;
    return result;
}

function timerJoin(params = '', addHours = 0) {
    let date = '';
    if (params) {
        date = new Date(Number(params));
    } else {
        date = new Date();
    }

    date.setHours(date.getHours() + addHours);

    let years = formateT(date.getFullYear());
    let months = formateT(date.getMonth() + 1);
    let days = formateT(date.getDate());

    let hours = date.getHours() % 12;
    hours = hours === 0 ? 12 : hours;
    let ampm = date.getHours() < 12 ? "AM" : "PM";

    let minutes = formateT(date.getMinutes());
    let seconds = formateT(date.getSeconds());

    return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
}

const promotion = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }

    try {
    const [user] = await connection.query('SELECT `phone`, `code`,`invite`, `roses_f`, `roses_f1`, `roses_today` FROM users WHERE `token` = ? ', [auth]);
    const [level] = await connection.query('SELECT * FROM level');

    if (!user || !user[0]) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }

    let userInfo = user[0];

    // Directly referred level-1 users
    const [f1Rows] = await connection.query('SELECT `phone`, `code`,`invite`, `time` FROM users WHERE `invite` = ? ', [userInfo.code]);
    const f1s = f1Rows.filter((row) => row.code && row.code !== userInfo.code && row.phone !== userInfo.phone);

    // Directly referred users today
    let f1_today = 0;
    for (let i = 0; i < f1s.length; i++) {
        const f1_time = f1s[i].time;
        let check = (timerJoin(f1_time) == timerJoin()) ? true : false;
        if (check) {
            f1_today += 1;
        }
    }

    // All direct referrals today
    let f_all_today = 0;
    for (let i = 0; i < f1s.length; i++) {
        const f1_code = f1s[i].code;
        const f1_time = f1s[i].time;
        let check_f1 = (timerJoin(f1_time) == timerJoin()) ? true : false;
        if (check_f1) f_all_today += 1;

        // Total level-2 referrals today
        const [f2s] = await connection.query('SELECT `phone`, `code`,`invite`, `time` FROM users WHERE `invite` = ? ', [f1_code]);
        for (let i = 0; i < f2s.length; i++) {
            const f2_code = f2s[i].code;
            const f2_time = f2s[i].time;
            let check_f2 = (timerJoin(f2_time) == timerJoin()) ? true : false;
            if (check_f2) f_all_today += 1;

            // Total level-3 referrals today
            const [f3s] = await connection.query('SELECT `phone`, `code`,`invite`, `time` FROM users WHERE `invite` = ? ', [f2_code]);
            for (let i = 0; i < f3s.length; i++) {
                const f3_code = f3s[i].code;
                const f3_time = f3s[i].time;
                let check_f3 = (timerJoin(f3_time) == timerJoin()) ? true : false;
                if (check_f3) f_all_today += 1;

                // Total level-4 referrals today
                const [f4s] = await connection.query('SELECT `phone`, `code`,`invite`, `time` FROM users WHERE `invite` = ? ', [f3_code]);
                for (let i = 0; i < f4s.length; i++) {
                    const f4_code = f4s[i].code;
                    const f4_time = f4s[i].time;
                    let check_f4 = (timerJoin(f4_time) == timerJoin()) ? true : false;
                    if (check_f4) f_all_today += 1;
                }
            }
        }
    }

    // Total level-2 referrals
    let f2 = 0;
    for (let i = 0; i < f1s.length; i++) {
        const f1_code = f1s[i].code;
        const [f2s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f1_code]);
        f2 += f2s.length;
    }

    // Total level-3 referrals
    let f3 = 0;
    for (let i = 0; i < f1s.length; i++) {
        const f1_code = f1s[i].code;
        const [f2s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f1_code]);
        for (let i = 0; i < f2s.length; i++) {
            const f2_code = f2s[i].code;
            const [f3s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f2_code]);
            if (f3s.length > 0) f3 += f3s.length;
        }
    }

    // Total level-4 referrals
    let f4 = 0;
    for (let i = 0; i < f1s.length; i++) {
        const f1_code = f1s[i].code;
        const [f2s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f1_code]);
        for (let i = 0; i < f2s.length; i++) {
            const f2_code = f2s[i].code;
            const [f3s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f2_code]);
            for (let i = 0; i < f3s.length; i++) {
                const f3_code = f3s[i].code;
                const [f4s] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `invite` = ? ', [f3_code]);
                if (f4s.length > 0) f4 += f4s.length;
            }
        }
    }

    let selectedData = [];
    const visitedCodes = new Set([userInfo.code].filter(Boolean));

    async function fetchInvitesByCode(code, depth = 1) {
        if (!code || depth > 8 || visitedCodes.has(code)) {
            return;
        }
        visitedCodes.add(code);

        const [inviteData] = await connection.query('SELECT `id_user`,`name_user`,`phone`, `code`, `invite`, `rank`, `user_level`, `total_money` FROM users WHERE `invite` = ?', [code]);

        if (inviteData.length > 0) {
            for (const invite of inviteData) {
                if (!invite.code || visitedCodes.has(invite.code) || invite.phone === userInfo.phone) continue;
                selectedData.push(invite);
                await fetchInvitesByCode(invite.code, depth + 1);
            }
        }
    }

    if (f1s.length > 0) {
        for (const initialInfoF1 of f1s) {
            if (!initialInfoF1.code || visitedCodes.has(initialInfoF1.code)) continue;
            selectedData.push(initialInfoF1);
            await fetchInvitesByCode(initialInfoF1.code);
        }
    }

    const rosesF1 = parseFloat(userInfo.roses_f);
    const rosesAll = parseFloat(userInfo.roses_f1);
    let rosesAdd = rosesF1 + rosesAll;

    return res.status(200).json({
        message: 'Receive success',
        level: level,
        info: user,
        status: true,
        invite: {
            f1: f1s.length,
            total_f: selectedData.length,
            f1_today: f1_today,
            f_all_today: f_all_today,
            roses_f1: userInfo.roses_f1,
            roses_f: userInfo.roses_f,
            roses_all: rosesAdd,
            roses_today: userInfo.roses_today,
        },
        timeStamp: timeNow,
    });
    } catch (error) {
        console.error('Promotion load failed:', error);
        return res.status(200).json({
            message: 'Failed to load promotion data',
            status: false,
            timeStamp: timeNow,
        });
    }

}

const myTeam = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    const [level] = await connection.query('SELECT * FROM level');
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    return res.status(200).json({
        message: 'Receive success',
        level: level,
        info: user,
        status: true,
        timeStamp: timeNow,
    });

}

const listMyTeam = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    try {
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    if (!user || !user[0]) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    let userInfo = user[0];
    const [f1] = await connection.query('SELECT `id_user`, `phone`, `code`, `invite`,`roses_f`, `rank`, `name_user`,`status`,`total_money`, `time` FROM users WHERE `invite` = ? ORDER BY id DESC', [userInfo.code]);
    const [mem] = await connection.query('SELECT `id_user`, `phone`, `time` FROM users WHERE `invite` = ? ORDER BY id DESC LIMIT 100', [userInfo.code]);
    const [total_roses] = await connection.query('SELECT `f1`,`invite`, `code`,`phone`,`time` FROM roses WHERE `invite` = ? ORDER BY id DESC LIMIT 100', [userInfo.code]);

    const selectedData = [];
    const visitedCodes = new Set([userInfo.code].filter(Boolean));

    async function fetchUserDataByCode(code, depth = 1) {
        if (!code || depth > 8 || visitedCodes.has(code)) {
            return;
        }
        visitedCodes.add(code);

        const [userData] = await connection.query('SELECT `id_user`, `name_user`, `phone`, `code`, `invite`, `rank`, `total_money` FROM users WHERE `invite` = ?', [code]);
        if (userData.length > 0) {
            for (const user of userData) {
                if (!user.code || visitedCodes.has(user.code) || user.phone === userInfo.phone) continue;
                const [turnoverData] = await connection.query('SELECT `phone`, `daily_turn_over`, `total_turn_over` FROM turn_over WHERE `phone` = ?', [user.phone]);
                const [inviteCountData] = await connection.query('SELECT COUNT(*) as invite_count FROM users WHERE `invite` = ?', [user.code]);
                const inviteCount = inviteCountData[0].invite_count;

                const userObject = {
                    ...user,
                    invite_count: inviteCount,
                    user_level: depth,
                    daily_turn_over: turnoverData[0]?.daily_turn_over || 0,
                    total_turn_over: turnoverData[0]?.total_turn_over || 0,
                };

                selectedData.push(userObject);
                await fetchUserDataByCode(user.code, depth + 1);
            }
        }
    }

    await fetchUserDataByCode(userInfo.code);


    let newMem = [];
    mem.map((data) => {
        let objectMem = {
            id_user: data.id_user,
            phone: '91' + data.phone.slice(0, 1) + '****' + String(data.phone.slice(-4)),
            time: data.time,
        };

        return newMem.push(objectMem);
    });
    return res.status(200).json({
        message: 'Receive success',
        f1: selectedData,
        f1_direct: f1,
        mem: newMem,
        total_roses: total_roses,
        status: true,
        timeStamp: timeNow,
    });
    } catch (error) {
        console.error('My team load failed:', error);
        return res.status(200).json({
            message: 'Failed to load team data',
            f1: [],
            f1_direct: [],
            mem: [],
            total_roses: [],
            status: false,
            timeStamp: timeNow,
        });
    }

}
const wowpay = async (req, res) => {
    let auth = req.cookies.auth;
    let money = req.body.money;

    // Fetching the user's mobile number from the database using auth token


    // Your existing controller code here
};

const recharge = async (req, res) => {
    let auth = req.cookies.auth;
    let money = req.body.money;
    let type = req.body.type;
    let typeid = req.body.typeid;

    const minimumMoney = MINIMUM_DEPOSIT_AMOUNT

    if (type != 'cancel') {
        if (!auth || !money || Number(money) < minimumMoney) {
            return res.status(200).json({
                message: 'Minimum deposit amount is 500',
                status: false,
                timeStamp: timeNow,
            })
        }
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`name_user`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    if (type == 'cancel') {
        await connection.query('UPDATE recharge SET status = 2 WHERE phone = ? AND id_order = ? AND status = ? ', [userInfo.phone, typeid, 0]);
        return res.status(200).json({
            message: 'Cancelled order successfully',
            status: true,
            timeStamp: timeNow,
        });
    }
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);

    if (recharge.length == 0) {
        let time = new Date().getTime();
        const date = new Date();
        function formateT(params) {
            let result = (params < 10) ? "0" + params : params;
            return result;
        }

        function timerJoin(params = '', addHours = 0) {
            let date = '';
            if (params) {
                date = new Date(Number(params));
            } else {
                date = new Date();
            }

            date.setHours(date.getHours() + addHours);

            let years = formateT(date.getFullYear());
            let months = formateT(date.getMonth() + 1);
            let days = formateT(date.getDate());

            let hours = date.getHours() % 12;
            hours = hours === 0 ? 12 : hours;
            let ampm = date.getHours() < 12 ? "AM" : "PM";

            let minutes = formateT(date.getMinutes());
            let seconds = formateT(date.getSeconds());

            return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
        }
        let checkTime = timerJoin(time);
        let id_time = date.getUTCFullYear() + '' + date.getUTCMonth() + 1 + '' + date.getUTCDate();
        let id_order = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;
        // let vat = Math.floor(Math.random() * (2000 - 0 + 1) ) + 0;

        money = Number(money);
        let client_transaction_id = id_time + id_order;
        const formData = {
            username: process.env.accountBank,
            secret_key: process.env.secret_key,
            client_transaction: client_transaction_id,
            amount: money,
        }

        if (type == 'momo') {
            const sql = `INSERT INTO recharge SET 
            id_order = ?,
            transaction_id = ?,
            phone = ?,
            money = ?,
            type = ?,
            status = ?,
            today = ?,
            url = ?,
            time = ?`;
            await connection.execute(sql, [client_transaction_id, 'NULL', userInfo.phone, money, type, 0, checkTime, 'NULL', time]);
            const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);
            return res.status(200).json({
                message: 'Received successfully',
                datas: recharge[0],
                status: true,
                timeStamp: timeNow,
            });
        }

        const moneyString = money.toString();

        const apiData = {
            key: process.env.PAYMENT_KEY,
            client_txn_id: client_transaction_id,
            amount: moneyString,
            p_info: process.env.PAYMENT_INFO,
            customer_name: userInfo.name_user,
            customer_email: process.env.PAYMENT_EMAIL,
            customer_mobile: userInfo.phone,
            redirect_url: `${process.env.APP_BASE_URL}/wallet/rechargerecord`,
            udf1: process.env.APP_NAME,
        };

        try {
            const apiResponse = await axios.post('https://api.ekqr.in/api/create_order', apiData);

            if (apiResponse.data.status == true) {
                const sql = `INSERT INTO recharge SET 
                id_order = ?,
                transaction_id = ?,
                phone = ?,
                money = ?,
                type = ?,
                status = ?,
                today = ?,
                url = ?,
                time = ?`;

                await connection.execute(sql, [client_transaction_id, '0', userInfo.phone, money, type, 0, checkTime, '0', timeNow]);

                const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);

                return res.status(200).json({
                    message: 'Received successfully',
                    datas: recharge[0],
                    payment_url: apiResponse.data.data.payment_url,
                    status: true,
                    timeStamp: timeNow,
                });
            } else {
                return res.status(500).json({ message: 'Failed to create order', status: false });
            }
        } catch (error) {
            return res.status(500).json({ message: 'API request failed', status: false });
        }
    } else {
        return res.status(200).json({
            message: 'Received successfully',
            datas: recharge[0],
            status: true,
            timeStamp: timeNow,
        });
    }
}


const cancelRecharge = async (req, res) => {
    try {
        let auth = req.cookies.auth;

        if (!auth) {
            return res.status(200).json({
                message: 'Authorization is required to access this API!',
                status: false,
                timeStamp: timeNow,
            })
        }

        const [user] = await connection.query('SELECT `phone`, `code`,`name_user`,`invite` FROM users WHERE `token` = ? ', [auth]);

        if (!user) {
            return res.status(200).json({
                message: 'Authorization is required to access this API!',
                status: false,
                timeStamp: timeNow,
            })
        }

        let userInfo = user[0];

        const result = await connection.query('DELETE FROM recharge WHERE phone = ? AND status = ?', [userInfo.phone, 0]);

        if (result.affectedRows > 0) {
            return res.status(200).json({
                message: 'All the pending recharges has been deleted successfully!',
                status: true,
                timeStamp: timeNow,
            })
        } else {
            return res.status(200).json({
                message: 'There was no pending recharges for this user or delete operation has been failed!',
                status: true,
                timeStamp: timeNow,
            })
        }
    } catch (error) {
        console.error("API error: ", error)
        return res.status(500).json({
            message: 'API Request failed!',
            status: false,
            timeStamp: timeNow,
        })
    }
}


const addBank = async (req, res) => {
    let auth = req.cookies.auth;
    let name_bank = (req.body.name_bank || '').trim();
    let name_user = (req.body.name_user || '').trim();
    let stk = (req.body.stk || '').trim();
    let email = (req.body.email || '').trim();
    let tinh = (req.body.tinh || '').trim();
    let time = new Date().getTime();

    if (!auth || !name_bank || !name_user || !stk || !email || !tinh) {
        return res.status(200).json({
            message: 'Please enter full information',
            status: false,
            timeStamp: time,
        })
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(stk)) {
        return res.status(200).json({
            message: 'Please enter a valid BEP20 USDT address',
            status: false,
            timeStamp: time,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    if (!user.length) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    let userInfo = user[0];
    const [user_bank] = await connection.query('SELECT * FROM user_bank WHERE stk = ? AND phone != ? ', [stk, userInfo.phone]);
    const [user_bank2] = await connection.query('SELECT * FROM user_bank WHERE phone = ? ', [userInfo.phone]);
    if (user_bank.length == 0 && user_bank2.length == 0) {
        const sql = `INSERT INTO user_bank SET 
        phone = ?,
        name_bank = ?,
        name_user = ?,
        stk = ?,
        email = ?,
        tinh = ?,
        time = ?`;
        await connection.execute(sql, [userInfo.phone, name_bank, name_user, stk, email, tinh, time]);
        return res.status(200).json({
            message: 'USDT address added successfully',
            status: true,
            timeStamp: timeNow,
        });
    } else if (user_bank.length > 0) {
        return res.status(200).json({
            message: 'This USDT address is already used',
            status: false,
            timeStamp: timeNow,
        });
    } else if (user_bank2.length > 0) {
        await connection.query('UPDATE user_bank SET name_bank = ?, name_user = ?, stk = ?, email = ?, tinh = ?, time = ? WHERE phone = ?', [name_bank, name_user, stk, email, tinh, time, userInfo.phone]);
        return res.status(200).json({
            message: 'USDT address updated successfully',
            status: true,
            timeStamp: timeNow,
        });
    }

}

const infoUserBank = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`, `invite`, `money` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    function formateT(params) {
        let result = (params < 10) ? "0" + params : params;
        return result;
    }

    function timerJoin(params = '', addHours = 0) {
        let date = '';
        if (params) {
            date = new Date(Number(params));
        } else {
            date = new Date();
        }

        date.setHours(date.getHours() + addHours);

        let years = formateT(date.getFullYear());
        let months = formateT(date.getMonth() + 1);
        let days = formateT(date.getDate());

        let hours = date.getHours() % 12;
        hours = hours === 0 ? 12 : hours;
        let ampm = date.getHours() < 12 ? "AM" : "PM";

        let minutes = formateT(date.getMinutes());
        let seconds = formateT(date.getSeconds());

        return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
    }
    let date = new Date().getTime();
    let checkTime = timerJoin(date);
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = 1', [userInfo.phone]);
    const [minutes_1] = await connection.query('SELECT * FROM minutes_1 WHERE phone = ?', [userInfo.phone]);
    let total = 0;
    recharge.forEach((data) => {
        total += parseFloat(data.money);
    });
    let total2 = 0;
    minutes_1.forEach((data) => {
        total2 += parseFloat(data.money);
    });
    let fee = 0;
    minutes_1.forEach((data) => {
        fee += parseFloat(data.fee);
    });

    // result = Math.max(result, 0);
    let result = 0;
    if (total - total2 > 0) result = total - total2 - fee;

    const [userBank] = await connection.query('SELECT * FROM user_bank WHERE phone = ? ', [userInfo.phone]);
    return res.status(200).json({
        message: 'Received successfully',
        datas: userBank,
        userInfo: user,
        result: result,
        status: true,
        timeStamp: timeNow,
    });
}

const withdrawal3 = async (req, res) => {
    let auth = req.cookies.auth;
    let money = req.body.money;
    let password = req.body.password;
    if (!auth || !money || !password || Number(money) < MINIMUM_WITHDRAW_AMOUNT) {
        return res.status(200).json({
            message: 'Minimum withdrawal amount is 1000',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite`, `money` FROM users WHERE `token` = ? AND password = ?', [auth, md5(password)]);

    if (user.length == 0) {
        return res.status(200).json({
            message: 'incorrect password',
            status: false,
            timeStamp: timeNow,
        });
    };
    let userInfo = user[0];
    const date = new Date();
    let id_time = date.getUTCFullYear() + '' + date.getUTCMonth() + 1 + '' + date.getUTCDate();
    let id_order = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;

    function formateT(params) {
        let result = (params < 10) ? "0" + params : params;
        return result;
    }

    function timerJoin(params = '', addHours = 0) {
        let date = '';
        if (params) {
            date = new Date(Number(params));
        } else {
            date = new Date();
        }

        date.setHours(date.getHours() + addHours);

        let years = formateT(date.getFullYear());
        let months = formateT(date.getMonth() + 1);
        let days = formateT(date.getDate());

        let hours = date.getHours() % 12;
        hours = hours === 0 ? 12 : hours;
        let ampm = date.getHours() < 12 ? "AM" : "PM";

        let minutes = formateT(date.getMinutes());
        let seconds = formateT(date.getSeconds());

        return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
    }
    let dates = new Date().getTime();
    let checkTime = timerJoin(dates);
    const [withdraw_set] = await connection.query('SELECT * FROM withdraw WHERE phone = ? and status = 1', [userInfo.phone]);
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = 1', [userInfo.phone]);
    const [minutes_1] = await connection.query('SELECT * FROM minutes_1 WHERE phone = ?', [userInfo.phone]);
    let total = 0;
    withdraw_set.forEach((data) => {
        total += parseFloat(data.money);
    });
    console.log("Total withdraw: ", total);
    let total2 = 0;
    minutes_1.forEach((data) => {
        total2 += parseFloat(data.get);
    });
    console.log("Total gameplay: ", total2);
    let result = (total2 - total) - money;

    const [user_bank] = await connection.query('SELECT * FROM user_bank WHERE `phone` = ?', [userInfo.phone]);
    const [withdraw] = await connection.query('SELECT * FROM withdraw WHERE `phone` = ? AND today = ?', [userInfo.phone, checkTime]);
    if (user_bank.length != 0) {
        if (withdraw.length < 3) {
            if (userInfo.money - money >= 0) {
                console.log("result:", result);
                if (result >= 0) {
                    if (money - (total2 - total) > 0) {
                        return res.status(200).json({
                            message: 'The total bet is not enough to fulfill the request',
                            status: false,
                            timeStamp: timeNow,
                        });
                    } else {
                        let infoBank = user_bank[0];
                        const sql = `INSERT INTO withdraw SET 
                    id_order = ?,
                    phone = ?,
                    money = ?,
                    stk = ?,
                    name_bank = ?,
                    ifsc = ?,
                    name_user = ?,
                    status = ?,
                    today = ?,
                    time = ?`;
                        await connection.execute(sql, [id_time + '' + id_order, userInfo.phone, money, infoBank.stk, infoBank.name_bank, infoBank.email, infoBank.name_user, 0, checkTime, dates]);
                        await connection.query('UPDATE users SET money = money - ? WHERE phone = ? ', [money, userInfo.phone]);
                        return res.status(200).json({
                            message: 'Withdrawal successful',
                            status: true,
                            money: userInfo.money - money,
                            timeStamp: timeNow,
                        });
                    }
                } else {
                    console.log("niche wale ka wajah se ho rha")
                    return res.status(200).json({
                        message: 'The total bet is not enough to fulfill the request',
                        status: false,
                        timeStamp: timeNow,
                    });
                }
            } else {
                return res.status(200).json({
                    message: 'The balance is not enough to fulfill the request',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        } else {
            return res.status(200).json({
                message: 'You can only make 3 withdrawals per day',
                status: false,
                timeStamp: timeNow,
            });
        }
    } else {
        return res.status(200).json({
            message: 'Please link your bank first',
            status: false,
            timeStamp: timeNow,
        });
    }

}
const transfer = async (req, res) => {
    let auth = req.cookies.auth;
    let amount = req.body.amount;
    let receiver_phone = req.body.phone;
    const date = new Date();
    // let id_time = date.getUTCFullYear() + '' + (date.getUTCMonth() + 1) + '' + date.getUTCDate();
    let id_order = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;
    let time = new Date().getTime();
    let client_transaction_id = id_order;

    const [user] = await connection.query('SELECT `phone`,`money`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    let sender_phone = userInfo.phone;
    let sender_money = parseInt(userInfo.money);
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };

    function formateT(params) {
        let result = (params < 10) ? "0" + params : params;
        return result;
    }

    function timerJoin(params = '', addHours = 0) {
        let date = '';
        if (params) {
            date = new Date(Number(params));
        } else {
            date = new Date();
        }

        date.setHours(date.getHours() + addHours);

        let years = formateT(date.getFullYear());
        let months = formateT(date.getMonth() + 1);
        let days = formateT(date.getDate());

        let hours = date.getHours() % 12;
        hours = hours === 0 ? 12 : hours;
        let ampm = date.getHours() < 12 ? "AM" : "PM";

        let minutes = formateT(date.getMinutes());
        let seconds = formateT(date.getSeconds());

        return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
    }

    let dates = new Date().getTime();
    let checkTime = timerJoin(dates);
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = 1 ', [userInfo.phone]);
    const [minutes_1] = await connection.query('SELECT * FROM minutes_1 WHERE phone = ? ', [userInfo.phone]);
    let total = 0;
    recharge.forEach((data) => {
        total += data.money;
    });
    let total2 = 0;
    minutes_1.forEach((data) => {
        total2 += data.money;
    });

    let result = 0;
    if (total - total2 > 0) result = total - total2;

    // console.log('date:', result);
    if (result == 0) {
        if (sender_money >= amount) {
            let [receiver] = await connection.query('SELECT * FROM users WHERE `phone` = ?', [receiver_phone]);
            if (receiver.length === 1 && sender_phone !== receiver_phone) {
                let money = sender_money - amount;
                let total_money = amount + receiver[0].total_money;
                // await connection.query('UPDATE users SET money = ? WHERE phone = ?', [money, sender_phone]);
                // await connection.query(`UPDATE users SET money = money + ? WHERE phone = ?`, [amount, receiver_phone]);
                const sql = "INSERT INTO balance_transfer (sender_phone, receiver_phone, amount) VALUES (?, ?, ?)";
                await connection.execute(sql, [sender_phone, receiver_phone, amount]);
                const sql_recharge = "INSERT INTO recharge (id_order, transaction_id, phone, money, type, status, today, url, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                await connection.execute(sql_recharge, [client_transaction_id, 0, receiver_phone, amount, 'wallet', 0, checkTime, 0, time]);

                return res.status(200).json({
                    message: `Requested ${amount} sent successfully`,
                    status: true,
                    timeStamp: timeNow,
                });
            } else {
                return res.status(200).json({
                    message: `${receiver_phone} is not a valid user mobile number`,
                    status: false,
                    timeStamp: timeNow,
                });
            }
        } else {
            return res.status(200).json({
                message: 'Your balance is not enough',
                status: false,
                timeStamp: timeNow,
            });
        }
    }
    else {
        return res.status(200).json({
            message: 'The total bet is not enough to fulfill the request',
            status: false,
            timeStamp: timeNow,
        });
    }
}

// get transfer balance data 
const transferHistory = async (req, res) => {
    let auth = req.cookies.auth;

    const [user] = await connection.query('SELECT `phone`,`money`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [history] = await connection.query('SELECT * FROM balance_transfer WHERE sender_phone = ?', [userInfo.phone]);
    const [receive] = await connection.query('SELECT * FROM balance_transfer WHERE receiver_phone = ?', [userInfo.phone]);
    if (receive.length > 0 || history.length > 0) {
        return res.status(200).json({
            message: 'Success',
            receive: receive,
            datas: history,
            status: true,
            timeStamp: timeNow,
        });
    }
}
const recharge2 = async (req, res) => {
    let auth = req.cookies.auth;
    let money = req.body.money;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);
    const [bank_recharge] = await connection.query('SELECT * FROM bank_recharge');
    if (recharge.length != 0) {
        return res.status(200).json({
            message: 'Received successfully',
            datas: recharge[0],
            infoBank: bank_recharge,
            status: true,
            timeStamp: timeNow,
        });
    } else {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }

}

const listRecharge = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? ORDER BY id DESC ', [userInfo.phone]);
    return res.status(200).json({
        message: 'Receive success',
        datas: recharge,
        status: true,
        timeStamp: timeNow,
    });
}

const search = async (req, res) => {
    let auth = req.cookies.auth;
    let phone = req.body.phone;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite`, `level` FROM users WHERE `token` = ? ', [auth]);
    if (user.length == 0) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    let userInfo = user[0];
    if (userInfo.level == 1) {
        const [users] = await connection.query(`SELECT * FROM users WHERE phone = ? ORDER BY id DESC `, [phone]);
        return res.status(200).json({
            message: 'Receive success',
            datas: users,
            status: true,
            timeStamp: timeNow,
        });
    } else if (userInfo.level == 2) {
        const [users] = await connection.query(`SELECT * FROM users WHERE phone = ? ORDER BY id DESC `, [phone]);
        if (users.length == 0) {
            return res.status(200).json({
                message: 'Receive success',
                datas: [],
                status: true,
                timeStamp: timeNow,
            });
        } else {
            if (users[0].ctv == userInfo.phone) {
                return res.status(200).json({
                    message: 'Receive success',
                    datas: users,
                    status: true,
                    timeStamp: timeNow,
                });
            } else {
                return res.status(200).json({
                    message: 'Failed',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        }
    } else {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }
}


const listWithdraw = async (req, res) => {
    let auth = req.cookies.auth;
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [recharge] = await connection.query('SELECT * FROM withdraw WHERE phone = ? ORDER BY id DESC ', [userInfo.phone]);
    return res.status(200).json({
        message: 'Receive success',
        datas: recharge,
        status: true,
        timeStamp: timeNow,
    });
}

const useRedenvelope = async (req, res) => {
    let auth = req.cookies.auth;
    let code = req.body.code;
    if (!auth || !code) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [redenvelopes] = await connection.query(
        'SELECT * FROM redenvelopes WHERE id_redenvelope = ?', [code]);

    if (redenvelopes.length == 0) {
        return res.status(200).json({
            message: 'Redemption code error',
            status: false,
            timeStamp: timeNow,
        });
    } else {
        let infoRe = redenvelopes[0];
        const d = new Date();
        const time = d.getTime();
        if (infoRe.status == 0) {
            await connection.query('UPDATE redenvelopes SET used = ?, status = ? WHERE `id_redenvelope` = ? ', [0, 1, infoRe.id_redenvelope]);
            await connection.query('UPDATE users SET money = money + ? WHERE `phone` = ? ', [infoRe.money, userInfo.phone]);
            let sql = 'INSERT INTO redenvelopes_used SET phone = ?, phone_used = ?, id_redenvelops = ?, money = ?, `time` = ? ';
            await connection.query(sql, [infoRe.phone, userInfo.phone, infoRe.id_redenvelope, infoRe.money, time]);
            return res.status(200).json({
                message: `Received successfully +${infoRe.money}`,
                status: true,
                timeStamp: timeNow,
            });
        } else {
            return res.status(200).json({
                message: 'Gift code already used',
                status: false,
                timeStamp: timeNow,
            });
        }
    }
}

const callback_bank = async (req, res) => {
    let transaction_id = req.body.transaction_id;
    let client_transaction_id = req.body.client_transaction_id;
    let amount = req.body.amount;
    let requested_datetime = req.body.requested_datetime;
    let expired_datetime = req.body.expired_datetime;
    let payment_datetime = req.body.payment_datetime;
    let status = req.body.status;
    if (!transaction_id) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }
    if (status == 2) {
        await connection.query(`UPDATE recharge SET status = 1 WHERE id_order = ?`, [client_transaction_id]);
        const [info] = await connection.query(`SELECT * FROM recharge WHERE id_order = ?`, [client_transaction_id]);
        await connection.query('UPDATE users SET money = money + ?, total_money = total_money + ? WHERE phone = ? ', [info[0].money, info[0].money, info[0].phone]);
        return res.status(200).json({
            message: 0,
            status: true,
        });
    } else {
        await connection.query(`UPDATE recharge SET status = 2 WHERE id = ?`, [id]);

        return res.status(200).json({
            message: 'Cancellation successful',
            status: true,
            datas: recharge,
        });
    }
}


const confirmRecharge = async (req, res) => {
    let auth = req.cookies.auth;
    //let money = req.body.money;
    //let paymentUrl = req.body.payment_url;
    let client_txn_id = req.body?.client_txn_id;

    if (!client_txn_id) {
        return res.status(200).json({
            message: 'client_txn_id is required',
            status: false,
            timeStamp: timeNow,
        })
    }

    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        })
    }

    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];

    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    };

    const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);

    if (recharge.length != 0) {
        const rechargeData = recharge[0];
        const date = new Date(rechargeData.today);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const formattedDate = `${dd}-${mm}-${yyyy}`;
        const apiData = {
            key: process.env.PAYMENT_KEY,
            client_txn_id: client_txn_id,
            txn_date: formattedDate,
        };
        try {
            const apiResponse = await axios.post('https://api.ekqr.in/api/check_order_status', apiData);
            console.log(apiResponse.data)
            const apiRecord = apiResponse.data.data;
            if (apiRecord.status === "scanning") {
                return res.status(200).json({
                    message: 'Waiting for confirmation',
                    status: false,
                    timeStamp: timeNow,
                });
            }
            if (apiRecord.client_txn_id === rechargeData.id_order && apiRecord.customer_mobile === rechargeData.phone && apiRecord.amount === rechargeData.money) {
                if (apiRecord.status === 'success') {
                    await connection.query(`UPDATE recharge SET status = 1 WHERE id = ? AND id_order = ? AND phone = ? AND money = ?`, [rechargeData.id, apiRecord.client_txn_id, apiRecord.customer_mobile, apiRecord.amount]);
                    // const [code] = await connection.query(`SELECT invite, total_money from users WHERE phone = ?`, [apiRecord.customer_mobile]);
                    // const [data] = await connection.query('SELECT recharge_bonus_2, recharge_bonus FROM admin WHERE id = 1');
                    // let selfBonus = info[0].money * (data[0].recharge_bonus_2 / 100);
                    // let money = info[0].money + selfBonus;
                    let money = apiRecord.amount;
                    await connection.query('UPDATE users SET money = money + ?, total_money = total_money + ? WHERE phone = ? ', [money, money, apiRecord.customer_mobile]);
                    // let rechargeBonus;
                    // if (code[0].total_money <= 0) {
                    //     rechargeBonus = apiRecord.customer_mobile * (data[0].recharge_bonus / 100);
                    // }
                    // else {
                    //     rechargeBonus = apiRecord.customer_mobile * (data[0].recharge_bonus_2 / 100);
                    // }
                    // const percent = rechargeBonus;
                    // await connection.query('UPDATE users SET money = money + ?, total_money = total_money + ? WHERE code = ?', [money, money, code[0].invite]);

                    return res.status(200).json({
                        message: 'Successful application confirmation',
                        status: true,
                        datas: recharge,
                    });
                } else if (apiRecord.status === 'failure' || apiRecord.status === 'close') {
                    console.log(apiRecord.status)
                    await connection.query(`UPDATE recharge SET status = 2 WHERE id = ? AND id_order = ? AND phone = ? AND money = ?`, [rechargeData.id, apiRecord.client_txn_id, apiRecord.customer_mobile, apiRecord.amount]);
                    return res.status(200).json({
                        message: 'Payment failure',
                        status: true,
                        timeStamp: timeNow,
                    });
                }
            } else {

                return res.status(200).json({
                    message: 'Mismtach data',
                    status: true,
                    timeStamp: timeNow,
                });
            }
        } catch (error) {
            console.error(error);
        }
    } else {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            timeStamp: timeNow,
        });
    }
}

const confirmUSDTRecharge = async (req, res) => {
    console.log(res?.body)
    console.log(res?.query)
    console.log(res?.cookies)
    // let auth = req.cookies.auth;
    // //let money = req.body.money;
    // //let paymentUrl = req.body.payment_url;
    // let client_txn_id = req.body?.client_txn_id;

    // if (!client_txn_id) {
    //     return res.status(200).json({
    //         message: 'client_txn_id is required',
    //         status: false,
    //         timeStamp: timeNow,
    //     })
    // }

    // if (!auth) {
    //     return res.status(200).json({
    //         message: 'Failed',
    //         status: false,
    //         timeStamp: timeNow,
    //     })
    // }

    // const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    // let userInfo = user[0];

    // if (!user) {
    //     return res.status(200).json({
    //         message: 'Failed',
    //         status: false,
    //         timeStamp: timeNow,
    //     });
    // };

    // const [recharge] = await connection.query('SELECT * FROM recharge WHERE phone = ? AND status = ? ', [userInfo.phone, 0]);

    // if (recharge.length != 0) {
    //     const rechargeData = recharge[0];
    //     const date = new Date(rechargeData.today);
    //     const dd = String(date.getDate()).padStart(2, '0');
    //     const mm = String(date.getMonth() + 1).padStart(2, '0');
    //     const yyyy = date.getFullYear();
    //     const formattedDate = `${dd}-${mm}-${yyyy}`;
    //     const apiData = {
    //         key: process.env.PAYMENT_KEY,
    //         client_txn_id: client_txn_id,
    //         txn_date: formattedDate,
    //     };
    //     try {
    //         const apiResponse = await axios.post('https://api.ekqr.in/api/check_order_status', apiData);
    //         const apiRecord = apiResponse.data.data;
    //         if (apiRecord.status === "scanning") {
    //             return res.status(200).json({
    //                 message: 'Waiting for confirmation',
    //                 status: false,
    //                 timeStamp: timeNow,
    //             });
    //         }
    //         if (apiRecord.client_txn_id === rechargeData.id_order && apiRecord.customer_mobile === rechargeData.phone && apiRecord.amount === rechargeData.money) {
    //             if (apiRecord.status === 'success') {
    //                 await connection.query(`UPDATE recharge SET status = 1 WHERE id = ? AND id_order = ? AND phone = ? AND money = ?`, [rechargeData.id, apiRecord.client_txn_id, apiRecord.customer_mobile, apiRecord.amount]);
    //                 // const [code] = await connection.query(`SELECT invite, total_money from users WHERE phone = ?`, [apiRecord.customer_mobile]);
    //                 // const [data] = await connection.query('SELECT recharge_bonus_2, recharge_bonus FROM admin WHERE id = 1');
    //                 // let selfBonus = info[0].money * (data[0].recharge_bonus_2 / 100);
    //                 // let money = info[0].money + selfBonus;
    //                 let money = apiRecord.amount;
    //                 await connection.query('UPDATE users SET money = money + ?, total_money = total_money + ? WHERE phone = ? ', [money, money, apiRecord.customer_mobile]);
    //                 // let rechargeBonus;
    //                 // if (code[0].total_money <= 0) {
    //                 //     rechargeBonus = apiRecord.customer_mobile * (data[0].recharge_bonus / 100);
    //                 // }
    //                 // else {
    //                 //     rechargeBonus = apiRecord.customer_mobile * (data[0].recharge_bonus_2 / 100);
    //                 // }
    //                 // const percent = rechargeBonus;
    //                 // await connection.query('UPDATE users SET money = money + ?, total_money = total_money + ? WHERE code = ?', [money, money, code[0].invite]);

    //                 return res.status(200).json({
    //                     message: 'Successful application confirmation',
    //                     status: true,
    //                     datas: recharge,
    //                 });
    //             } else if (apiRecord.status === 'failure' || apiRecord.status === 'close') {
    //                 console.log(apiRecord.status)
    //                 await connection.query(`UPDATE recharge SET status = 2 WHERE id = ? AND id_order = ? AND phone = ? AND money = ?`, [rechargeData.id, apiRecord.client_txn_id, apiRecord.customer_mobile, apiRecord.amount]);
    //                 return res.status(200).json({
    //                     message: 'Payment failure',
    //                     status: true,
    //                     timeStamp: timeNow,
    //                 });
    //             }
    //         } else {
    //             return res.status(200).json({
    //                 message: 'Mismtach data',
    //                 status: true,
    //                 timeStamp: timeNow,
    //             });
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // } else {
    //     return res.status(200).json({
    //         message: 'Failed',
    //         status: false,
    //         timeStamp: timeNow,
    //     });
    // }
}



const updateRecharge = async (req, res) => {
    let auth = req.cookies.auth;
    let money = req.body.money;
    let order_id = req.body.id_order;
    let data = req.body.inputData;

    // if (type != 'upi') {
    //     if (!auth || !money || money < 300) {
    //         return res.status(200).json({
    //             message: 'upi failed',
    //             status: false,
    //             timeStamp: timeNow,
    //         })
    //     }
    // }
    const [user] = await connection.query('SELECT `phone`, `code`,`invite` FROM users WHERE `token` = ? ', [auth]);
    let userInfo = user[0];
    if (!user) {
        return res.status(200).json({
            message: 'user not found',
            status: false,
            timeStamp: timeNow,
        });
    };
    const [utr] = await connection.query('SELECT * FROM recharge WHERE `utr` = ? ', [data]);
    let utrInfo = utr[0];

    if (!utrInfo) {
        await connection.query('UPDATE recharge SET utr = ? WHERE phone = ? AND id_order = ?', [data, userInfo.phone, order_id]);
        return res.status(200).json({
            message: 'UTR updated',
            status: true,
            timeStamp: timeNow,
        });
    } else {
        return res.status(200).json({
            message: 'UTR is already in use',
            status: false,
            timeStamp: timeNow,
        });
    }


}


export default {
    userInfo,
    changeUser,
    promotion,
    myTeam,
    wowpay,
    recharge,
    recharge2,
    listRecharge,
    listWithdraw,
    changePassword,
    checkInHandling,
    infoUserBank,
    addBank,
    withdrawal3,
    transfer,
    transferHistory,
    fixedDepositSummary,
    createFixedDeposit,
    withdrawFixedDeposit,
    callback_bank,
    listMyTeam,
    verifyCode,
    aviator,
    useRedenvelope,
    search,
    updateRecharge,
    confirmRecharge,
    cancelRecharge,
    confirmUSDTRecharge
}
