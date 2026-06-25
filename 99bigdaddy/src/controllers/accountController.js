import connection from "../config/connectDB.js";
import jwt from 'jsonwebtoken';
import md5 from "md5";
import request from 'request';
import e from "express";
import dotenv from 'dotenv';
dotenv.config();

let timeNow = Date.now();


const randomString = (length) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}


const randomNumber = (min, max) => {
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

const isNumber = (params) => {
    let pattern = /^[0-9]*\d$/;
    return pattern.test(params);
}

const cleanPhoneNumber = (phone) => String(phone || '').replace(/\D/g, '');
const normalizeInviteCode = (code) => String(code || '').trim();
const tableColumnsCache = new Map();

const isInternationalPhoneNumber = (phone) => {
    return /^[1-9]\d{7,18}$/.test(phone);
}

const generateUniqueReferralCode = async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
        const code = randomString(5) + randomNumber(10000, 99999);
        const [rows] = await connection.query('SELECT id FROM users WHERE code = ? LIMIT 1', [code]);
        if (!rows.length) {
            return code;
        }
    }
    throw new Error('Unable to generate unique invite code');
}

const getLastTenDigits = (phone) => {
    const digits = cleanPhoneNumber(phone);
    return digits.length > 10 ? digits.slice(-10) : digits;
}

const getTableColumns = async (tableName) => {
    if (tableColumnsCache.has(tableName)) {
        return tableColumnsCache.get(tableName);
    }

    try {
        const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
        const columns = new Set(rows.map((row) => row.Field));
        tableColumnsCache.set(tableName, columns);
        return columns;
    } catch (error) {
        return null;
    }
}

const pickExistingEntries = (columns, values) => {
    if (!columns) {
        return [];
    }

    return Object.entries(values).filter(([key, value]) => columns.has(key) && value !== undefined);
}

const insertDynamicRow = async (tableName, values) => {
    const columns = await getTableColumns(tableName);
    const entries = pickExistingEntries(columns, values);

    if (!entries.length) {
        throw new Error(`No compatible columns found for ${tableName}`);
    }

    const fields = entries.map(([key]) => `\`${key}\``).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const params = entries.map(([, value]) => value);

    await connection.execute(
        `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
        params
    );
}

const updateDynamicRowByPhone = async (tableName, phone, values) => {
    const columns = await getTableColumns(tableName);
    const entries = pickExistingEntries(columns, values);

    if (!entries.length) {
        throw new Error(`No compatible columns found for ${tableName}`);
    }

    const assignments = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
    const params = entries.map(([, value]) => value);

    await connection.execute(
        `UPDATE \`${tableName}\` SET ${assignments} WHERE phone = ?`,
        [...params, phone]
    );
}

const findUserByPhoneAndPassword = async (phone, passwordHash) => {
    const [exactRows] = await connection.query(
        'SELECT * FROM users WHERE phone = ? AND password = ? ',
        [phone, passwordHash]
    );

    if (exactRows.length > 0) {
        return exactRows;
    }

    const lastTenDigits = getLastTenDigits(phone);
    if (!lastTenDigits || lastTenDigits === phone) {
        const [suffixRows] = await connection.query(
            'SELECT * FROM users WHERE phone LIKE ? AND password = ? ORDER BY id DESC LIMIT 2 ',
            [`%${lastTenDigits}`, passwordHash]
        );

        return suffixRows;
    }

    const [fallbackRows] = await connection.query(
        'SELECT * FROM users WHERE phone = ? AND password = ? ',
        [lastTenDigits, passwordHash]
    );

    if (fallbackRows.length > 0) {
        return fallbackRows;
    }

    const [suffixRows] = await connection.query(
        'SELECT * FROM users WHERE phone LIKE ? AND password = ? ORDER BY id DESC LIMIT 2 ',
        [`%${lastTenDigits}`, passwordHash]
    );

    return suffixRows;
}

