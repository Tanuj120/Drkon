import connection from "../config/connectDB.js";
// import jwt from 'jsonwebtoken'
// import md5 from "md5";
// import e from "express";

const homePage = async (req, res) => {
    const [settings] = await connection.query('SELECT `app` FROM admin');
    let app = settings[0].app;
    return res.render("home/index.ejs", { app });
}

const checkInPage = async (req, res) => {
    return res.render("checkIn/checkIn.ejs");
}

const checkDes = async (req, res) => {
    return res.render("checkIn/checkDes.ejs");
}

const checkRecord = async (req, res) => {
    return res.render("checkIn/checkRecord.ejs");
}

const addBank = async (req, res) => {
    return res.render("wallet/addbank.ejs");
}

// promotion
const promotionPage = async (req, res) => {
    return res.render("promotion/promotion.ejs");
}

const promotionmyTeamPage = async (req, res) => {
    return res.render("promotion/myTeam.ejs");
}

const promotionDesPage = async (req, res) => {
    return res.render("promotion/promotionDes.ejs");
}

const tutorialPage = async (req, res) => {
    return res.render("promotion/tutorial.ejs");
}

const bonusRecordPage = async (req, res) => {
    return res.render("promotion/bonusrecord.ejs");
}

// wallet
const walletPage = async (req, res) => {
    return res.render("wallet/index.ejs");
}

const rechargePage = async (req, res) => {
    return res.render("wallet/recharge.ejs", {
        MinimumMoney: 500
    });
}

const rechargerecordPage = async (req, res) => {
    return res.render("wallet/rechargerecord.ejs");
}

const withdrawalPage = async (req, res) => {
    return res.render("wallet/withdrawal.ejs");
}

const withdrawalrecordPage = async (req, res) => {
    return res.render("wallet/withdrawalrecord.ejs");
}
const transfer = async (req, res) => {
    return res.render("wallet/transfer.ejs");
}

// member page
const mianPage = async (req, res) => {
    let auth = req.cookies.auth;
    const [user] = await connection.query('SELECT `level` FROM users WHERE `token` = ? ', [auth]);
    const [settings] = await connection.query('SELECT `cskh` FROM admin');
    let cskh = settings[0].cskh;
    let level = user[0].level;
    return res.render("member/index.ejs", { level, cskh });
}
const aboutPage = async (req, res) => {
    return res.render("member/about/index.ejs");
}

const recordsalary = async (req, res) => {
    return res.render("member/about/recordsalary.ejs");
}

const privacyPolicy = async (req, res) => {
    return res.render("member/about/privacyPolicy.ejs");
}

const newtutorial = async (req, res) => {
    return res.render("member/newtutorial.ejs");
}

const forgot = async (req, res) => {
    let auth = req.cookies.auth;
    const [user] = await connection.query('SELECT `time_otp` FROM users WHERE token = ? ', [auth]);
    let time = user[0].time_otp;
    return res.render("member/forgot.ejs", { time });
}

const redenvelopes = async (req, res) => {
    return res.render("member/redenvelopes.ejs");
}

const riskAgreement = async (req, res) => {
    return res.render("member/about/riskAgreement.ejs");
}

const myProfilePage = async (req, res) => {
    return res.render("member/myProfile.ejs");
}

const safeQuery = async (sql, params = []) => {
    try {
        const [rows] = await connection.query(sql, params);
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.warn('Transaction record query skipped:', error.message);
        return [];
    }
}

const getPhoneFilter = (phone, column = 'phone') => {
    const fullPhone = String(phone || '').trim();
    const digitsOnly = fullPhone.replace(/\D/g, '');
    const lastTenDigits = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
    const clauses = [`${column} = ?`];
    const params = [fullPhone];

    if (digitsOnly && digitsOnly !== fullPhone) {
        clauses.push(`${column} = ?`);
        params.push(digitsOnly);
    }

    if (lastTenDigits && lastTenDigits !== fullPhone && lastTenDigits !== digitsOnly) {
        clauses.push(`${column} = ?`, `CAST(${column} AS CHAR) LIKE ?`);
        params.push(lastTenDigits, `%${lastTenDigits}`);
    }

    return {
        clause: `(${clauses.join(' OR ')})`,
        params,
    };
}

const toNumber = (...values) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

const getTransactionTime = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (value instanceof Date) return value.getTime();
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric > 100000000000 ? numeric : numeric * 1000;
        }
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
}

const formatTransactionTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const getStatusLabel = (status, fallback = 'Complete') => {
    if (typeof status === 'string') {
        const normalized = status.toLowerCase();
        if (normalized === 'active') return 'Active';
        if (normalized === 'withdrawn' || normalized === 'complete' || normalized === 'completed') return 'Complete';
        if (normalized === 'pending' || normalized === 'waiting') return 'Pending';
        if (normalized === 'failed' || normalized === 'rejected') return 'Failed';
    }

    const numericStatus = Number(status);
    if (numericStatus === 0) return 'Pending';
    if (numericStatus === 1) return 'Complete';
    if (numericStatus === 2) return 'Failed';
    return fallback;
}

