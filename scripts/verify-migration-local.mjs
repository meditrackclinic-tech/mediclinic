import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createDatabasePoolConfig } from "../server/src/config/database.js";
import { migrateClinicalDatabase } from "./lib/clinical-migration.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(root, "server/.env") });
const connectionString = process.env.DATABASE_URL;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("This rollback-only migration rehearsal requires local PostgreSQL.");
}

const source = new pg.Client(createDatabasePoolConfig({ connectionString }));
const target = new pg.Client(createDatabasePoolConfig({ connectionString }));
// The generated identifier never includes user input. Nothing is committed.
const schema = `meditrack_rehearsal_${randomUUID().replaceAll("-", "")}`;
let applicationPool;
let rolledBack = false;
try {
  await source.connect();
  await target.connect();
  const { initializePostgres, pool } = await import("../server/src/data/postgres.js");
  applicationPool = pool;
  const isolatedTarget = { query: async (sql, params) => {
    if (sql === "BEGIN") {
      await target.query("BEGIN");
      return target.query(`CREATE SCHEMA "${schema}"`);
    }
    if (sql === "COMMIT") {
      const result = await target.query("ROLLBACK");
      rolledBack = true;
      return result;
    }
    if (sql === "SET LOCAL search_path TO public") {
      // Do not include public: unqualified initialization must never use live tables.
      return target.query(`SET LOCAL search_path TO "${schema}"`);
    }
    return target.query(sql.replaceAll("'public'", `'${schema}'`).replaceAll("public.", `"${schema}".`), params);
  } };
  const result = await migrateClinicalDatabase({
    source, target: isolatedTarget, initializeSchema: initializePostgres,
    onProgress: (table, count) => console.log(`Rehearsal verified ${table}: ${count} records`)
  });
  const remaining = await target.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema]);
  if (!rolledBack || remaining.rowCount !== 0) throw new Error("Rehearsal cleanup verification failed.");
  console.log(JSON.stringify({
    success: result.success, localRehearsalOnly: true,
    verification: result.verification, skippedSessions: result.skippedSessions,
    temporarySchemaRolledBack: true, applicationSettingsChanged: false
  }, null, 2));
} catch (error) {
  // Do not expose PostgreSQL details, which can contain patient data.
  console.error(`Local rehearsal failed (${error.code || "verification_error"}). No changes were committed.`);
  process.exitCode = 1;
} finally {
  await source.query("ROLLBACK").catch(() => {});
  await target.query("ROLLBACK").catch(() => {});
  await source.end().catch(() => {});
  await target.end().catch(() => {});
  await applicationPool?.end();
}
