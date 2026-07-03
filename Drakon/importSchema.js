import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";

const requiredEnv = [
  "MYSQLHOST",
  "MYSQLPORT",
  "MYSQLUSER",
  "MYSQLPASSWORD",
  "MYSQLDATABASE",
];

function getMissingEnvVars() {
  return requiredEnv.filter((key) => !process.env[key]);
}

function extractCreateTableStatements(sqlText) {
  const matches = sqlText.match(/CREATE\s+TABLE[\s\S]*?;/gi);
  return matches || [];
}

async function main() {
  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), "schema.sql");
  let schemaSql;

  try {
    schemaSql = await fs.readFile(schemaPath, "utf8");
  } catch (error) {
    console.error(`Failed to read schema file at ${schemaPath}`);
    console.error(error.message);
    process.exit(1);
  }

  const createStatements = extractCreateTableStatements(schemaSql);
  if (createStatements.length === 0) {
    console.error("No CREATE TABLE statements found in schema.sql");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    port: Number(process.env.MYSQLPORT),
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
  });

  try {
    for (let i = 0; i < createStatements.length; i += 1) {
      const statement = createStatements[i];
      try {
        await connection.execute(statement);
        console.log(`OK ${i + 1}/${createStatements.length}`);
      } catch (error) {
        console.error(`Failed on statement ${i + 1}/${createStatements.length}`);
        console.error(`SQL Error Code: ${error.code || "UNKNOWN"}`);
        console.error(`SQL Error Number: ${error.errno || "UNKNOWN"}`);
        console.error(`SQL Message: ${error.sqlMessage || error.message}`);
        console.error("Statement:");
        console.error(statement);
        process.exit(1);
      }
    }

    console.log(
      `Schema import completed successfully. Executed ${createStatements.length} CREATE TABLE statements.`
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Unexpected error during schema import.");
  console.error(error.message);
  process.exit(1);
});
