import connection from '../config/connectDB.js';

const ALLOWED_BET_TABLES = new Set(['minutes_1', 'result_k3', 'result_5d']);

const creditGamePayout = async ({ table, betId, phone, payout }) => {
    if (!ALLOWED_BET_TABLES.has(table)) throw new Error(`Unsupported payout table: ${table}`);
    const calculatedAmount = Number(Number(payout || 0).toFixed(2));
    if (!Number.isFinite(calculatedAmount)) throw new Error('Invalid game payout amount');
    const amount = Math.max(calculatedAmount, 0);

    const db = typeof connection.getConnection === 'function' ? await connection.getConnection() : connection;
    const transactional = db !== connection;
    try {
        if (transactional) await db.beginTransaction();
        const [claimResult] = await db.execute(
            `UPDATE \`${table}\` SET \`get\` = ?, \`status\` = 1 WHERE \`id\` = ? AND \`status\` = 0`,
            [amount, betId]
        );
        if (!claimResult.affectedRows) {
            if (transactional) await db.rollback();
            return false;
        }
        if (amount > 0) {
            await db.execute('UPDATE `users` SET `money` = `money` + ? WHERE `phone` = ?', [amount, phone]);
        }
        if (transactional) await db.commit();
        return true;
    } catch (error) {
        if (transactional) {
            try { await db.rollback(); } catch (rollbackError) {}
        }
        throw error;
    } finally {
        if (transactional) db.release();
    }
};

export default creditGamePayout;
