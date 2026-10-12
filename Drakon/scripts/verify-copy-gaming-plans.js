import assert from 'node:assert/strict';

process.env.SKIP_DB = 'true';

const {
    FIXED_DEPOSIT_PLANS,
    calculateCopyGamingValues,
    distributeCopyGamingLevelIncome,
} = await import('../src/controllers/userController.js');

const formatMoney = (value) => Number(Number(value || 0).toFixed(2));

class FakeReferralDatabase {
    constructor(users) {
        this.users = users.map((user) => ({
            money: 0,
            roses_f: 0,
            roses_f1: 0,
            roses_today: 0,
            status: 1,
            veri: 1,
            ...user,
        }));
        this.incomeRows = [];
    }

    async query(sql, params = []) {
        if (/FROM referral_level_income/i.test(sql)) {
            const transactionId = params[0];
            const count = this.incomeRows.filter((row) => row.transactionId === transactionId).length;
            return [[{ count }], []];
        }

        if (/FROM users WHERE code/i.test(sql)) {
            const code = String(params[0] || '');
            const user = this.users.find((item) => item.code === code);
            return [[user ? { ...user } : undefined].filter(Boolean), []];
        }

        throw new Error(`Unsupported referral query: ${sql}`);
    }

    async execute(sql, params = []) {
        if (/INSERT IGNORE INTO referral_level_income/i.test(sql)) {
            const [
                transactionId,
                fixedDepositId,
                fromPhone,
                fromCode,
                toPhone,
                toCode,
                levelNo,
                percentage,
                packageAmount,
                incomeAmount,
                status,
                createdAt,
            ] = params;
            const duplicate = this.incomeRows.some((row) => (
                row.transactionId === transactionId && Number(row.levelNo) === Number(levelNo)
            ));
            if (duplicate) return [{ affectedRows: 0 }, []];

            this.incomeRows.push({
                transactionId,
                fixedDepositId,
                fromPhone,
                fromCode,
                toPhone,
                toCode,
                levelNo,
                percentage,
                packageAmount,
                incomeAmount,
                status,
                createdAt,
            });
            return [{ affectedRows: 1 }, []];
        }

        if (/UPDATE users SET money = money \+/i.test(sql)) {
            const [money, teamIncome, directIncome, todayIncome, phone] = params;
            const user = this.users.find((item) => (
                item.phone === phone && Number(item.status) === 1 && Number(item.veri) === 1
            ));
            if (!user) return [{ affectedRows: 0 }, []];

            user.money = formatMoney(user.money + money);
            user.roses_f = formatMoney(user.roses_f + teamIncome);
            user.roses_f1 = formatMoney(user.roses_f1 + directIncome);
            user.roses_today = formatMoney(user.roses_today + todayIncome);
            return [{ affectedRows: 1 }, []];
        }

        throw new Error(`Unsupported referral execution: ${sql}`);
    }
}

const planByDays = (days) => FIXED_DEPOSIT_PLANS.find((plan) => Number(plan.days) === Number(days));

const buildReferralChain = () => Array.from({ length: 21 }, (_, index) => ({
    phone: `9000000${String(index + 1).padStart(3, '0')}`,
    code: `LEVEL${index + 1}`,
    invite: index < 20 ? `LEVEL${index + 2}` : '',
}));

const verifyPlanValues = ({ days, dailyRate, interest, maturity }) => {
    const startTime = Date.UTC(2026, 0, 1);
    const values = calculateCopyGamingValues({ amount: 1000, tenure_days: days, start_time: startTime });
    assert.equal(values.tenureDays, days);
    assert.equal(values.dailyRate, dailyRate);
    assert.equal(values.totalInterest, interest);
    assert.equal(values.maturityAmount, maturity);
    assert.equal(values.maturityTime, startTime + (days * 86400000));
};

const historicalValues = calculateCopyGamingValues({
    amount: 1000,
    tenure_days: 30,
    daily_rate: 0.49,
    start_time: Date.UTC(2026, 0, 1),
});
assert.equal(historicalValues.dailyRate, 0.49, 'Stored purchase rates must not change with current plan configuration');
assert.equal(historicalValues.totalInterest, 147);

