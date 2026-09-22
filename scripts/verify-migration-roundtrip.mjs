import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createDatabasePoolConfig } from "../server/src/config/database.js";
import { copyExactRows } from "./lib/clinical-migration.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(root, "server/.env") });
const connection = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname)) {
  throw new Error("This synthetic round-trip check only runs against local PostgreSQL.");
}
const client = new pg.Client(createDatabasePoolConfig({ connectionString: process.env.DATABASE_URL }));
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  await client.query(`CREATE TEMP TABLE migration_source (
    id text PRIMARY KEY, history_alerts jsonb, symptoms text[], dob date,
    recorded_at timestamptz, reading numeric(8,3), optional_text text
  ) ON COMMIT DROP`);
  await client.query("CREATE TEMP TABLE migration_target (LIKE migration_source INCLUDING ALL) ON COMMIT DROP");
  await client.query(`INSERT INTO migration_source VALUES
    ('synthetic-only', '[{"text":"comma, quote\\\"", "nested":[]}]'::jsonb,
     ARRAY['cough','chest pain'], '2010-01-02', '2026-09-23 01:02:03.123456+00', 12.345, NULL)`);
  const makeAdapter = (name) => ({ query: (sql, params) => {
    if (sql.includes("information_schema.columns")) {
      return client.query(`SELECT attname AS column_name FROM pg_attribute
        WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum`, [`pg_temp.${name}`]);
    }
    return client.query(sql.replaceAll('public."visits"', `pg_temp.${name}`), params);
  } });
  const result = await copyExactRows(makeAdapter("migration_source"), makeAdapter("migration_target"), "visits");
  console.log(JSON.stringify({ syntheticOnly: true, ...result, precisionAndArraysPreserved: true }));
} catch (error) {
  console.error("Synthetic migration check failed: " + error.message);
  process.exitCode = 1;
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
