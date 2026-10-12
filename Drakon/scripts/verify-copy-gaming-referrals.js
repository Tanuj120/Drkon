import assert from 'node:assert/strict';

process.env.SKIP_DB = 'true';

const connection = (await import('../src/config/connectDB.js')).default;
const accountController = (await import('../src/controllers/accountController.js')).default;
const adminController = (await import('../src/controllers/adminController.js')).default;
const homeController = (await import('../src/controllers/homeController.js')).default;
const userControllerModule = await import('../src/controllers/userController.js');
const userController = userControllerModule.default;
const { distributeCopyGamingLevelIncome } = userControllerModule;

const packageAmount = 1000;
const expectedPercentages = [1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, ...Array(12).fill(0.1)];
const expectedAmounts = [10, 5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, ...Array(12).fill(1)];
const members = [];

const createResponse = () => {
    const result = { statusCode: 200, body: null };
    return {
        result,
        status(statusCode) {
            result.statusCode = statusCode;
            return this;
        },
        json(body) {
            result.body = body;
            return body;
        },
    };
};

const invoke = async (handler, request) => {
    const response = createResponse();
    await handler(request, response);
    assert.equal(response.result.statusCode, 200);
    return response.result.body;
};

const getUserByPhone = async (phone) => {
    const [rows] = await connection.query('SELECT * FROM users WHERE phone = ?', [phone]);
    assert.equal(rows.length, 1, `Expected one registered user for ${phone}`);
    return rows[0];
};

const getBalance = async (phone) => Number((await getUserByPhone(phone)).money || 0);

let inviterCode = 'BOOTSTRAP01';
for (let index = 1; index <= 21; index++) {
    const phone = `15553000${String(index).padStart(3, '0')}`;
    const registration = await invoke(accountController.register, {
        body: {
            username: phone,
            email: `copy-gaming-${index}@example.test`,
            pwd: 'qwert',
            invitecode: inviterCode,
        },
        headers: { 'x-forwarded-for': `10.30.0.${index}` },
        connection: { remoteAddress: `10.30.0.${index}` },
        socket: { remoteAddress: `10.30.0.${index}` },
    });
    assert.equal(registration.status, true, `Registration ${index} failed: ${registration.message}`);

    const user = await getUserByPhone(phone);
    assert.ok(user.code, `Registration ${index} did not generate an invitation code`);
    assert.equal(user.invite, inviterCode, `Registration ${index} saved the wrong parent code`);

    const token = `copy-gaming-referral-user-${index}`;
    const [tokenUpdate] = await connection.execute('UPDATE users SET token = ? WHERE phone = ?', [token, phone]);
    assert.equal(tokenUpdate.affectedRows, 1);
    members.push({ ...user, token });
    inviterCode = user.code;
}

const buyer = members[20];
const [fundResult] = await connection.execute(
    'UPDATE users SET money = money + ? WHERE token = ?',
    [packageAmount, buyer.token]
);
assert.equal(fundResult.affectedRows, 1);
assert.equal(await getBalance(buyer.phone), packageAmount);

const purchase = await invoke(userController.createFixedDeposit, {
    cookies: { auth: buyer.token },
    body: { amount: packageAmount, tenureDays: 30 },
});
assert.equal(purchase.status, true, purchase.message);
assert.equal(purchase.message, 'Copy Gaming created for 30 days');
assert.equal(await getBalance(buyer.phone), 0, 'Buyer principal was not deducted exactly once');

const purchaseRecord = purchase.data.history.find((record) => Number(record.tenureDays) === 30);
assert.ok(purchaseRecord, '30-day purchase is missing from Copy Gaming history');
assert.equal(purchaseRecord.amount, packageAmount);
assert.equal(purchaseRecord.dailyRate, 0.51);
assert.equal(purchaseRecord.totalInterest, 153);
assert.equal(purchaseRecord.maturityAmount, 1153);

