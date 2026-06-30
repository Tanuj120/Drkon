import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomDigitString, randomInteger } from '../src/utils/fairRandom.js';

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

console.log('Wingo counts:', wingoCounts.join(','));
console.log('K3 counts:', k3Counts.join(','));
console.log('5D counts:', fiveDCounts.join(','));
console.log('Cryptographic distributions and immediate broadcast order passed.');
