import connection from "../config/connectDB.js";
import winGoController from "./winGoController.js";
import k5Controller from "./k5Controller.js";
import k3Controller from "./k3Controller.js";
import cron from 'node-cron';

const getLatestUniqueRounds = async (table, game) => {
    const [rounds] = await connection.query(`
        SELECT game_round.*
        FROM ${table} AS game_round
        INNER JOIN (
            SELECT MAX(id) AS id
            FROM ${table}
            WHERE game = ?
            GROUP BY period
        ) latest ON latest.id = game_round.id
        ORDER BY CAST(game_round.period AS UNSIGNED) DESC, game_round.id DESC
        LIMIT 2
    `, [game]);
    return rounds;
};

const getWinGoName = (game) => game === 1 ? 'wingo' : `wingo${game}`;

const runSafely = async (label, task) => {
    try {
        await task();
    } catch (error) {
        console.error(`${label} round failed:`, error);
    }
};

const runWinGoRound = async (game, io) => {
    const period = await winGoController.addWinGo(game);
    if (!period) return;
    await winGoController.handlingWinGo1P(game, period);
    const rounds = await getLatestUniqueRounds('`wingo`', getWinGoName(game));
    io.emit('data-server', { data: rounds });
};

const run5DRound = async (game, io) => {
    const period = await k5Controller.add5D(game);
    if (!period) return;
    await k5Controller.handling5D(game, period);
    const rounds = await getLatestUniqueRounds('`5d`', game);
    io.emit('data-server-5d', { data: rounds, game: String(game) });
};

const runK3Round = async (game, io) => {
    const period = await k3Controller.addK3(game);
    if (!period) return;
    await k3Controller.handlingK3(game, period);
    const rounds = await getLatestUniqueRounds('`k3`', game);
    io.emit('data-server-k3', { data: rounds, game: String(game) });
};

const runRoundCycle = async (game, io) => {
    await Promise.all([
        runSafely(`Wingo ${game}`, () => runWinGoRound(game, io)),
        runSafely(`5D ${game}`, () => run5DRound(game, io)),
        runSafely(`K3 ${game}`, () => runK3Round(game, io)),
    ]);
};

const cronJobGame1p = (io) => {
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
    cronJobGame1p
};
