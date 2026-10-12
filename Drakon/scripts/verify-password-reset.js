import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const reservePort = () => new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
        const { port } = listener.address();
        listener.close(() => resolve(port));
    });
});

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/start-local.js'], {
    cwd: process.cwd(),
    env: {
        ...process.env,
        SKIP_DB: 'true',
        PORT: String(port),
        JWT_ACCESS_TOKEN: 'password-reset-verification',
        NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

const waitForServer = async () => {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (server.exitCode !== null) throw new Error(`Server exited: ${serverOutput}`);
        try {
            const response = await fetch(`${baseUrl}/login`);
            if (response.ok) return;
        } catch { /* Still starting. */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Server did not start: ${serverOutput}`);
};

const login = async (pwd) => {
    const response = await fetch(`${baseUrl}/api/webapi/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: '8972182034', pwd }),
    });
    assert.equal(response.status, 200);
    return response.json();
};

const changePassword = async (auth, password, newPassWord, RePassWord) => {
    const response = await fetch(`${baseUrl}/api/webapi/change/pass`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: `auth=${auth}` },
        body: JSON.stringify({ password, newPassWord, RePassWord }),
    });
    assert.equal(response.status, 200);
    return { data: await response.json(), cookies: response.headers.get('set-cookie') || '' };
};

try {
    await waitForServer();

    const page = await fetch(`${baseUrl}/mian/forgot`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /id="reset-password-form"/);
    assert.match(html, /id="submit" type="submit"/);
    assert.match(html, /url: '\/api\/webapi\/change\/pass'/);
    assert.match(html, /src="\/plugins\/jquery\/jquery\.min\.js"/);
    const jquery = await fetch(`${baseUrl}/plugins/jquery/jquery.min.js`);
    assert.equal(jquery.status, 200);

    const originalLogin = await login('qwert');
    assert.equal(originalLogin.status, true, originalLogin.message);
    const auth = originalLogin.value;

    const wrongOld = await changePassword(auth, 'incorrect', 'new-password-123', 'new-password-123');
    assert.equal(wrongOld.data.status, false);
    const mismatch = await changePassword(auth, 'qwert', 'new-password-123', 'different');
    assert.equal(mismatch.data.status, false);
    const unchanged = await changePassword(auth, 'qwert', 'qwert', 'qwert');
    assert.equal(unchanged.data.status, false);
    assert.equal((await login('qwert')).status, true);

    // Login rotates the stored token, so use the latest authenticated session.
    const currentLogin = await login('qwert');
    const success = await changePassword(currentLogin.value, 'qwert', 'new-password-123', 'new-password-123');
    assert.equal(success.data.status, true, success.data.message);
    assert.match(success.cookies, /auth=;/);
    assert.equal((await login('qwert')).status, false, 'Old password still logs in');
    assert.equal((await login('new-password-123')).status, true, 'New password cannot log in');

    const repeated = await changePassword(currentLogin.value, 'qwert', 'another-password', 'another-password');
    assert.equal(repeated.data.status, false, 'Stale request changed the password again');
    assert.equal((await login('new-password-123')).status, true);

    console.log('Password reset verification passed: form, validation, DB update, old-login rejection, new-login acceptance, and stale-request rejection.');
} catch (error) {
    console.error(serverOutput);
    throw error;
} finally {
    server.kill();
}
