import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 3021;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/start-local.js'], {
    cwd: process.cwd(),
    env: {
        ...process.env,
        SKIP_DB: 'true',
        PORT: String(port),
        JWT_ACCESS_TOKEN: 'copy-gaming-http-verification',
        NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let serverErrors = '';
server.stderr.on('data', (chunk) => {
    serverErrors += chunk.toString();
});

const waitForServer = async () => {
    let lastError;
    for (let attempt = 0; attempt < 160; attempt++) {
        if (server.exitCode !== null) {
            throw new Error(`Copy Gaming HTTP verification server exited early: ${serverErrors}`);
        }
        try {
            const response = await fetch(`${baseUrl}/login`);
            if (response.ok) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Copy Gaming HTTP verification server did not become ready: ${lastError?.message || 'timeout'}`);
};

const postJson = async (path, body, auth = '') => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(auth ? { cookie: `auth=${auth}` } : {}),
        },
        body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
    return response.json();
};

try {
    await waitForServer();
    const login = await postJson('/api/webapi/login', { username: '8972182034', pwd: 'qwert' });
    assert.equal(login.status, true, login.message);

    const thirtyDayPurchase = await postJson('/api/webapi/fd/create', { amount: 100, tenureDays: 30 }, login.value);
    assert.equal(thirtyDayPurchase.status, true, thirtyDayPurchase.message);
    const thirtyDayRecord = thirtyDayPurchase.data.history.find((record) => Number(record.tenureDays) === 30);
    assert.ok(thirtyDayRecord);
    assert.equal(thirtyDayRecord.dailyRate, 0.51);
    assert.equal(thirtyDayRecord.totalInterest, 15.3);
    assert.equal(thirtyDayRecord.maturityAmount, 115.3);
    assert.deepEqual(
        thirtyDayPurchase.referralIncome.map(({ level, amount, percentage }) => ({ level, amount, percentage })),
        [{ level: 1, amount: 1, percentage: 1 }]
    );

    const ninetyDayPurchase = await postJson('/api/webapi/fd/create', { amount: 200, tenureDays: 90 }, login.value);
    assert.equal(ninetyDayPurchase.status, true, ninetyDayPurchase.message);
    const ninetyDayRecord = ninetyDayPurchase.data.history.find((record) => Number(record.tenureDays) === 90);
    assert.ok(ninetyDayRecord);
    assert.equal(ninetyDayRecord.dailyRate, 1.11);
    assert.equal(ninetyDayRecord.totalInterest, 199.8);
    assert.equal(ninetyDayRecord.maturityAmount, 399.8);
    assert.deepEqual(
        ninetyDayPurchase.referralIncome.map(({ level, amount, percentage }) => ({ level, amount, percentage })),
        [{ level: 1, amount: 10, percentage: 5 }]
    );

    const invalidPurchase = await postJson('/api/webapi/fd/create', { amount: 150, tenureDays: 30 }, login.value);
    assert.equal(invalidPurchase.status, false);
    assert.match(invalidPurchase.message, /multiples of 100/i);

    const summaryResponse = await fetch(`${baseUrl}/api/webapi/fd/summary`, {
        headers: { cookie: `auth=${login.value}` },
    });
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.status, true);
    assert.deepEqual(summary.data.plans.map((plan) => plan.days), [30, 90]);
    assert.deepEqual(summary.data.history.map((record) => record.tenureDays).sort((first, second) => first - second), [30, 90]);

    const walletPageResponse = await fetch(`${baseUrl}/wallet`, {
        headers: { cookie: `auth=${login.value}` },
    });
    assert.equal(walletPageResponse.status, 200);
    const walletPage = await walletPageResponse.text();
    assert.match(walletPage, /plan-card\.plan-30/);
    assert.match(walletPage, /Enter amount in multiples of 100/);

    const promotionPageResponse = await fetch(`${baseUrl}/promotion`, {
        headers: { cookie: `auth=${login.value}` },
    });
    assert.equal(promotionPageResponse.status, 200);
    const promotionPage = await promotionPageResponse.text();
    assert.match(promotionPage, /Referral Commission For 30 Days Copy Gaming/);
    assert.match(promotionPage, /Referral Commission For 90 Days Copy Gaming/);
    assert.equal((promotionPage.match(/Level 20 Team/g) || []).length, 2);
    assert.match(promotionPage, /Level 20 Team[\s\S]*?0\.1%[\s\S]*?30 Days/);
    assert.match(promotionPage, /Level 20 Team[\s\S]*?0\.2%[\s\S]*?90 Days/);

    const teamPageResponse = await fetch(`${baseUrl}/promotion/myTeam`, {
        headers: { cookie: `auth=${login.value}` },
    });
    assert.equal(teamPageResponse.status, 200);
    assert.match(await teamPageResponse.text(), /<option value="20">Level 20<\/option>/);

    const tutorialPageResponse = await fetch(`${baseUrl}/promotion/tutorial`, {
        headers: { cookie: `auth=${login.value}` },
    });
    assert.equal(tutorialPageResponse.status, 200);
    const tutorialPage = await tutorialPageResponse.text();
    assert.equal((tutorialPage.match(/Level 20 Team/g) || []).length, 2);

    const adminReportResponse = await fetch(`${baseUrl}/admin/manager/copyGamingCommissions?plan=90&level=1`);
    assert.equal(adminReportResponse.status, 200);
    const adminReport = await adminReportResponse.text();
    assert.match(adminReport, /Copy Gaming Level Commissions/);
    assert.match(adminReport, /COPY_GAMING_90_/);
    assert.match(adminReport, /<option value="20"/);

    console.log('Copy Gaming HTTP verification passed: purchases, histories, twenty-level customer pages, and admin report.');
} finally {
    server.kill();
    await new Promise((resolve) => {
        if (server.exitCode !== null) return resolve();
        server.once('exit', resolve);
        setTimeout(resolve, 2000);
    });
    if (serverErrors.trim()) {
        console.error(serverErrors.trim());
    }
}
