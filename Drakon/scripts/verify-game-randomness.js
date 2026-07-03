import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomDigitString, randomInteger } from '../src/utils/fairRandom.js';
import { claimRoundExecution, getRoundSlot } from '../src/utils/gameRoundScheduler.js';

const chiSquare = (counts) => {
    const total = counts.reduce((sum, count) => sum + count, 0);
    const expected = total / counts.length;
    return counts.reduce((sum, count) => sum + ((count - expected) ** 2) / expected, 0);
};

const wingoCounts = Array(10).fill(0);
const wingoPairs = Array(100).fill(0);
let previousWingo = randomInteger(0, 9);
wingoCounts[previousWingo] += 1;
for (let index = 1; index < 200000; index += 1) {
    const result = randomInteger(0, 9);
    wingoCounts[result] += 1;
    wingoPairs[(previousWingo * 10) + result] += 1;
    previousWingo = result;
}
assert.ok(chiSquare(wingoCounts) < 45, 'Wingo digit distribution is unexpectedly biased');
assert.ok(chiSquare(wingoPairs) < 180, 'Wingo consecutive result pairs are unexpectedly biased');

let serialProduct = 0;
let serialLeft = 0;
let serialRight = 0;
let serialCount = 0;
previousWingo = randomInteger(0, 9);
for (let index = 0; index < 200000; index += 1) {
    const result = randomInteger(0, 9);
    serialProduct += previousWingo * result;
    serialLeft += previousWingo;
    serialRight += result;
    serialCount += 1;
    previousWingo = result;
}
const serialCovariance = (serialProduct / serialCount) - ((serialLeft / serialCount) * (serialRight / serialCount));
assert.ok(Math.abs(serialCovariance) < 0.12, 'Wingo outcomes show serial dependence');

const k3Counts = Array(6).fill(0);
for (let index = 0; index < 100000; index += 1) {
    for (const digit of randomDigitString(3, 1, 6)) k3Counts[Number(digit) - 1] += 1;
}
assert.ok(chiSquare(k3Counts) < 35, 'K3 digit distribution is unexpectedly biased');

const fiveDCounts = Array(10).fill(0);
for (let index = 0; index < 60000; index += 1) {
    for (const digit of randomDigitString(5, 0, 9)) fiveDCounts[Number(digit)] += 1;
}
assert.ok(chiSquare(fiveDCounts) < 45, '5D digit distribution is unexpectedly biased');

const controllerChecks = [
    ['src/controllers/winGoController.js', 'addWinGo', 'addWinGoLegacy'],
    ['src/controllers/k3Controller.js', 'addK3', 'addK3Legacy'],
    ['src/controllers/k5Controller.js', 'add5D', 'add5DLegacy'],
];
for (const [file, activeName, legacyName] of controllerChecks) {
    const source = await readFile(file, 'utf8');
    const activeSource = source.slice(source.indexOf(`const ${activeName} =`), source.indexOf(`const ${legacyName} =`));
    assert.ok(activeSource.includes('random'), `${activeName} does not use the fair random utility`);
    assert.ok(!/Math\.random|nextResult|FROM `admin`|FROM minutes_1/i.test(activeSource), `${activeName} depends on bets or manual results`);
}

const cronSource = await readFile('src/controllers/cronJobContronler.js', 'utf8');
for (const [functionName, emitMarker, settlementMarker] of [
    ['runWinGoRound', "settled: false", 'handlingWinGo1P'],
    ['run5DRound', "data-server-5d", 'handling5D'],
    ['runK3Round', "data-server-k3", 'handlingK3'],
]) {
    const start = cronSource.indexOf(`const ${functionName} =`);
    const end = cronSource.indexOf('\n};', start);
    const functionSource = cronSource.slice(start, end);
    assert.ok(functionSource.indexOf(emitMarker) < functionSource.indexOf(settlementMarker), `${functionName} broadcasts after settlement`);
}

const socketSource = await readFile('src/controllers/socketIoController.js', 'utf8');
assert.ok(!/socket\.on\(['"]data-server['"]/.test(socketSource), 'Browsers can impersonate official game result broadcasts');

const claimedSlots = new Set();
const schedulerDb = {
    execute: async (sql, params) => {
        assert.match(sql, /INSERT IGNORE INTO game_round_executions/);
        const key = params.slice(0, 3).join(':');
        const inserted = !claimedSlots.has(key);
        claimedSlots.add(key);
        return [{ affectedRows: inserted ? 1 : 0 }];
    },
};
const boundary = Date.UTC(2026, 5, 30, 12, 0, 0);
const simultaneousClaims = await Promise.all(
    Array.from({ length: 100 }, () => claimRoundExecution('wingo', 1, boundary, schedulerDb)),
);
assert.equal(simultaneousClaims.filter((claim) => claim.claimed).length, 1, 'Multiple workers can generate the same Wingo round');
assert.equal((await claimRoundExecution('wingo', 1, boundary + 60_000, schedulerDb)).claimed, true, 'The next Wingo slot was not accepted');
assert.equal((await claimRoundExecution('k3', 1, boundary, schedulerDb)).claimed, true, 'Different games incorrectly share a scheduler claim');
assert.equal(getRoundSlot(3, boundary), getRoundSlot(3, boundary + 120_000), 'A 3-minute slot changed too early');
assert.notEqual(getRoundSlot(3, boundary), getRoundSlot(3, boundary + 180_000), 'A 3-minute slot did not advance');

const schemaSource = await readFile('src/utils/ensureGameSchema.js', 'utf8');
assert.match(schemaSource, /UNIQUE INDEX.*game.*period/s, 'Round tables do not enforce unique game periods');

console.log('Wingo counts:', wingoCounts.join(','));
console.log('K3 counts:', k3Counts.join(','));
console.log('5D counts:', fiveDCounts.join(','));
console.log('Cryptographic independence, single-writer scheduling, and immediate broadcast order passed.');
