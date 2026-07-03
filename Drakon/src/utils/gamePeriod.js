import connection from '../config/connectDB.js';
import { randomInteger } from './fairRandom.js';

const GAME_CONFIG = {
    wingo: {
        roundTable: '`wingo`',
        resultColumn: '`amount`',
        betTable: '`minutes_1`',
        resultLength: 1,
        resultCharacters: '0123456789',
    },
    k3: {
        roundTable: '`k3`',
        resultColumn: '`result`',
        betTable: '`result_k3`',
        resultLength: 3,
        resultCharacters: '123456',
    },
    '5d': {
        roundTable: '`5d`',
        resultColumn: '`result`',
        betTable: '`result_5d`',
        resultLength: 5,
        resultCharacters: '0123456789',
    },
};

const makeInitialPeriod = () => {
    const date = new Date();
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return Number(`${year}${month}${day}10000`);
};

const makeResult = ({ resultLength, resultCharacters }) => {
    let result = '';
    for (let index = 0; index < resultLength; index++) {
        result += resultCharacters.charAt(randomInteger(0, resultCharacters.length - 1));
    }
    return result;
};

const getClient = async (source) => {
    if (typeof source.getConnection === 'function') {
        const db = await source.getConnection();
        return {
            db,
            begin: () => db.beginTransaction(),
            commit: () => db.commit(),
            rollback: () => db.rollback(),
            release: () => db.release(),
        };
    }
    return {
        db: source,
        begin: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
    };
};

const movePendingBets = async (db, config, game, fromPeriod, toPeriod) => {
    if (String(fromPeriod) === String(toPeriod)) return;
    await db.execute(
        `UPDATE ${config.betTable} SET stage = ? WHERE stage = ? AND game = ? AND status = 0`,
        [String(toPeriod), String(fromPeriod), game]
    );
};

const ensureGameRound = async (type, game, source = connection) => {
    const config = GAME_CONFIG[type];
    if (!config) throw new Error(`Unsupported game period type: ${type}`);

    const client = await getClient(source);
    const lockName = `drakon:period:${type}:${game}`;
    let lockAcquired = false;
    try {
        const [lockRows] = await client.db.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
        if (lockRows?.[0] && Number(lockRows[0].acquired) !== 1) {
            throw new Error(`Could not acquire ${type} period lock for game ${game}`);
        }
        lockAcquired = Boolean(lockRows?.[0]);
        await client.begin();
        const [activeRowsRaw] = await client.db.query(
            `SELECT id, period, status FROM ${config.roundTable} WHERE game = ? AND status = 0 ORDER BY CAST(period AS UNSIGNED) DESC, id DESC FOR UPDATE`,
            [game]
        );
        const [completedRowsRaw] = await client.db.query(
            `SELECT id, period, status FROM ${config.roundTable} WHERE game = ? AND status != 0 ORDER BY CAST(period AS UNSIGNED) DESC, id DESC LIMIT 1 FOR UPDATE`,
            [game]
        );
        const now = Date.now();

        if (!activeRowsRaw.length && !completedRowsRaw.length) {
            const basePeriod = makeInitialPeriod();
            await client.db.execute(
                `INSERT INTO ${config.roundTable} (period, ${config.resultColumn}, game, status, time) VALUES (?, ?, ?, 1, ?)`,
                [String(basePeriod), makeResult(config), game, now]
            );
            await client.db.execute(
                `INSERT INTO ${config.roundTable} (period, ${config.resultColumn}, game, status, time) VALUES (?, 0, ?, 0, ?)`,
                [String(basePeriod + 1), game, now]
            );
            await client.commit();
            return String(basePeriod + 1);
        }

        const activeRows = activeRowsRaw.filter((row) => Number.isSafeInteger(Number(row.period)));
        const completedRows = completedRowsRaw.filter((row) => Number.isSafeInteger(Number(row.period)));
        if (!activeRows.length && !completedRows.length) throw new Error(`No valid ${type} periods found for game ${game}`);
        const highestCompleted = completedRows.length ? Number(completedRows[0].period) : 0;

        if (!activeRows.length) {
            const nextPeriod = highestCompleted + 1;
            await client.db.execute(
                `INSERT INTO ${config.roundTable} (period, ${config.resultColumn}, game, status, time) VALUES (?, 0, ?, 0, ?)`,
                [String(nextPeriod), game, now]
            );
            await client.commit();
            return String(nextPeriod);
        }

        activeRows.sort((left, right) => Number(right.period) - Number(left.period) || Number(right.id) - Number(left.id));
        const keeper = activeRows[0];
        const canonicalPeriod = Math.max(Number(keeper.period), highestCompleted + 1);

        for (const duplicate of activeRows.slice(1)) {
            await movePendingBets(client.db, config, game, duplicate.period, canonicalPeriod);
            await client.db.execute(`DELETE FROM ${config.roundTable} WHERE id = ? AND status = 0`, [duplicate.id]);
        }

        await movePendingBets(client.db, config, game, keeper.period, canonicalPeriod);
        if (Number(keeper.period) !== canonicalPeriod) {
            await client.db.execute(
                `UPDATE ${config.roundTable} SET period = ?, time = ? WHERE id = ? AND status = 0`,
                [String(canonicalPeriod), now, keeper.id]
            );
        }

        await client.commit();
        return String(canonicalPeriod);
    } catch (error) {
        try { await client.rollback(); } catch (rollbackError) {}
        throw error;
    } finally {
        if (lockAcquired) {
            try { await client.db.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch (lockError) {}
        }
        client.release();
    }
};

export { ensureGameRound };
