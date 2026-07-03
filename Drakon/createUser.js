import 'dotenv/config';
import mysql from 'mysql2/promise';
import md5 from 'md5';

const PHONE = '8972182034';
const PLAIN_PASSWORD = 'qwert';
const BOOTSTRAP_CODE = 'BOOTSTRAP01';
const BOOTSTRAP_PHONE = '1000000001';
const TEST_BALANCE = 5000;

function randomNumber(min, max) {
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDbConfig() {
  const host =
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    process.env.DATABASE_HOST;
  const user =
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    process.env.DATABASE_USER;
  const password =
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    process.env.DATABASE_PASSWORD;
  const database =
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    process.env.DATABASE_NAME;
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);

  if (!host || !user || !database) {
    throw new Error(
      'Missing DB config. Set MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE or DATABASE_* / DB_* vars.'
    );
  }

  return { host, user, password, database, port };
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field));
}

function pickExisting(columns, values) {
  return Object.entries(values).filter(([key, value]) => columns.has(key) && value !== undefined);
}

async function insertRow(connection, tableName, columns, values) {
  const entries = pickExisting(columns, values);
  if (entries.length === 0) {
    throw new Error(`No matching columns found for insert into ${tableName}`);
  }

  const fields = entries.map(([key]) => `\`${key}\``).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const params = entries.map(([, value]) => value);

  await connection.execute(
    `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
    params
  );
}

async function updateRow(connection, tableName, columns, values, whereSql, whereParams) {
  const entries = pickExisting(columns, values);
  if (entries.length === 0) {
    return;
  }

  const assignments = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
  const params = entries.map(([, value]) => value);

  await connection.execute(
    `UPDATE \`${tableName}\` SET ${assignments} WHERE ${whereSql}`,
    [...params, ...whereParams]
  );
}

async function ensurePointListRow(connection, pointListColumns, phone) {
  const [rows] = await connection.query('SELECT phone FROM point_list WHERE phone = ? LIMIT 1', [phone]);
  if (rows.length > 0) {
    return;
  }

  await insertRow(connection, 'point_list', pointListColumns, {
    phone,
    money: 0,
    money_us: 0,
    telegram: '',
  });
}

async function ensureBootstrapReferrer(connection, userColumns, pointListColumns) {
  const [existingByCode] = await connection.query(
    'SELECT * FROM users WHERE code = ? LIMIT 1',
    [BOOTSTRAP_CODE]
  );

  if (existingByCode.length > 0) {
    await updateRow(
      connection,
      'users',
      userColumns,
      {
        phone: BOOTSTRAP_PHONE,
        name_user: 'Admin',
        password: md5('admin123'),
        plain_password: 'admin123',
        money: 0,
        total_money: 0,
        invite: BOOTSTRAP_CODE,
        veri: 1,
        status: 1,
        time: Date.now(),
      },
      '`code` = ?',
      [BOOTSTRAP_CODE]
    );
    await ensurePointListRow(connection, pointListColumns, BOOTSTRAP_PHONE);
    return BOOTSTRAP_CODE;
  }

  const [existingByPhone] = await connection.query(
    'SELECT * FROM users WHERE phone = ? LIMIT 1',
    [BOOTSTRAP_PHONE]
  );

  if (existingByPhone.length > 0) {
    await updateRow(
      connection,
      'users',
      userColumns,
      {
        code: BOOTSTRAP_CODE,
        invite: BOOTSTRAP_CODE,
        name_user: 'Admin',
        password: md5('admin123'),
        plain_password: 'admin123',
        veri: 1,
        status: 1,
      },
      '`phone` = ?',
      [BOOTSTRAP_PHONE]
    );
    await ensurePointListRow(connection, pointListColumns, BOOTSTRAP_PHONE);
    return BOOTSTRAP_CODE;
  }

  await insertRow(connection, 'users', userColumns, {
    id_user: randomNumber(10000, 99999),
    phone: BOOTSTRAP_PHONE,
    name_user: 'Admin',
    password: md5('admin123'),
    plain_password: 'admin123',
    money: 0,
    total_money: 0,
    code: BOOTSTRAP_CODE,
    invite: BOOTSTRAP_CODE,
    ctv: '',
    veri: 1,
    otp: randomNumber(100000, 999999),
    ip_address: '127.0.0.1',
    status: 1,
    time: Date.now(),
    free_bonus: 0,
    first_deposit: 0,
    level: 0,
    user_level: 0,
  });
  await ensurePointListRow(connection, pointListColumns, BOOTSTRAP_PHONE);
  return BOOTSTRAP_CODE;
}

async function main() {
  const db = getDbConfig();
  const connection = await mysql.createConnection(db);

  try {
    const userColumns = await getColumns(connection, 'users');
    const pointListColumns = await getColumns(connection, 'point_list');

    const invitecode = await ensureBootstrapReferrer(connection, userColumns, pointListColumns);

    const [referrer] = await connection.query(
      'SELECT * FROM users WHERE code = ? LIMIT 1',
      [invitecode]
    );

    if (referrer.length === 0) {
      throw new Error(`Referrer code not found after bootstrap: ${invitecode}`);
    }

    const [existing] = await connection.query(
      'SELECT id, phone FROM users WHERE phone = ? LIMIT 1',
      [PHONE]
    );

    if (existing.length > 0) {
      await updateRow(
        connection,
        'users',
        userColumns,
        {
          password: md5(PLAIN_PASSWORD),
          plain_password: PLAIN_PASSWORD,
          money: TEST_BALANCE,
          total_money: TEST_BALANCE,
          veri: 1,
          status: 1,
          invite: invitecode,
        },
        '`phone` = ?',
        [PHONE]
      );
      await ensurePointListRow(connection, pointListColumns, PHONE);
      console.log('User already existed. Seed credentials refreshed.');
      console.log({ phone: PHONE, password: PLAIN_PASSWORD, invite: invitecode });
      return;
    }

    const referrerRow = referrer[0];
    const code = randomString(5) + randomNumber(10000, 99999);
    const ctv =
      Number(referrerRow.level || 0) === 2
        ? referrerRow.phone || ''
        : referrerRow.ctv || '';

    await insertRow(connection, 'users', userColumns, {
      id_user: randomNumber(10000, 99999),
      phone: PHONE,
      name_user: `Member${randomNumber(10000, 99999)}`,
      password: md5(PLAIN_PASSWORD),
      plain_password: PLAIN_PASSWORD,
      money: TEST_BALANCE,
      total_money: TEST_BALANCE,
      code,
      invite: invitecode,
      ctv,
      veri: 1,
      otp: randomNumber(100000, 999999),
      ip_address: '127.0.0.1',
      status: 1,
      time: Date.now(),
      free_bonus: 500,
      first_deposit: 0,
      level: 0,
      user_level: 0,
    });

    await ensurePointListRow(connection, pointListColumns, PHONE);

    console.log('User created successfully.');
    console.log({ phone: PHONE, password: PLAIN_PASSWORD, invite: invitecode, code });
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Failed to create user.');
  console.error(error.message);
  process.exit(1);
});