const verifyReferralPlan = async ({ days, expectedPercentages, expectedIncome }) => {
    const plan = planByDays(days);
    assert.ok(plan, `${days}-day plan must exist`);
    assert.deepEqual(plan.levelPercentages, expectedPercentages);

    const database = new FakeReferralDatabase(buildReferralChain());
    const buyer = { phone: '8000000000', code: 'BUYER', invite: 'LEVEL1' };
    const transactionId = `VERIFY_${days}_1`;
    const credited = await distributeCopyGamingLevelIncome(database, {
        buyer,
        amount: 1000,
        fixedDepositId: days,
        transactionId,
        levelPercentages: plan.levelPercentages,
    });

    assert.equal(credited.length, 20);
    assert.deepEqual(credited.map((item) => item.level), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.deepEqual(credited.map((item) => item.percentage), expectedPercentages);
    assert.deepEqual(credited.map((item) => item.amount), expectedIncome);
    assert.equal(formatMoney(credited.reduce((total, item) => total + item.amount, 0)), formatMoney(expectedIncome.reduce((total, amount) => total + amount, 0)));
    assert.equal(formatMoney(credited.reduce((total, item) => total + item.amount, 0)), days === 30 ? 42 : 174);
    assert.equal(database.users.find((user) => user.code === 'LEVEL21').money, 0, 'Level 21 must never receive income');

    const balancesBeforeDuplicate = database.users.map((user) => user.money);
    const duplicateCredits = await distributeCopyGamingLevelIncome(database, {
        buyer,
        amount: 1000,
        fixedDepositId: days,
        transactionId,
        levelPercentages: plan.levelPercentages,
    });
    assert.deepEqual(duplicateCredits, []);
    assert.deepEqual(database.users.map((user) => user.money), balancesBeforeDuplicate);
};

const verifyCycleProtection = async () => {
    const database = new FakeReferralDatabase([
        { phone: '7000000001', code: 'CYCLE1', invite: 'CYCLE2' },
        { phone: '7000000002', code: 'CYCLE2', invite: 'CYCLE1' },
    ]);
    const plan = planByDays(30);
    const credits = await distributeCopyGamingLevelIncome(database, {
        buyer: { phone: '7000000000', code: 'CYCLEBUYER', invite: 'CYCLE1' },
        amount: 1000,
        fixedDepositId: 301,
        transactionId: 'VERIFY_CYCLE',
        levelPercentages: plan.levelPercentages,
    });
    assert.equal(credits.length, 2);

    const selfCredits = await distributeCopyGamingLevelIncome(new FakeReferralDatabase([]), {
        buyer: { phone: '6000000000', code: 'SELF', invite: 'SELF' },
        amount: 1000,
        fixedDepositId: 302,
        transactionId: 'VERIFY_SELF',
        levelPercentages: plan.levelPercentages,
    });
    assert.deepEqual(selfCredits, []);
};

assert.deepEqual(FIXED_DEPOSIT_PLANS.map((plan) => plan.days), [30, 90]);
verifyPlanValues({ days: 30, dailyRate: 0.51, interest: 153, maturity: 1153 });
verifyPlanValues({ days: 90, dailyRate: 1.11, interest: 999, maturity: 1999 });
await verifyReferralPlan({
    days: 30,
    expectedPercentages: [1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, ...Array(12).fill(0.1)],
    expectedIncome: [10, 5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, ...Array(12).fill(1)],
});
await verifyReferralPlan({
    days: 90,
    expectedPercentages: [5, 3, 2, 1, 1, 1, 1, 1, ...Array(12).fill(0.2)],
    expectedIncome: [50, 30, 20, 10, 10, 10, 10, 10, ...Array(12).fill(2)],
});
await verifyCycleProtection();

console.log('Copy Gaming verification passed: both plans, maturity, twenty levels, duplicates, and cycle protection.');
