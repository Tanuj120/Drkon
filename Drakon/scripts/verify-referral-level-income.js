import dotenv from "dotenv";
import md5 from "md5";

dotenv.config();

const { default: connection } = await import("../src/config/connectDB.js");
const { default: userController } = await import("../src/controllers/userController.js");

const numericPrefix = `98${Date.now().toString().slice(-8)}`;
const codePrefix = `TESTREF${Date.now()}`;
const percentages = [5, 3, 2, 1, 1, 1, 1, 1];
const packageAmount = 1000;

const runQuery = async (sql, params = []) => connection.query(sql, params);
const runExecute = async (sql, params = []) => connection.execute(sql, params);

const fakeResponse = () => {
  const result = { statusCode: 0, body: null };
  return {
    result,
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
  };
};

const ensureColumns = async () => {
  await runExecute(`
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
};

const createTestUsers = async () => {
  const users = [];
  for (let index = 1; index <= 10; index++) {
    const phone = `${numericPrefix}${String(index).padStart(2, "0")}`;
    const code = `${codePrefix}C${String(index).padStart(2, "0")}`;
    const invite = index === 1 ? `${codePrefix}ROOT` : users[index - 2].code;
    const token = `${codePrefix}T${String(index).padStart(2, "0")}`;
    users.push({ phone, code, invite, token });

    await runExecute(
      `INSERT INTO users
       (id_user, phone, name_user, password, plain_password, token, code, invite, level, status, veri, money, total_money, roses_f, roses_f1, roses_today, time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${codePrefix}${index}`,
        phone,
        `Referral Test ${index}`,
        md5("test123"),
        "test123",
        token,
        code,
        invite,
        0,
        1,
        1,
        index === 10 ? packageAmount : 0,
        0,
        0,
        0,
        0,
        Date.now(),
      ],
    );
  }
  return users;
};

const cleanup = async () => {
  const [depositRows] = await runQuery("SELECT id FROM fixed_deposits WHERE phone LIKE ?", [`${numericPrefix}%`]);
  const depositIds = depositRows.map((row) => row.id);

  if (depositIds.length) {
    await runExecute(
      `DELETE FROM referral_level_income WHERE fixed_deposit_id IN (${depositIds.map(() => "?").join(",")})`,
      depositIds,
    );
  }

  await runExecute("DELETE FROM referral_level_income WHERE from_phone LIKE ? OR to_phone LIKE ? OR transaction_id LIKE ?", [`${numericPrefix}%`, `${numericPrefix}%`, `%${codePrefix}%`]);
  await runExecute("DELETE FROM fixed_deposits WHERE phone LIKE ?", [`${numericPrefix}%`]);
  await runExecute("DELETE FROM users WHERE phone LIKE ? OR code LIKE ?", [`${numericPrefix}%`, `${codePrefix}%`]);
};

const assertCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  await cleanup();
  await ensureColumns();

  const users = await createTestUsers();
  const buyer = users[9];
  const response = fakeResponse();

  await userController.createFixedDeposit(
    {
      cookies: { auth: buyer.token },
      body: { amount: packageAmount, tenureDays: 90 },
    },
    response,
  );

  assertCondition(response.result.body?.status === true, `90-day package failed: ${JSON.stringify(response.result.body)}`);

  const [depositRows] = await runQuery("SELECT * FROM fixed_deposits WHERE phone = ? ORDER BY id DESC LIMIT 1", [buyer.phone]);
  const deposit = depositRows[0];
  assertCondition(deposit, "No fixed_deposit row created");
  assertCondition(Number(deposit.tenure_days) === 90, "Deposit is not a 90-day package");
  assertCondition(Number(deposit.referral_processed) === 1, "Referral was not marked processed");

  const transactionId = `COPY_GAMING_90_${deposit.id}`;
  const [incomeRows] = await runQuery("SELECT * FROM referral_level_income WHERE transaction_id = ? ORDER BY level_no ASC", [transactionId]);
  assertCondition(incomeRows.length === 8, `Expected 8 income rows, got ${incomeRows.length}`);

  for (let index = 0; index < percentages.length; index++) {
    const row = incomeRows[index];
    const expectedReceiver = users[8 - index];
    const expectedAmount = Number(((packageAmount * percentages[index]) / 100).toFixed(2));
    assertCondition(Number(row.level_no) === index + 1, `Wrong level at row ${index + 1}`);
    assertCondition(row.to_phone === expectedReceiver.phone, `Level ${index + 1} paid ${row.to_phone}, expected ${expectedReceiver.phone}`);
    assertCondition(Number(row.income_amount) === expectedAmount, `Level ${index + 1} amount ${row.income_amount}, expected ${expectedAmount}`);
  }

  const [paidUsers] = await runQuery("SELECT phone, money, roses_f, roses_f1, roses_today FROM users WHERE phone LIKE ? ORDER BY phone ASC", [`${numericPrefix}%`]);
  const byPhone = Object.fromEntries(paidUsers.map((user) => [user.phone, user]));

  for (let index = 0; index < percentages.length; index++) {
    const receiver = users[8 - index];
    const expectedAmount = Number(((packageAmount * percentages[index]) / 100).toFixed(2));
    assertCondition(Number(byPhone[receiver.phone].money) === expectedAmount, `Wallet mismatch for ${receiver.phone}`);
  }

  assertCondition(Number(byPhone[users[0].phone].money) === 0, "Level 9/root user should not receive income");
  assertCondition(Number(byPhone[buyer.phone].money) === 0, "Buyer wallet should only be debited by package amount");

  const [duplicateResult] = await runExecute(
    `INSERT IGNORE INTO referral_level_income
     (transaction_id, fixed_deposit_id, from_phone, from_code, to_phone, to_code, level_no, percentage, package_amount, income_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [transactionId, deposit.id, buyer.phone, buyer.code, users[8].phone, users[8].code, 1, 5, packageAmount, 50, "credited", Date.now()],
  );
  assertCondition(Number(duplicateResult.affectedRows) === 0, "Duplicate transaction-level income was inserted");

  await runExecute("UPDATE users SET money = money + ? WHERE token = ?", [packageAmount, buyer.token]);
  const nonReferralResponse = fakeResponse();
  await userController.createFixedDeposit(
    {
      cookies: { auth: buyer.token },
      body: { amount: packageAmount, tenureDays: 30 },
    },
    nonReferralResponse,
  );
  assertCondition(nonReferralResponse.result.body?.status === true, `30-day package failed: ${JSON.stringify(nonReferralResponse.result.body)}`);
  const [allIncomeAfter30Day] = await runQuery("SELECT * FROM referral_level_income WHERE from_phone = ?", [buyer.phone]);
  assertCondition(allIncomeAfter30Day.length === 8, "30-day package should not create referral income");

  const selfPhone = `${numericPrefix}99`;
  const selfCode = `${codePrefix}SELF`;
  const selfToken = `${codePrefix}TSELF`;
  await runExecute(
    `INSERT INTO users
     (id_user, phone, name_user, password, plain_password, token, code, invite, level, status, veri, money, total_money, roses_f, roses_f1, roses_today, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${codePrefix}SELFUSER`,
      selfPhone,
      "Self Referral Test",
      md5("test123"),
      "test123",
      selfToken,
      selfCode,
      selfCode,
      0,
      1,
      1,
      packageAmount,
      0,
      0,
      0,
      0,
      Date.now(),
    ],
  );
  const selfResponse = fakeResponse();
  await userController.createFixedDeposit(
    {
      cookies: { auth: selfToken },
      body: { amount: packageAmount, tenureDays: 90 },
    },
    selfResponse,
  );
  assertCondition(selfResponse.result.body?.status === true, `Self-referral package failed: ${JSON.stringify(selfResponse.result.body)}`);
  const [selfIncomeRows] = await runQuery("SELECT * FROM referral_level_income WHERE from_phone = ?", [selfPhone]);
  assertCondition(selfIncomeRows.length === 0, "Self-referral should not create any referral income");

  console.log("Referral level income verification passed.");
  console.log({
    transactionId,
    levelsPaid: incomeRows.length,
    thirtyDayReferralRows: allIncomeAfter30Day.length - incomeRows.length,
    selfReferralRows: selfIncomeRows.length,
    payouts: incomeRows.map((row) => ({
      level: row.level_no,
      phone: row.to_phone,
      amount: Number(row.income_amount),
    })),
  });
};

main()
  .catch((error) => {
    console.error("Referral level income verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => console.error("Cleanup failed:", error));
    await connection.end?.();
  });