const insertRegisteredUser = async ({
    id_user,
    username,
    name_user,
    pwd,
    code,
    invitecode,
    ctv,
    otp2,
    ip,
    time
}) => {
    const dynamicValues = {
        id_user,
        phone: username,
        name_user,
        password: md5(pwd),
        plain_password: pwd,
        money: 0,
        total_money: 0,
        code,
        invite: invitecode,
        ctv,
        veri: 1,
        otp: otp2,
        ip: ip,
        ip_address: ip,
        status: 1,
        time,
        time_otp: 0,
        free_bonus: 500,
        first_deposit: 0,
        level: 0,
        user_level: 0,
    };

    try {
        await insertDynamicRow('users', dynamicValues);
        return;
    } catch (error) {
    }

    const insertAttempts = [
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, plain_password = ?, money = ?,code = ?,invite = ?,ctv = ?,veri = ?,otp = ?,ip_address = ?,status = ?,time = ?, free_bonus = ?, first_deposit = ?",
            params: [id_user, username, name_user, md5(pwd), pwd, 0, code, invitecode, ctv, 1, otp2, ip, 1, time, 500, 0]
        },
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, plain_password = ?, money = ?,code = ?,invite = ?,veri = ?,otp = ?,ip_address = ?,status = ?,time = ?",
            params: [id_user, username, name_user, md5(pwd), pwd, 0, code, invitecode, 1, otp2, ip, 1, time]
        },
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, money = ?,code = ?,invite = ?,veri = ?,otp = ?,ip_address = ?,status = ?,time = ?",
            params: [id_user, username, name_user, md5(pwd), 0, code, invitecode, 1, otp2, ip, 1, time]
        },
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, plain_password = ?, money = ?,code = ?,invite = ?,ctv = ?,veri = ?,ip_address = ?,status = ?,time = ?, free_bonus = ?, first_deposit = ?",
            params: [id_user, username, name_user, md5(pwd), pwd, 0, code, invitecode, ctv, 1, ip, 1, time, 500, 0]
        },
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, plain_password = ?, money = ?,code = ?,invite = ?,veri = ?,ip_address = ?,status = ?,time = ?",
            params: [id_user, username, name_user, md5(pwd), pwd, 0, code, invitecode, 1, ip, 1, time]
        },
        {
            sql: "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?, money = ?,code = ?,invite = ?,veri = ?,ip_address = ?,status = ?,time = ?",
            params: [id_user, username, name_user, md5(pwd), 0, code, invitecode, 1, ip, 1, time]
        }
    ];

    let lastError;

    for (const attempt of insertAttempts) {
        try {
            await connection.execute(attempt.sql, attempt.params);
            return;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

const updateRegisteredUserDraft = async ({
    username,
    name_user,
    pwd,
    code,
    invitecode,
    ctv,
    otp2,
    ip,
    time
}) => {
    const dynamicValues = {
        name_user,
        password: md5(pwd),
        plain_password: pwd,
        money: 0,
        code,
        invite: invitecode,
        ctv,
        veri: 1,
        otp: otp2,
        ip: ip,
        ip_address: ip,
        status: 1,
        time,
        time_otp: 0,
        free_bonus: 500,
        first_deposit: 0,
    };

    try {
        await updateDynamicRowByPhone('users', username, dynamicValues);
        return;
    } catch (error) {
    }

    const updateAttempts = [
        {
            sql: "UPDATE users SET name_user = ?, password = ?, plain_password = ?, money = ?, code = ?, invite = ?, ctv = ?, veri = ?, otp = ?, ip_address = ?, status = ?, time = ?, free_bonus = ?, first_deposit = ? WHERE phone = ?",
            params: [name_user, md5(pwd), pwd, 0, code, invitecode, ctv, 1, otp2, ip, 1, time, 500, 0, username]
        },
        {
            sql: "UPDATE users SET name_user = ?, password = ?, plain_password = ?, money = ?, code = ?, invite = ?, veri = ?, otp = ?, ip_address = ?, status = ?, time = ? WHERE phone = ?",
            params: [name_user, md5(pwd), pwd, 0, code, invitecode, 1, otp2, ip, 1, time, username]
        },
        {
            sql: "UPDATE users SET name_user = ?, password = ?, money = ?, code = ?, invite = ?, veri = ?, otp = ?, ip_address = ?, status = ?, time = ? WHERE phone = ?",
            params: [name_user, md5(pwd), 0, code, invitecode, 1, otp2, ip, 1, time, username]
        },
        {
            sql: "UPDATE users SET name_user = ?, password = ?, plain_password = ?, money = ?, code = ?, invite = ?, ctv = ?, veri = ?, ip_address = ?, status = ?, time = ?, free_bonus = ?, first_deposit = ? WHERE phone = ?",
            params: [name_user, md5(pwd), pwd, 0, code, invitecode, ctv, 1, ip, 1, time, 500, 0, username]
        },
        {
            sql: "UPDATE users SET name_user = ?, password = ?, plain_password = ?, money = ?, code = ?, invite = ?, veri = ?, ip_address = ?, status = ?, time = ? WHERE phone = ?",
            params: [name_user, md5(pwd), pwd, 0, code, invitecode, 1, ip, 1, time, username]
        },
        {
            sql: "UPDATE users SET name_user = ?, password = ?, money = ?, code = ?, invite = ?, veri = ?, ip_address = ?, status = ?, time = ? WHERE phone = ?",
            params: [name_user, md5(pwd), 0, code, invitecode, 1, ip, 1, time, username]
        }
    ];

    let lastError;

    for (const attempt of updateAttempts) {
        try {
            await connection.execute(attempt.sql, attempt.params);
            return;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

const ensurePointListEntry = async (phone) => {
    try {
        const [existingRows] = await connection.query('SELECT phone FROM point_list WHERE phone = ? LIMIT 1', [phone]);
        if (existingRows.length > 0) {
            return;
        }

        await insertDynamicRow('point_list', {
            phone,
            money: 0,
            money_us: 0,
            level: 0,
            total1: 0,
            total2: 0,
            total3: 0,
            total4: 0,
            total5: 0,
            total6: 0,
            total7: 0,
            telegram: '',
            time: Date.now(),
        });
        return;
    } catch (error) {
    }

    const insertAttempts = [
        {
            sql: 'INSERT INTO point_list SET phone = ?',
            params: [phone]
        },
        {
            sql: 'INSERT INTO point_list (phone, money, money_us) VALUES (?, ?, ?)',
            params: [phone, 0, 0]
        },
        {
            sql: 'INSERT INTO point_list (phone, money, money_us, time) VALUES (?, ?, ?, ?)',
            params: [phone, 0, 0, Date.now()]
        }
    ];

    for (const attempt of insertAttempts) {
        try {
            await connection.execute(attempt.sql, attempt.params);
            return;
        } catch (error) {
            if (error?.code === 'ER_DUP_ENTRY') {
                return;
            }
        }
    }
}

const ensureBootstrapInviteCode = async (invitecode) => {
    if (invitecode !== 'BOOTSTRAP01') {
        return;
    }

    const [existingRows] = await connection.query('SELECT phone FROM users WHERE code = ? LIMIT 1', [invitecode]);
    if (existingRows.length > 0) {
        return;
    }

    const bootstrapPhone = '1000000001';
    const bootstrapValues = {
        id_user: randomNumber(10000, 99999),
        phone: bootstrapPhone,
        name_user: 'Admin',
        password: md5('admin123'),
        plain_password: 'admin123',
        money: 0,
        total_money: 0,
        code: invitecode,
        invite: invitecode,
        ctv: '',
        veri: 1,
        otp: randomNumber(100000, 999999),
        ip: '127.0.0.1',
        ip_address: '127.0.0.1',
        status: 1,
        time: Date.now(),
        time_otp: 0,
        free_bonus: 0,
        first_deposit: 0,
        level: 0,
        user_level: 0,
    };

    try {
        await insertDynamicRow('users', bootstrapValues);
        await ensurePointListEntry(bootstrapPhone);
    } catch (error) {
    }
}

const ipAddress = (req) => {
    let ip = '';
    if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(",")[0];
    } else if (req.connection && req.connection.remoteAddress) {
        ip = req.connection.remoteAddress;
    } else {
        ip = req.ip;
    }
    return ip;
}

const timeCreate = () => {
    const d = new Date();
    const time = d.getTime();
    return time;
}

const loginPage = async (req, res) => {
    return res.render("account/login.ejs");
}

const registerPage = async (req, res) => {
    return res.render("account/register.ejs");
}

const forgotPage = async (req, res) => {
    return res.render("account/forgot.ejs");
}

const login = async (req, res) => {
    let { username, pwd } = req.body;
    username = cleanPhoneNumber(username);

    if (!username || !pwd || !username) {//!isNumber(username)
        return res.status(200).json({
            message: 'ERROR!!!'
        });
    }

    try {
        const rows = await findUserByPhoneAndPassword(username, md5(pwd));
        if (rows.length == 1) {
            if (rows[0].status == 1) {
                const { password, money, ip, veri, ip_address, status, time, ...others } = rows[0];
                const accessToken = jwt.sign({
                    user: { ...others },
                    timeNow: timeNow
                }, process.env.JWT_ACCESS_TOKEN, { expiresIn: "1d" });
                const authToken = md5(accessToken);
                await connection.execute('UPDATE `users` SET `token` = ? WHERE `phone` = ? ', [authToken, rows[0].phone]);
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
                res.setHeader('Set-Cookie', [
                    `token=${encodeURIComponent(accessToken)}; Expires=${expiresAt}; Max-Age=86400; Path=/; SameSite=Lax`,
                    `auth=${authToken}; Expires=${expiresAt}; Max-Age=86400; Path=/; SameSite=Lax`
                ]);
                return res.status(200).json({
                    message: 'Login Successfully!',
                    status: true,
                    token: accessToken,
                    value: authToken
                });
            } else {
                return res.status(200).json({
                    message: 'Account has been locked',
                    status: false
                });
            }
        } else {
            return res.status(200).json({
                message: 'Incorrect Username or Password',
                status: false
            });
        }
    } catch (error) {
        if (error) console.log(error);
        return res.status(200).json({
            message: 'Login failed. Please try again.',
            status: false
        });
    }

}

const register = async (req, res) => {
    let now = new Date().getTime();
    let { username, pwd, invitecode } = req.body;
    username = cleanPhoneNumber(username);
    invitecode = normalizeInviteCode(invitecode);
    let id_user = randomNumber(10000, 99999);
    let otp2 = randomNumber(100000, 999999);
    let name_user = "Member" + randomNumber(10000, 99999);
    let code = '';
    let ip = ipAddress(req);
    let time = timeCreate();

    if (!username || !pwd || !invitecode) {
        return res.status(200).json({
            message: 'ERROR!!!',
            status: false
        });
    }

    if (!isInternationalPhoneNumber(username)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    try {
        await ensureBootstrapInviteCode(invitecode);
        const [check_u] = await connection.query('SELECT * FROM users WHERE phone = ?', [username]);
        const [check_i] = await connection.query('SELECT * FROM users WHERE code = ? ', [invitecode]);
        const [check_ip] = await connection.query('SELECT * FROM users WHERE ip_address = ? ', [ip]);

        if (check_u.length == 1 && check_u[0].veri == 1) {
            return res.status(200).json({
                message: 'Registered phone number',
                status: false
            });
        } else {
            if (check_i.length == 1) {
                if (String(check_i[0].phone || '') === String(username || '')) {
                    return res.status(200).json({
                        message: 'Self referral is not allowed',
                        status: false
                    });
                }
                code = await generateUniqueReferralCode();
                // if (check_ip.length <= 3) {
                let ctv = '';
                if (check_i[0].level == 2) {
                    ctv = check_i[0].phone;
                } else {
                    ctv = check_i[0].ctv;
                }
                if (check_u.length >= 1) {
                    await updateRegisteredUserDraft({
                        username,
                        name_user,
                        pwd,
                        code,
                        invitecode,
                        ctv,
                        otp2,
                        ip,
                        time
                    });
                } else {
                    await insertRegisteredUser({
                        id_user,
                        username,
                        name_user,
                        pwd,
                        code,
                        invitecode,
                        ctv,
                        otp2,
                        ip,
                        time
                    });
                }
                await ensurePointListEntry(username);

                let [check_code] = await connection.query('SELECT * FROM users WHERE invite = ? ', [invitecode]);

                if (check_i[0].name_user !== 'Admin') {
                    let levels = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44];

                    for (let i = 0; i < levels.length; i++) {
                        if (check_code.length >= levels[i]) {
                            await connection.execute('UPDATE users SET user_level = ? WHERE code = ?', [i + 1, invitecode]);
                        } else {
                            break;
                        }
                    }
                }


                return res.status(200).json({
                    message: "Registered successfully",
                    status: true
                });

                // } else {
                //     return res.status(200).json({
                //         message: 'Registered IP address',
                //         status: false
                //     });
                // }
            } else {
                return res.status(200).json({
                    message: 'Referrer code does not exist',
                    status: false
                });
            }
        }
    } catch (error) {
        if (error) console.log(error);
        return res.status(200).json({
            message: error?.message || 'Registration failed',
            status: false
        });
    }

}

const verifyCode = async (req, res) => {
    let phone = cleanPhoneNumber(req.body.phone);
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp = randomNumber(100000, 999999);

    if (!isInternationalPhoneNumber(phone)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ?', [phone]);
    if (rows.length == 0) {
        await request(`http://47.243.168.18:9090/sms/batch/v2?appkey=NFJKdK&appsecret=brwkTw&phone=${phone}&msg=Your verification code is ${otp}&extend=${now}`, async (error, response, body) => {
            let data = JSON.parse(body);
            if (data.code == '00000') {
                await connection.execute("INSERT INTO users SET phone = ?, otp = ?, veri = 0, time_otp = ? ", [phone, otp, timeEnd]);
                return res.status(200).json({
                    message: 'Submitted successfully',
                    status: true,
                    timeStamp: timeNow,
                    timeEnd: timeEnd,
                });
            }
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now <= 0) {
            request(`http://47.243.168.18:9090/sms/batch/v2?appkey=NFJKdK&appsecret=brwkTw&phone=${phone}&msg=Your verification code is ${otp}&extend=${now}`, async (error, response, body) => {
                let data = JSON.parse(body);
                if (data.code == '00000') {
                    await connection.execute("UPDATE users SET otp = ?, time_otp = ? WHERE phone = ? ", [otp, timeEnd, phone]);
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
                message: 'Send SMS regularly',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}

const verifyCodePass = async (req, res) => {
    let phone = cleanPhoneNumber(req.body.phone);
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp = randomNumber(100000, 999999);

    if (!isInternationalPhoneNumber(phone)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ? AND veri = 1', [phone]);
    if (rows.length == 0) {
        return res.status(200).json({
            message: 'Account does not exist',
            status: false,
            timeStamp: timeNow,
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now <= 0) {
            request(`http://47.243.168.18:9090/sms/batch/v2?appkey=NFJKdK&appsecret=brwkTw&phone=${phone}&msg=Your verification code is ${otp}&extend=${now}`, async (error, response, body) => {
                let data = JSON.parse(body);
                if (data.code == '00000') {
                    await connection.execute("UPDATE users SET otp = ?, time_otp = ? WHERE phone = ? ", [otp, timeEnd, phone]);
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
                message: 'Send SMS regularly',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}

const forGotPassword = async (req, res) => {
    let username = cleanPhoneNumber(req.body.username);
    let otp = req.body.otp;
    let pwd = req.body.pwd;
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp2 = randomNumber(100000, 999999);

    if (!isInternationalPhoneNumber(username)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ? AND veri = 1', [username]);
    if (rows.length == 0) {
        return res.status(200).json({
            message: 'Account does not exist',
            status: false,
            timeStamp: timeNow,
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now > 0) {
            if (user.otp == otp) {
                await connection.execute("UPDATE users SET password = ?, otp = ?, time_otp = ? WHERE phone = ? ", [md5(pwd), otp2, timeEnd, username]);
                return res.status(200).json({
                    message: 'Change password successfully',
                    status: true,
                    timeStamp: timeNow,
                    timeEnd: timeEnd,
                });
            } else {
                return res.status(200).json({
                    message: 'OTP code is incorrect',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        } else {
            return res.status(200).json({
                message: 'OTP code has expired',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}

const keFuMenu = async (req, res) => {
    let auth = req.cookies.auth;

    const [users] = await connection.query('SELECT `level`, `ctv` FROM users WHERE token = ?', [auth]);

    let telegram = '';
    if (users.length == 0) {
        let [settings] = await connection.query('SELECT `telegram`, `cskh` FROM admin');
        telegram = settings[0].telegram;
    } else {
        if (users[0].level != 0) {
            var [settings] = await connection.query('SELECT * FROM admin');
        } else {
            var [check] = await connection.query('SELECT `telegram` FROM point_list WHERE phone = ?', [users[0].ctv]);
            if (check.length == 0) {
                var [settings] = await connection.query('SELECT * FROM admin');
            } else {
                var [settings] = await connection.query('SELECT `telegram` FROM point_list WHERE phone = ?', [users[0].ctv]);
            }
        }
        telegram = settings[0].telegram;
    }

    return res.render("keFuMenu.ejs", { telegram });
}


export default {
    login,
    register,
    loginPage,
    registerPage,
    forgotPage,
    verifyCode,
    verifyCodePass,
    forGotPassword,
    keFuMenu
}
