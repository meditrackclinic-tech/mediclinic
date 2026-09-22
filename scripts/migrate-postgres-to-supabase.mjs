import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createDatabasePoolConfig, isSupabaseConnectionString } from "../server/src/config/database.js";
import { migrateClinicalDatabase } from "./lib/clinical-migration.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: process.env.MIGRATION_ENV_PATH || resolve(projectRoot, "server/.env") });
const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const targetUrl = process.env.SUPABASE_DATABASE_URL;
let source;
let target;
let applicationPool;

try {
  if (!sourceUrl) throw new Error("The source DATABASE_URL is not configured.");
  if (!targetUrl) throw new Error("A Supabase connection is required. Run npm.cmd run database:migrate:supabase.");
  const targetAddress = new URL(targetUrl);
  if (!["postgres:", "postgresql:"].includes(targetAddress.protocol) || !isSupabaseConnectionString(targetUrl)) {
    throw new Error("The target must be a Supabase PostgreSQL connection string.");
  }
  // Transaction pooling is supported: all target schema/data operations stay on
  // one client inside one transaction and use unnamed parameterized statements.
  if (!targetAddress.password || targetAddress.password.includes("YOUR-PASSWORD")) {
    throw new Error("Replace the password placeholder in the Supabase connection string.");
  }
  if (sourceUrl === targetUrl) throw new Error("Source and target must be different databases.");

  source = new pg.Client(createDatabasePoolConfig({ connectionString: sourceUrl }));
  target = new pg.Client(createDatabasePoolConfig({
    connectionString: targetUrl, sslMode: "true", sslRejectUnauthorized: true
  }));
  console.log("Connecting to local PostgreSQL...");
  await source.connect();
  console.log(`Connecting securely to Supabase on port ${targetAddress.port || "5432"}...`);
  await target.connect();
  const { initializePostgres, pool } = await import("../server/src/data/postgres.js");
  applicationPool = pool;
  const result = await migrateClinicalDatabase({
    source, target, initializeSchema: initializePostgres,
    onProgress: (table, count) => console.log("Verified " + table + ": " + count + " records")
  });
  console.log(JSON.stringify(result, null, 2));
  console.log("Existing passwords were preserved; staff will need to sign in again.");
} catch (error) {
  // PostgreSQL error details can contain patient rows; never print the error object.
  const message = String(error.message || "Migration failed")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection hidden]")
    .replace(/"[^"]*"/g, '"[redacted]"');
  console.error("Migration failed: " + message + ". Application database settings have not been changed.");
  process.exitCode = 1;
} finally {
  await source?.end().catch(() => {});
  await target?.end().catch(() => {});
  await applicationPool?.end();
}
