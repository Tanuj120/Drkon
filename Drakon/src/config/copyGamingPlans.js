export const REFERRAL_MAX_LEVEL = 20;

export const FIXED_DEPOSIT_PLANS = [
    {
        days: 30,
        dailyRate: 0.51,
        levelPercentages: [1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, ...Array(12).fill(0.1)],
    },
    {
        days: 90,
        dailyRate: 1.11,
        levelPercentages: [5, 3, 2, 1, 1, 1, 1, 1, ...Array(12).fill(0.2)],
    },
];

if (FIXED_DEPOSIT_PLANS.some((plan) => plan.levelPercentages.length !== REFERRAL_MAX_LEVEL)) {
    throw new Error('Copy Gaming plans must define every referral level');
}
