import assert from 'node:assert/strict';

process.env.SKIP_DB = 'true';
const { ensureGameRound } = await import('../src/utils/gamePeriod.js');

class LockManager {
    constructor() {
        this.locks = new Map();
    }

    async acquire(name) {
        const previous = this.locks.get(name) || Promise.resolve();
        let release;
        const current = new Promise((resolve) => { release = resolve; });
        this.locks.set(name, previous.then(() => current));
        await previous;
        return () => {
            release();
            if (this.locks.get(name) === current) this.locks.delete(name);
        };
    }
}

class FakeGameDatabase {
    constructor() {
        this.rows = { wingo: [], k3: [], '5d': [] };
        this.bets = { minutes_1: [], result_k3: [], result_5d: [] };
        this.nextId = 1;
        this.lockManager = new LockManager();
    }

    tableFromSql(sql) {
        if (/`wingo`/i.test(sql)) return 'wingo';
        if (/`k3`/i.test(sql)) return 'k3';
        if (/`5d`/i.test(sql)) return '5d';
        throw new Error(`Unknown round table in SQL: ${sql}`);
    }

    betTableFromSql(sql) {
        if (/`minutes_1`/i.test(sql)) return 'minutes_1';
        if (/`result_k3`/i.test(sql)) return 'result_k3';
        if (/`result_5d`/i.test(sql)) return 'result_5d';
        throw new Error(`Unknown bet table in SQL: ${sql}`);
    }

    async getConnection() {
        let releaseLock = null;
        return {
            query: async (sql, params = []) => {
                if (/GET_LOCK/i.test(sql)) {
                    releaseLock = await this.lockManager.acquire(params[0]);
                    return [[{ acquired: 1 }], []];
                }
                if (/RELEASE_LOCK/i.test(sql)) {
                    if (releaseLock) releaseLock();
                    releaseLock = null;
                    return [[{ released: 1 }], []];
                }

                const table = this.tableFromSql(sql);
                const game = params[0];
                const matches = this.rows[table]
                    .filter((row) => row.game === game)
                    .sort((left, right) => Number(right.period) - Number(left.period) || right.id - left.id);

                if (/status\s*=\s*0/i.test(sql)) {
                    return [matches.filter((row) => row.status === 0).map((row) => ({ ...row })), []];
                }
                if (/status\s*!=\s*0/i.test(sql)) {
                    return [matches.filter((row) => row.status !== 0).slice(0, 1).map((row) => ({ ...row })), []];
                }
                throw new Error(`Unsupported query: ${sql}`);
            },
            execute: async (sql, params = []) => {
                if (/^\s*INSERT INTO/i.test(sql)) {
                    const table = this.tableFromSql(sql);
                    const completed = /,\s*1\s*,\s*\?\s*\)\s*$/i.test(sql);
                    const period = params[0];
                    const result = completed ? params[1] : 0;
                    const game = completed ? params[2] : params[1];
                    const status = completed ? 1 : 0;
                    const time = completed ? params[3] : params[2];
                    this.rows[table].push({ id: this.nextId++, period: String(period), result, game, status, time });
                    return [{ affectedRows: 1 }, []];
                }
                if (/^\s*UPDATE\s+`(?:minutes_1|result_k3|result_5d)`/i.test(sql)) {
                    const table = this.betTableFromSql(sql);
                    const [toPeriod, fromPeriod, game] = params;
                    let affectedRows = 0;
                    this.bets[table].forEach((bet) => {
                        if (bet.stage === String(fromPeriod) && bet.game === game && bet.status === 0) {
                            bet.stage = String(toPeriod);
                            affectedRows += 1;
                        }
                    });
                    return [{ affectedRows }, []];
                }
                if (/^\s*DELETE FROM/i.test(sql)) {
                    const table = this.tableFromSql(sql);
                    const index = this.rows[table].findIndex((row) => row.id === params[0] && row.status === 0);
                    if (index < 0) return [{ affectedRows: 0 }, []];
                    this.rows[table].splice(index, 1);
                    return [{ affectedRows: 1 }, []];
                }
                if (/^\s*UPDATE\s+`(?:wingo|k3|5d)`/i.test(sql)) {
                    const table = this.tableFromSql(sql);
                    const [period, time, id] = params;
                    const row = this.rows[table].find((item) => item.id === id && item.status === 0);
                    if (!row) return [{ affectedRows: 0 }, []];
                    row.period = String(period);
                    row.time = time;
                    return [{ affectedRows: 1 }, []];
                }
                throw new Error(`Unsupported execute: ${sql}`);
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {
                if (releaseLock) releaseLock();
                releaseLock = null;
            },
        };
    }

    closeActive(type, game, result) {
        const active = this.rows[type]
            .filter((row) => row.game === game && row.status === 0)
            .sort((left, right) => Number(right.period) - Number(left.period) || right.id - left.id)[0];
        if (!active) return null;
        active.status = 1;
        active.result = result;
        return active.period;
    }

    injectDuplicateActive(type, game) {
        const active = this.rows[type].find((row) => row.game === game && row.status === 0);
        if (!active) return;
        this.rows[type].push({ ...active, id: this.nextId++ });
    }
}

const database = new FakeGameDatabase();
const games = [
    { type: 'wingo', game: 'wingo' },
    { type: 'k3', game: 1 },
    { type: '5d', game: 1 },
];
const cycles = Number(process.env.GAME_TEST_CYCLES || 2000);

for (const config of games) {
    const periods = [];
    let previousActive = null;

    for (let cycle = 0; cycle < cycles; cycle += 1) {
        if (cycle > 0 && cycle % 250 === 0) database.injectDuplicateActive(config.type, config.game);

        const activePeriods = await Promise.all(
            Array.from({ length: 8 }, () => ensureGameRound(config.type, config.game, database))
        );
        assert.equal(new Set(activePeriods).size, 1, `${config.type} produced competing active periods`);

        const activePeriod = activePeriods[0];
        if (previousActive !== null) {
            assert.equal(Number(activePeriod), Number(previousActive) + 1, `${config.type} skipped or repeated a period`);
        }

        const closedPeriod = database.closeActive(config.type, config.game, String(cycle % 10));
        assert.equal(closedPeriod, activePeriod, `${config.type} closed the wrong period`);
        periods.push(Number(closedPeriod));
        previousActive = activePeriod;
    }

    assert.equal(new Set(periods).size, periods.length, `${config.type} stored duplicate periods`);
    for (let index = 1; index < periods.length; index += 1) {
        assert.equal(periods[index], periods[index - 1] + 1, `${config.type} sequence is not contiguous`);
    }

    console.log(`${config.type}: ${cycles} concurrent round cycles passed`);
}

console.log(`Verified ${cycles * games.length} total round cycles with no repeats or skips.`);