const addTransaction = (records, payload) => {
    const timestamp = getTransactionTime(payload.time, payload.today, payload.created_at, payload.createdAt);
    const amount = Math.abs(toNumber(payload.amount));
    if (!amount && !payload.allowZero) return;

    records.push({
        id: payload.id || `${payload.title}-${timestamp}-${records.length}`,
        title: payload.title || 'Transaction',
        type: payload.type || payload.title || 'Transaction',
        amount,
        direction: payload.direction || 'credit',
        status: payload.status || 'Complete',
        time: formatTransactionTime(timestamp),
        timestamp,
        orderId: payload.orderId || '',
        description: payload.description || '',
    });
}

const getSalaryRecord = async (req, res) => {
    const auth = req.cookies.auth;

    const [rows] = await connection.query(`SELECT * FROM users WHERE token = ?`, [auth]);
    const user = rows[0];
    if (!user) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
            rows: [],
        });
    }

    const phoneFilter = getPhoneFilter(user.phone);
    const records = [];

    const recharges = await safeQuery(
        `SELECT * FROM recharge WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`,
        phoneFilter.params
    );
    recharges.forEach((item) => {
        addTransaction(records, {
            id: `recharge-${item.id || item.id_order || item.transaction_id}`,
            title: 'Deposit',
            type: item.method || item.type || 'Recharge',
            amount: item.money,
            direction: 'credit',
            status: getStatusLabel(item.status),
            time: item.time,
            today: item.today,
            orderId: item.id_order || item.transaction_id || item.utr,
            description: item.utr ? `UTR: ${item.utr}` : '',
        });
    });

    const withdrawals = await safeQuery(
        `SELECT * FROM withdraw WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`,
        phoneFilter.params
    );
    withdrawals.forEach((item) => {
        addTransaction(records, {
            id: `withdraw-${item.id || item.id_order}`,
            title: 'Withdraw',
            type: item.tp || item.type || 'Withdrawal',
            amount: item.money,
            direction: 'debit',
            status: getStatusLabel(item.status),
            time: item.time,
            today: item.today,
            orderId: item.id_order || item.id || '',
            description: item.name_bank || item.ifsc || '',
        });
    });

    const sentTransferFilter = getPhoneFilter(user.phone, 'sender_phone');
    const sentTransfers = await safeQuery(
        `SELECT * FROM balance_transfer WHERE ${sentTransferFilter.clause} ORDER BY id DESC LIMIT 200`,
        sentTransferFilter.params
    );
    sentTransfers.forEach((item) => {
        addTransaction(records, {
            id: `transfer-sent-${item.id}`,
            title: 'Balance Transfer Sent',
            type: 'Account Transfer',
            amount: item.amount,
            direction: 'debit',
            status: 'Complete',
            time: item.time,
            orderId: item.id,
            description: item.receiver_phone ? `To: ${item.receiver_phone}` : item.remark || '',
        });
    });

    const receivedTransferFilter = getPhoneFilter(user.phone, 'receiver_phone');
    const receivedTransfers = await safeQuery(
        `SELECT * FROM balance_transfer WHERE ${receivedTransferFilter.clause} ORDER BY id DESC LIMIT 200`,
        receivedTransferFilter.params
    );
    receivedTransfers.forEach((item) => {
        addTransaction(records, {
            id: `transfer-received-${item.id}`,
            title: 'Balance Transfer Received',
            type: 'Account Transfer',
            amount: item.amount,
            direction: 'credit',
            status: 'Complete',
            time: item.time,
            orderId: item.id,
            description: item.sender_phone ? `From: ${item.sender_phone}` : item.remark || '',
        });
    });

    const salaryRows = await safeQuery(
        `SELECT * FROM salary WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`,
        phoneFilter.params
    );
    salaryRows.forEach((item) => {
        addTransaction(records, {
            id: `salary-${item.id || item.time}`,
            title: 'Bonus',
            type: item.type || 'Salary Bonus',
            amount: item.amount,
            direction: 'credit',
            status: 'Complete',
            time: item.time,
            description: item.phone ? `Account: ${item.phone}` : '',
        });
    });

    const redeemFilter = getPhoneFilter(user.phone, 'phone_used');
    const redeemRows = await safeQuery(
        `SELECT * FROM redenvelopes_used WHERE ${redeemFilter.clause} ORDER BY id DESC LIMIT 200`,
        redeemFilter.params
    );
    redeemRows.forEach((item) => {
        addTransaction(records, {
            id: `redeem-${item.id || item.id_redenvelops || item.id_redenvelope}`,
            title: 'Redeem Code',
            type: 'Gift Code Reward',
            amount: item.money,
            direction: 'credit',
            status: 'Complete',
            time: item.time,
            orderId: item.id_redenvelops || item.id_redenvelope || '',
            description: item.phone ? `Code owner: ${item.phone}` : '',
        });
    });

    const referralIncome = await safeQuery(
        `SELECT * FROM referral_level_income WHERE ${getPhoneFilter(user.phone, 'to_phone').clause} ORDER BY id DESC LIMIT 200`,
        getPhoneFilter(user.phone, 'to_phone').params
    );
    referralIncome.forEach((item) => {
        addTransaction(records, {
            id: `level-income-${item.id || item.transaction_id}`,
            title: `Level ${item.level_no} Income`,
            type: 'Copy Gaming Commission',
            amount: item.income_amount,
            direction: 'credit',
            status: getStatusLabel(item.status),
            time: item.created_at,
            orderId: item.transaction_id,
            description: `${toNumber(item.percentage)}% from ${item.from_phone || 'referral'} on ₹${toNumber(item.package_amount).toFixed(2)}`,
        });
    });

    const gameReferralIncome = await safeQuery(
        `SELECT * FROM roses WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`,
        phoneFilter.params
    );
    gameReferralIncome.forEach((item) => {
        addTransaction(records, {
            id: `game-referral-${item.id || item.time}`,
            title: 'Referral Income',
            type: 'Game Referral Commission',
            amount: toNumber(item.f1, item.f2, item.f3, item.f4),
            direction: 'credit',
            status: 'Complete',
            time: item.time,
            description: item.invite ? `Invite: ${item.invite}` : '',
        });
    });

    const copyGaming = await safeQuery(
        `SELECT * FROM fixed_deposits WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`,
        phoneFilter.params
    );
    copyGaming.forEach((item) => {
        addTransaction(records, {
            id: `copy-gaming-in-${item.id}`,
            title: 'Copy Gaming Transfer In',
            type: `${item.tenure_days || ''} days Staking`,
            amount: item.amount,
            direction: 'debit',
            status: item.status === 'withdrawn' ? 'Complete' : getStatusLabel(item.status, 'Active'),
            time: item.created_at || item.start_time,
            orderId: item.id,
            description: `Daily interest ${toNumber(item.daily_rate)}%`,
        });

        if (item.status === 'withdrawn' || Number(item.withdrawn_time) > 0) {
            addTransaction(records, {
                id: `copy-gaming-out-${item.id}`,
                title: 'Copy Gaming Transfer Out',
                type: 'Maturity Payout',
                amount: item.maturity_amount,
                direction: 'credit',
                status: 'Complete',
                time: item.withdrawn_time,
                orderId: item.id,
                description: `Payout income ₹${toNumber(item.total_interest).toFixed(2)}`,
            });
        }
    });

    const addGameRecords = (rows, gameName) => {
        rows.forEach((item) => {
            const betAmount = toNumber(item.money, Number(item.price) * Number(item.amount));
            addTransaction(records, {
                id: `${gameName}-bet-${item.id || item.id_product}`,
                title: `${gameName} Bet`,
                type: item.typeGame || item.game || 'Game Bet',
                amount: betAmount,
                direction: 'debit',
                status: getStatusLabel(item.status),
                time: item.time,
                today: item.today,
                orderId: item.id_product || item.stage || item.id,
                description: item.bet ? `Bet: ${item.bet}` : '',
            });

            const winAmount = toNumber(item.get);
            if (Number(item.status) === 1 && winAmount > 0) {
                addTransaction(records, {
                    id: `${gameName}-win-${item.id || item.id_product}`,
                    title: `${gameName} Win`,
                    type: 'Game Payout',
                    amount: winAmount,
                    direction: 'credit',
                    status: 'Complete',
                    time: item.time,
                    today: item.today,
                    orderId: item.id_product || item.stage || item.id,
                    description: item.result !== undefined ? `Result: ${item.result}` : '',
                });
            }
        });
    }

    addGameRecords(await safeQuery(`SELECT * FROM minutes_1 WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`, phoneFilter.params), 'Wingo');
    addGameRecords(await safeQuery(`SELECT * FROM result_5d WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`, phoneFilter.params), '5D');
    addGameRecords(await safeQuery(`SELECT * FROM result_k3 WHERE ${phoneFilter.clause} ORDER BY id DESC LIMIT 200`, phoneFilter.params), 'K3');

    records.sort((left, right) => right.timestamp - left.timestamp);

    return res.status(200).json({
        message: 'Success',
        status: true,
        data: {},
        rows: records.slice(0, 300),
    })
}
export default {
    homePage,
    checkInPage,
    promotionPage,
    walletPage,
    mianPage,
    myProfilePage,
    promotionmyTeamPage,
    promotionDesPage,
    tutorialPage,
    bonusRecordPage,
    rechargePage,
    rechargerecordPage,
    withdrawalPage,
    withdrawalrecordPage,
    aboutPage,
    privacyPolicy,
    riskAgreement,
    newtutorial,
    redenvelopes,
    forgot,
    checkDes,
    checkRecord,
    addBank,
    transfer,
    recordsalary,
    getSalaryRecord,
}
