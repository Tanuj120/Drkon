const GAME_TYPES = new Set(["wingo", "k3", "5d"]);

const getRoundSlot = (game, now = Date.now()) => {
  const durationMinutes = Number(game);
  if (![1, 3, 5, 10].includes(durationMinutes)) {
    throw new Error(`Unsupported game duration: ${game}`);
  }
  return Math.floor(Number(now) / (durationMinutes * 60_000));
};

const claimRoundExecution = async (type, game, now, source) => {
  if (!GAME_TYPES.has(type)) throw new Error(`Unsupported game type: ${type}`);
  if (!source || typeof source.execute !== "function") throw new Error("A database connection is required");

  const gameNumber = Number(game);
  const slot = getRoundSlot(gameNumber, now ?? Date.now());
  const [result] = await source.execute(
    `INSERT IGNORE INTO game_round_executions
      (game_type, game, round_slot, created_at)
     VALUES (?, ?, ?, ?)`,
    [type, gameNumber, String(slot), Date.now()],
  );

  return {
    claimed: Number(result?.affectedRows || 0) === 1,
    slot,
  };
};

const releaseRoundExecution = async (type, game, slot, source) => {
  if (!source || typeof source.execute !== "function") throw new Error("A database connection is required");
  await source.execute(
    "DELETE FROM game_round_executions WHERE game_type = ? AND game = ? AND round_slot = ?",
    [type, Number(game), String(slot)],
  );
};

export { claimRoundExecution, getRoundSlot, releaseRoundExecution };