assert.deepEqual(
    purchase.referralIncome.map(({ level, amount, percentage }) => ({ level, amount, percentage })),
    expectedPercentages.map((percentage, index) => ({
        level: index + 1,
        amount: expectedAmounts[index],
        percentage,
    }))
);

const [ledgerRows] = await connection.query(
    'SELECT * FROM referral_level_income WHERE from_phone = ? ORDER BY level_no ASC',
    [buyer.phone]
);
assert.equal(ledgerRows.length, 20, 'The 30-day purchase must create exactly twenty commission rows');
const transactionIds = new Set(ledgerRows.map((row) => row.transaction_id));
assert.equal(transactionIds.size, 1, 'All twenty commissions must share one purchase transaction ID');
const [transactionId] = transactionIds;
assert.match(transactionId, /^COPY_GAMING_30_\d+$/);

for (let level = 1; level <= 20; level++) {
    const recipient = members[20 - level];
    const ledger = ledgerRows.find((row) => Number(row.level_no) === level);
    assert.ok(ledger, `Missing level ${level} commission ledger row`);
    assert.equal(ledger.from_phone, buyer.phone);
    assert.equal(ledger.to_phone, recipient.phone, `Level ${level} credited the wrong user`);
    assert.equal(Number(ledger.percentage), expectedPercentages[level - 1]);
    assert.equal(Number(ledger.package_amount), packageAmount);
    assert.equal(Number(ledger.income_amount), expectedAmounts[level - 1]);
    assert.equal(ledger.status, 'credited');
    assert.equal(await getBalance(recipient.phone), expectedAmounts[level - 1], `Level ${level} wallet credit is wrong`);

    const transactionLog = await invoke(homeController.getSalaryRecord, {
        cookies: { auth: recipient.token },
    });
    assert.equal(transactionLog.status, true);
    const commissionEntries = transactionLog.rows.filter((entry) => entry.type === '30 Days Copy Gaming Commission');
    assert.equal(commissionEntries.length, 1, `Level ${level} account must see exactly one commission entry`);
    assert.equal(commissionEntries[0].title, `Level ${level} Income`);
    assert.equal(Number(commissionEntries[0].amount), expectedAmounts[level - 1]);
    assert.equal(commissionEntries[0].direction, 'credit');
    assert.equal(commissionEntries[0].status, 'Complete');
    assert.equal(commissionEntries[0].orderId, transactionId);
    assert.match(commissionEntries[0].description, new RegExp(`^${expectedPercentages[level - 1]}% from ${buyer.phone} on ₹1000\\.00$`));
    assert.equal(
        commissionEntries[0].time,
        new Date(Number(ledger.created_at)).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }),
        `Level ${level} transaction time is not displayed in India time`
    );

    const promotionHistory = await invoke(userController.listPromotionHistory, {
        cookies: { auth: recipient.token },
    });
    assert.equal(promotionHistory.status, true);
    const promotionEntry = promotionHistory.total_roses.find((entry) => entry.transaction_id === transactionId);
    assert.ok(promotionEntry, `Level ${level} commission is missing from Promotion History`);
    assert.equal(Number(promotionEntry.level_no), level);
    assert.equal(Number(promotionEntry.percentage), expectedPercentages[level - 1]);
    assert.equal(Number(promotionEntry.f1), expectedAmounts[level - 1]);
    assert.equal(promotionEntry.code, `30 Days - Level ${level}`);

    const promotionSummary = await invoke(userController.promotion, {
        cookies: { auth: recipient.token },
    });
    assert.equal(promotionSummary.status, true);
    assert.equal(Number(promotionSummary.invite.roses_f), expectedAmounts[level - 1]);
    assert.equal(Number(promotionSummary.invite.roses_all), expectedAmounts[level - 1]);
}

