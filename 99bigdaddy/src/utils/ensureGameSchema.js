import connection from "../config/connectDB.js";

let ensurePromise = null;

const columnExists = async (table, column) => {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const columnType = async (table, column) => {
  const [rows] = await connection.query(
    "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [table, column],
  );
  return rows?.[0]?.DATA_TYPE || "";
};

const ensureColumn = async (table, column, definition) => {
  if (await columnExists(table, column)) return;
  await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
};

const ensureColumnType = async (table, column, dataType, definition) => {
  const existingType = String(await columnType(table, column)).toLowerCase();
  if (existingType === dataType.toLowerCase()) return;
  await connection.execute(`ALTER TABLE \`${table}\` MODIFY COLUMN ${definition}`);
};

const ensureIndex = async (table, indexName, columns) => {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, indexName],
  );
  if (Number(rows?.[0]?.count || 0) > 0) return;
  await connection.execute(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
};

const repairGameSchema = async () => {
  await ensureColumn("minutes_1", "id_product", "`id_product` VARCHAR(64) DEFAULT NULL");
  await ensureColumn("minutes_1", "code", "`code` VARCHAR(64) DEFAULT NULL");
  await ensureColumn("minutes_1", "invite", "`invite` VARCHAR(64) DEFAULT NULL");
  await ensureColumn("minutes_1", "fee", "`fee` DECIMAL(20,2) NOT NULL DEFAULT 0");
  await ensureColumn("minutes_1", "get", "`get` DECIMAL(20,2) NOT NULL DEFAULT 0");
  await ensureColumnType("minutes_1", "today", "varchar", "`today` VARCHAR(64) DEFAULT NULL");
  await ensureColumnType("minutes_1", "time", "bigint", "`time` BIGINT NOT NULL DEFAULT 0");
  await ensureIndex("minutes_1", "idx_minutes_1_game_stage_status", "`game`, `stage`, `status`");

  await ensureColumn("result_k3", "join_bet", "`join_bet` VARCHAR(32) DEFAULT NULL");
  await ensureColumn("result_k3", "typeGame", "`typeGame` VARCHAR(64) DEFAULT NULL");
  await ensureIndex("result_k3", "idx_result_k3_game_stage_status", "`game`, `stage`, `status`");
  await ensureIndex("result_5d", "idx_result_5d_game_stage_status", "`game`, `stage`, `status`");
};

const ensureGameSchema = async () => {
  const skipDb = (process.env.SKIP_DB || "").toString().trim().toLowerCase() === "true";
  if (skipDb) return;
  if (!ensurePromise) {
    ensurePromise = repairGameSchema().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

export default ensureGameSchema;
