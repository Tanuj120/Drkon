//const mysql = require('mysql2/promise');
import mysql from "mysql2/promise";
import md5 from "md5";

// const connection = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'lawra',
// });
const dbConfig = {
  host:
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    process.env.DATABASE_HOST ||
    "localhost",
  user:
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    process.env.DATABASE_USER ||
    "",
  password:
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    process.env.DATABASE_PASSWORD ||
    "",
  database:
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    process.env.DATABASE_NAME ||
    "",
  port: Number(
    process.env.MYSQLPORT ||
      process.env.DB_PORT ||
      process.env.DATABASE_PORT ||
      3306,
  ),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
};

const _SKIP_DB = (process.env.SKIP_DB || "").toString().trim().toLowerCase();
console.log("[debug] connectDB SKIP_DB=", _SKIP_DB, "DB_USER=", dbConfig.user);

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const phoneMatches = (storedPhone, inputPhone) => {
  const stored = normalizePhone(storedPhone);
  const input = normalizePhone(inputPhone);
  return stored === input || input.endsWith(stored) || stored.endsWith(input);
};

const pickFields = (row, sql) => {
  if (!row) return row;
  const match = sql.match(/select\s+(.+?)\s+from\s+/i);
  if (!match) return clone(row);
  const fields = match[1].trim();
  if (fields === "*") return clone(row);

  return fields
    .split(",")
    .map((field) => field.replace(/[`"' ]/g, "").trim())
    .filter(Boolean)
    .reduce((result, field) => {
      result[field] = row[field];
      return result;
    }, {});
};

const createMockConnection = () => {
  const seededPhone = "8972182034";
  const seededPassword = "qwert";
  const users = [
    {
      id: 1,
      id_user: "10001",
      phone: "1000000001",
      name_user: "Admin",
      password: md5("admin123"),
      plain_password: "admin123",
      money: 0,
      total_money: 0,
      code: "BOOTSTRAP01",
      invite: "BOOTSTRAP01",
      ctv: "",
      veri: 1,
      otp: "123456",
      ip_address: "127.0.0.1",
      status: 1,
      time: Date.now(),
      token: "",
      level: 0,
      user_level: 0,
      free_bonus: 0,
      first_deposit: 0,
      roses_f: 0,
      roses_f1: 0,
      roses_today: 0,
      recharge: 0,
    },
    {
      id: 2,
      id_user: "89721",
      phone: seededPhone,
      name_user: "Member89721",
      password: md5(seededPassword),
      plain_password: seededPassword,
      money: 1000,
      total_money: 1000,
      code: "LOCAL89721",
      invite: "BOOTSTRAP01",
      ctv: "",
      veri: 1,
      otp: "123456",
      ip_address: "127.0.0.1",
      status: 1,
      time: Date.now(),
      token: "",
      level: 0,
      user_level: 0,
      free_bonus: 500,
      first_deposit: 0,
      roses_f: 0,
      roses_f1: 0,
      roses_today: 0,
      recharge: 0,
    },
  ];
  const pointLists = [
    {
      phone: "1000000001",
      money: 0,
      money_us: 0,
      telegram: "",
    },
    {
      phone: seededPhone,
      money: 0,
      money_us: 0,
      telegram: "",
    },
  ];
  const adminRows = [
    {
      id: 1,
      app: "Drakon",
      telegram: "",
      cskh: "",
    },
  ];
  const recharges = [];
  const withdraws = [];
  const fixedDeposits = [];

  const selectUsers = (sql, params = []) => {
    let rows = users;
    if (/where\s+phone\s*=\s*\?\s+and\s+password\s*=\s*\?/i.test(sql)) {
      const [phone, password] = params;
      rows = users.filter(
        (user) => phoneMatches(user.phone, phone) && user.password === password,
      );
    } else if (/where\s+token\s*=\s*\?\s+and\s+password\s*=\s*\?/i.test(sql)) {
      const [token, password] = params;
      rows = users.filter((user) => user.token === token && user.password === password);
    } else if (/where\s+phone\s*=\s*\?/i.test(sql)) {
      const [phone] = params;
      rows = users.filter((user) => phoneMatches(user.phone, phone));
    } else if (/where\s+token\s*=\s*\?/i.test(sql)) {
      const [token] = params;
      rows = users.filter((user) => user.token === token);
    } else if (/where\s+code\s*=\s*\?/i.test(sql)) {
      const [code] = params;
      rows = users.filter((user) => user.code === code);
    } else if (/where\s+invite\s*=\s*\?/i.test(sql)) {
      const [invite] = params;
      rows = users.filter((user) => user.invite === invite);
    } else if (/where\s+ip_address\s*=\s*\?/i.test(sql)) {
      const [ip] = params;
      rows = users.filter((user) => user.ip_address === ip);
    }
    return rows.map((row) => pickFields(row, sql));
  };

  const selectPointList = (sql, params = []) => {
    let rows = pointLists;
    if (/where\s+phone\s*=\s*\?/i.test(sql)) {
      const [phone] = params;
      rows = pointLists.filter((row) => phoneMatches(row.phone, phone));
    }
    return rows.map((row) => pickFields(row, sql));
  };

  const selectRowsByPhone = (rows = [], sql, params = []) => {
    let filtered = rows;
    if (/where\s+`?phone`?\s*=\s*\?/i.test(sql)) {
      const [phone] = params;
      filtered = rows.filter((row) => phoneMatches(row.phone, phone));
    }
    if (/where\s+`?status`?\s*=\s*\?/i.test(sql)) {
      const statusParam = params[params.length - 1];
      filtered = filtered.filter((row) => String(row.status) === String(statusParam));
    }
    return filtered.map((row) => pickFields(row, sql));
  };

  const selectFixedDeposits = (sql, params = []) => {
    let rows = fixedDeposits;
    if (/where\s+id\s*=\s*\?\s+and\s+phone\s*=\s*\?/i.test(sql)) {
      const [id, phone] = params;
      rows = fixedDeposits.filter((row) => Number(row.id) === Number(id) && phoneMatches(row.phone, phone));
    } else if (/where\s+phone\s*=\s*\?/i.test(sql)) {
      const [phone] = params;
      rows = fixedDeposits.filter((row) => phoneMatches(row.phone, phone));
    }
    return rows.map((row) => pickFields(row, sql));
  };

  const updateUsers = (sql, params = []) => {
    if (/set\s+`?token`?\s*=\s*\?\s+where\s+`?phone`?\s*=\s*\?/i.test(sql)) {
      const [token, phone] = params;
      const user = users.find((entry) => phoneMatches(entry.phone, phone));
      if (user) user.token = token;
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (/set\s+name_user\s*=\s*\?\s+where\s+`?token`?\s*=\s*\?/i.test(sql)) {
      const [nameUser, token] = params;
      const user = users.find((entry) => entry.token === token);
      if (user) user.name_user = nameUser;
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (/set\s+otp\s*=\s*\?,\s*password\s*=\s*\?\s+where\s+`?token`?\s*=\s*\?/i.test(sql)) {
      const [otp, password, token] = params;
      const user = users.find((entry) => entry.token === token);
      if (user) {
        user.otp = otp;
        user.password = password;
      }
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (/set\s+money\s*=\s*money\s*-\s*\?\s+where\s+token\s*=\s*\?/i.test(sql)) {
      const [amount, token] = params;
      const user = users.find((entry) => entry.token === token);
      if (user) user.money = Number(user.money || 0) - Number(amount || 0);
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (/set\s+money\s*=\s*money\s*\+\s*\?\s+where\s+token\s*=\s*\?/i.test(sql)) {
      const [amount, token] = params;
      const user = users.find((entry) => entry.token === token);
      if (user) user.money = Number(user.money || 0) + Number(amount || 0);
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (/update\s+users\s+set\s+name_user\s*=\s*\?,\s*password\s*=\s*\?/i.test(sql)) {
      const username = params[params.length - 1];
      const user = users.find((entry) => phoneMatches(entry.phone, username));
      if (user) {
        const [
          nameUser,
          password,
          plainPassword,
          money,
          code,
          invite,
          ctv,
          veri,
          otp,
          ipAddress,
          status,
          time,
          freeBonus,
          firstDeposit,
        ] = params.slice(0, -1);
        user.name_user = nameUser;
        user.password = password;
        if (plainPassword !== undefined) user.plain_password = plainPassword;
        if (money !== undefined) user.money = money;
        if (code !== undefined) user.code = code;
        if (invite !== undefined) user.invite = invite;
        if (ctv !== undefined) user.ctv = ctv;
        if (veri !== undefined) user.veri = veri;
        if (otp !== undefined) user.otp = otp;
        if (ipAddress !== undefined) user.ip_address = ipAddress;
        if (status !== undefined) user.status = status;
        if (time !== undefined) user.time = time;
        if (freeBonus !== undefined) user.free_bonus = freeBonus;
        if (firstDeposit !== undefined) user.first_deposit = firstDeposit;
      }
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    return [{ affectedRows: 0 }, []];
  };

  const updateFixedDeposits = (sql, params = []) => {
    if (/set\s+status\s*=\s*\?,\s*withdrawn_time\s*=\s*\?\s+where\s+id\s*=\s*\?/i.test(sql)) {
      const [status, withdrawnTime, id] = params;
      const row = fixedDeposits.find((entry) => Number(entry.id) === Number(id));
      if (row) {
        row.status = status;
        row.withdrawn_time = withdrawnTime;
      }
      return [{ affectedRows: row ? 1 : 0 }, []];
    }
    return [{ affectedRows: 0 }, []];
  };

  const insertUsers = (params = []) => {
    const [
      id_user,
      phone,
      name_user,
      password,
      plain_password,
      money,
      code,
      invite,
      ctv,
      veri,
      otp,
      ip_address,
      status,
      time,
      free_bonus,
      first_deposit,
    ] = params;

    users.push({
      id: users.length + 1,
      id_user,
      phone,
      name_user,
      password,
      plain_password,
      money,
      total_money: money,
      code,
      invite,
      ctv,
      veri,
      otp,
      ip_address,
      status,
      time,
      token: "",
      level: 0,
      user_level: 0,
      free_bonus,
      first_deposit,
      roses_f: 0,
      roses_f1: 0,
      roses_today: 0,
      recharge: 0,
    });

    return [{ affectedRows: 1, insertId: users.length }, []];
  };

  const insertPointList = (params = []) => {
    const [phone] = params;
    if (!pointLists.some((row) => row.phone === phone)) {
      pointLists.push({ phone, money: 0, money_us: 0, telegram: "" });
    }
    return [{ affectedRows: 1, insertId: pointLists.length }, []];
  };

  const insertFixedDeposit = (params = []) => {
    const [phone, amount, tenureDays, dailyRate, totalInterest, maturityAmount, status, startTime, maturityTime, withdrawnTime, createdAt] = params;
    fixedDeposits.push({
      id: fixedDeposits.length + 1,
      phone,
      amount,
      tenure_days: tenureDays,
      daily_rate: dailyRate,
      total_interest: totalInterest,
      maturity_amount: maturityAmount,
      status,
      start_time: startTime,
      maturity_time: maturityTime,
      withdrawn_time: withdrawnTime,
      created_at: createdAt,
    });
    return [{ affectedRows: 1, insertId: fixedDeposits.length }, []];
  };

  const runMockQuery = async (sql, params = []) => {
    if (/select\s+1\s*\+\s*1\s+as\s+solution/i.test(sql)) {
      return [[{ solution: 2 }], []];
    }
    if (/^\s*select/i.test(sql) && /from\s+users/i.test(sql)) {
      return [selectUsers(sql, params), []];
    }
    if (/^\s*select/i.test(sql) && /from\s+point_list/i.test(sql)) {
      return [selectPointList(sql, params), []];
    }
    if (/^\s*select/i.test(sql) && /from\s+recharge/i.test(sql)) {
      return [selectRowsByPhone(recharges, sql, params), []];
    }
    if (/^\s*select/i.test(sql) && /from\s+withdraw/i.test(sql)) {
      return [selectRowsByPhone(withdraws, sql, params), []];
    }
    if (/^\s*select/i.test(sql) && /from\s+fixed_deposits/i.test(sql)) {
      return [selectFixedDeposits(sql, params), []];
    }
    if (/^\s*select/i.test(sql) && /from\s+admin/i.test(sql)) {
      return [adminRows.map((row) => pickFields(row, sql)), []];
    }
    if (/^\s*update\s+`?users`?/i.test(sql)) {
      return updateUsers(sql, params);
    }
    if (/^\s*update\s+fixed_deposits/i.test(sql)) {
      return updateFixedDeposits(sql, params);
    }
    if (/^\s*insert\s+into\s+users/i.test(sql)) {
      return insertUsers(params);
    }
    if (/^\s*insert\s+into\s+point_list/i.test(sql)) {
      return insertPointList(params);
    }
    if (/^\s*insert\s+into\s+fixed_deposits/i.test(sql)) {
      return insertFixedDeposit(params);
    }
    return [[], []];
  };

  return {
    query: async (sql, params = []) => runMockQuery(sql, params),
    execute: async (sql, params = []) => runMockQuery(sql, params),
    getConnection: async () => ({ release: () => {} }),
    end: async () => {},
  };
};

let connection;
if (_SKIP_DB === "true") {
  console.warn(
    "[dev] SKIP_DB is true - using mock DB connection (no MySQL operations will run)",
  );
  connection = createMockConnection();
} else {
  connection = mysql.createPool(dbConfig);
}

async function testConnection() {
  try {
    fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "109959",
      },
      body: JSON.stringify({
        sessionId: "109959",
        runId: process.env.VERCEL ? "vercel-runtime" : "local-runtime",
        hypothesisId: "H5",
        location: "src/config/connectDB.js:30",
        message: "Testing database connectivity",
        data: {
          isVercel: !!process.env.VERCEL,
          hasHost: !!dbConfig.host,
          hasUser: !!dbConfig.user,
          hasDatabase: !!dbConfig.database,
          port: dbConfig.port,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});

    const [rows] = await connection.query("SELECT 1 + 1 AS solution");
    console.log(
      "Database connection successful. Test query result:",
      rows[0].solution,
    );
  } catch (error) {
    fetch("http://127.0.0.1:7649/ingest/72535e89-2a7a-4c39-982e-04a2064b08bf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "109959",
      },
      body: JSON.stringify({
        sessionId: "109959",
        runId: process.env.VERCEL ? "vercel-runtime" : "local-runtime",
        hypothesisId: "H5",
        location: "src/config/connectDB.js:36",
        message: "Database connection failed",
        data: {
          isVercel: !!process.env.VERCEL,
          errorCode: error?.code || null,
          errorMessage: error?.message || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.error("Error connecting to the database:", error);
  }
}

if (!process.env.VERCEL && _SKIP_DB !== "true") {
  testConnection();
}

export default connection;