const buyerTransactions = await invoke(homeController.getSalaryRecord, {
    cookies: { auth: buyer.token },
});
const buyerPurchaseEntries = buyerTransactions.rows.filter((entry) => entry.title === 'Copy Gaming Transfer In');
assert.equal(buyerPurchaseEntries.length, 1, 'Buyer must see one Copy Gaming transfer-in transaction');
assert.equal(buyerPurchaseEntries[0].type, '30 days Staking');
assert.equal(Number(buyerPurchaseEntries[0].amount), packageAmount);
assert.equal(buyerPurchaseEntries[0].direction, 'debit');
assert.equal(buyerPurchaseEntries[0].status, 'Active');
assert.equal(buyerTransactions.rows.some((entry) => entry.type === '30 Days Copy Gaming Commission'), false);

const firstMemberTeam = await invoke(userController.listMyTeam, {
    cookies: { auth: members[0].token },
});
assert.equal(firstMemberTeam.status, true);
assert.equal(firstMemberTeam.max_level, 20);
assert.equal(firstMemberTeam.f1.length, 20, 'The first member must see twenty descendants');
assert.equal(firstMemberTeam.levels.length, 20);
firstMemberTeam.levels.forEach((usersAtLevel, index) => {
    assert.equal(usersAtLevel.length, 1, `Team level ${index + 1} must contain one member`);
    assert.equal(Number(usersAtLevel[0].user_level), index + 1);
    assert.equal(usersAtLevel[0].phone, members[index + 1].phone);
});

const [adminRows] = await connection.query('SELECT * FROM users WHERE code = ?', ['BOOTSTRAP01']);
assert.equal(adminRows.length, 1);
assert.equal(Number(adminRows[0].money), 0, 'Level 21 must never receive commission');
const [levelTwentyOneRows] = await connection.query(
    'SELECT * FROM referral_level_income WHERE to_phone = ?',
    [adminRows[0].phone]
);
assert.equal(levelTwentyOneRows.length, 0, 'A level 21 commission row must not exist');

const balancesBeforeDuplicate = await Promise.all(members.slice(0, 20).map((member) => getBalance(member.phone)));
const duplicateCredits = await distributeCopyGamingLevelIncome(connection, {
    buyer,
    amount: packageAmount,
    fixedDepositId: purchaseRecord.id,
    transactionId,
    levelPercentages: expectedPercentages,
});
assert.deepEqual(duplicateCredits, [], 'Duplicate processing must return no credits');
assert.deepEqual(
    await Promise.all(members.slice(0, 20).map((member) => getBalance(member.phone))),
    balancesBeforeDuplicate,
    'Duplicate processing changed a wallet balance'
);
const [ledgerRowsAfterDuplicate] = await connection.query(
    'SELECT * FROM referral_level_income WHERE from_phone = ? ORDER BY level_no ASC',
    [buyer.phone]
);
assert.equal(ledgerRowsAfterDuplicate.length, 20, 'Duplicate processing inserted extra ledger rows');

assert.equal(
    expectedAmounts.reduce((total, amount) => total + amount, 0),
    42,
    'Expected total 30-day referral commission is incorrect'
);

