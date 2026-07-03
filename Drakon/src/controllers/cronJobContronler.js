import connection from "../config/connectDB.js";
import winGoController from "./winGoController.js";
import k5Controller from "./k5Controller.js";
import k3Controller from "./k3Controller.js";
import cron from 'node-cron';
import ensureGameSchema from "../utils/ensureGameSchema.js";
import { claimRoundExecution, releaseRoundExecution } from "../utils/gameRoundScheduler.js";

const getRoundSnapshot = async (table, game, settledPeriod) => {
    const [[activeRows], [settledRows]] = await Promise.all([
        connection.query(
            `SELECT * FROM ${table} WHERE game = ? AND status = 0 ORDER BY CAST(period AS UNSIGNED) DESC, id DESC LIMIT 1`,
            [game]
        ),
        connection.query(
            `SELECT * FROM ${table} WHERE game = ? AND period = ? AND status != 0 ORDER BY id DESC LIMIT 1`,
            [game, String(settledPeriod)]
        ),
    ]);
    return [activeRows[0], settledRows[0]].filter(Boolean);
};

const getWinGoName = (game) => game === 1 ? 'wingo' : `wingo${game}`;

const runSafely = async (type, game, now, task, attempt = 0) => {
    let slot = null;
    try {
        const claim = await claimRoundExecution(type, game, now, connection);
        slot = claim.slot;
        if (!claim.claimed) return;
        await task();
    } catch (error) {
        if (slot !== null) {
            try { await releaseRoundExecution(type, game, slot, connection); } catch (releaseError) {}
        }
        console.error(`${type.toUpperCase()} ${game} round failed:`, error);
        if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return runSafely(type, game, now, task, attempt + 1);
        }
    }
};

const runWinGoRound = async (game, io) => {
    const period = await winGoController.addWinGo(game);
    if (!period) throw new Error('Wingo round did not close');
    const rounds = await getRoundSnapshot('`wingo`', getWinGoName(game), period);
    io.emit('data-server', { data: rounds, settled: false });
    await winGoController.handlingWinGo1P(game, period);
    const latestRounds = await getRoundSnapshot('`wingo`', getWinGoName(game), period);
    io.emit('data-server', { data: latestRounds, settled: true });
};

const run5DRound = async (game, io) => {
    const period = await k5Controller.add5D(game);
    if (!period) throw new Error('5D round did not close');
    const rounds = await getRoundSnapshot('`5d`', game, period);
    io.emit('data-server-5d', { data: rounds, game: String(game) });
    await k5Controller.handling5D(game, period);
    io.emit('game-settled', { type: '5d', game: String(game), period });
};

const runK3Round = async (game, io) => {
    const period = await k3Controller.addK3(game);
    if (!period) throw new Error('K3 round did not close');
    const rounds = await getRoundSnapshot('`k3`', game, period);
    io.emit('data-server-k3', { data: rounds, game: String(game) });
    await k3Controller.handlingK3(game, period);
    io.emit('game-settled', { type: 'k3', game: String(game), period });
};

const runRoundCycle = async (game, io, now = Date.now()) => {
    await ensureGameSchema();
    await Promise.all([
        runSafely('wingo', game, now, () => runWinGoRound(game, io)),
        runSafely('5d', game, now, () => run5DRound(game, io)),
        runSafely('k3', game, now, () => runK3Round(game, io)),
    ]);
};

const cronJobGame1p = (io) => {
    ensureGameSchema().catch((error) => console.error('Game schema initialization failed:', error));
    cron.schedule('*/1 * * * *', () => runRoundCycle(1, io));
    cron.schedule('*/3 * * * *', () => runRoundCycle(3, io));
    cron.schedule('*/5 * * * *', () => runRoundCycle(5, io));
    cron.schedule('*/10 * * * *', () => runRoundCycle(10, io));

    cron.schedule('* * 0 * * *', async() => {
        await connection.execute('UPDATE users SET roses_today = ?', [0]);
        await connection.execute('UPDATE point_list SET money = ?', [0]);
    });
}

export default {
    cronJobGame1p,
    runRoundCycle,
};