const ninetyDayPercentages = [5, 3, 2, 1, 1, 1, 1, 1, ...Array(12).fill(0.2)];
const ninetyDayAmounts = [50, 30, 20, 10, 10, 10, 10, 10, ...Array(12).fill(2)];
await connection.execute('UPDATE users SET money = money + ? WHERE token = ?', [packageAmount, buyer.token]);
const ninetyDayPurchase = await invoke(userController.createFixedDeposit, {
    cookies: { auth: buyer.token },
    body: { amount: packageAmount, tenureDays: 90 },
});
assert.equal(ninetyDayPurchase.status, true, ninetyDayPurchase.message);
assert.equal(await getBalance(buyer.phone), 0);
assert.deepEqual(
    ninetyDayPurchase.referralIncome.map(({ level, amount, percentage }) => ({ level, amount, percentage })),
    ninetyDayPercentages.map((percentage, index) => ({
        level: index + 1,
        amount: ninetyDayAmounts[index],
        percentage,
    }))
);
const ninetyDayRecord = ninetyDayPurchase.data.history.find((record) => Number(record.tenureDays) === 90);
assert.ok(ninetyDayRecord);
const ninetyDayTransactionId = `COPY_GAMING_90_${ninetyDayRecord.id}`;
const [ninetyDayLedger] = await connection.query(
    'SELECT * FROM referral_level_income WHERE transaction_id = ? ORDER BY level_no ASC',
    [ninetyDayTransactionId]
);
assert.equal(ninetyDayLedger.length, 20);
for (let index = 0; index < 20; index++) {
    const recipient = members[19 - index];
    const ledger = ninetyDayLedger[index];
    assert.equal(Number(ledger.level_no), index + 1);
    assert.equal(ledger.to_phone, recipient.phone);
    assert.equal(Number(ledger.percentage), ninetyDayPercentages[index]);
    assert.equal(Number(ledger.income_amount), ninetyDayAmounts[index]);
    assert.equal(await getBalance(recipient.phone), expectedAmounts[index] + ninetyDayAmounts[index]);

    const history = await invoke(userController.listPromotionHistory, {
        cookies: { auth: recipient.token },
    });
    assert.ok(history.total_roses.some((entry) =>
        entry.transaction_id === ninetyDayTransactionId &&
        entry.code === `90 Days - Level ${index + 1}` &&
        Number(entry.f1) === ninetyDayAmounts[index]
    ));
    const transactions = await invoke(homeController.getSalaryRecord, {
        cookies: { auth: recipient.token },
    });
    assert.ok(transactions.rows.some((entry) =>
        entry.orderId === ninetyDayTransactionId &&
        entry.title === `Level ${index + 1} Income` &&
        entry.type === '90 Days Copy Gaming Commission' &&
        Number(entry.amount) === ninetyDayAmounts[index]
    ));
}
assert.equal(ninetyDayAmounts.reduce((total, amount) => total + amount, 0), 174);
assert.equal((await getUserByPhone(adminRows[0].phone)).money, 0, 'Level 21 received commission');

let adminReport;
await adminController.copyGamingCommissions(
    { query: { plan: '90', level: '20', phone: members[0].phone, page: '1' } },
    { render(view, data) { adminReport = { view, ...data }; } }
);
assert.equal(adminReport.view, 'manage/copyGamingCommissions.ejs');
assert.equal(adminReport.totalRecords, 1);
assert.equal(adminReport.totalAmount, 2);
assert.equal(adminReport.rows[0].transaction_id, ninetyDayTransactionId);
assert.equal(Number(adminReport.rows[0].level_no), 20);

const duplicateNinetyDayCredits = await distributeCopyGamingLevelIncome(connection, {
    buyer,
    amount: packageAmount,
    fixedDepositId: ninetyDayRecord.id,
    transactionId: ninetyDayTransactionId,
    levelPercentages: ninetyDayPercentages,
});
assert.deepEqual(duplicateNinetyDayCredits, []);

await connection.execute('UPDATE users SET money = money + ? WHERE token = ?', [packageAmount, buyer.token]);
const additionalPurchase = await invoke(userController.createFixedDeposit, {
    cookies: { auth: buyer.token },
    body: { amount: packageAmount, tenureDays: 30 },
});
assert.equal(additionalPurchase.status, true, additionalPurchase.message);
let secondAdminPage;
await adminController.copyGamingCommissions(
    { query: { page: '2' } },
    { render(view, data) { secondAdminPage = data; } }
);
assert.equal(secondAdminPage.totalRecords, 60);
assert.equal(secondAdminPage.totalAmount, 258);
assert.equal(secondAdminPage.totalPages, 2);
assert.equal(secondAdminPage.rows.length, 10);
let oldDateReport;
await adminController.copyGamingCommissions(
    { query: { fromDate: '2000-01-01', toDate: '2000-01-01' } },
    { render(view, data) { oldDateReport = data; } }
);
assert.equal(oldDateReport.totalRecords, 0);

console.log('30-day and 90-day Copy Gaming referral verification passed.');
console.log('Registered 21 isolated test members and verified Levels 1-20 for both plans.');
console.log('Verified wallets, both histories, My Team, admin report, no Level 21, and duplicate protection.');
