import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {
  createDatabasePoolConfig,
  databaseProvider
} from "../server/src/config/database.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(projectRoot, "server/.env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured in server/.env.");
}

const tables = [
  "roles",
  "clinics",
  "users",
  "user_sessions",
  "patients",
  "visits",
  "doctor_reviews",
  "symptom_records",
  "vitals",
  "prescriptions",
  "audit_logs"
];

const pool = new pg.Pool(createDatabasePoolConfig({ connectionString }));

try {
  const metadata = await pool.query(`
    SELECT
      current_database() AS database,
      version() AS version,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS ssl,
      pg_size_pretty(pg_database_size(current_database())) AS size;
  `);
  const counts = {};

  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table};`);
    counts[table] = Number(result.rows[0].count);
  }

  console.log(
    JSON.stringify(
      {
        provider: databaseProvider(connectionString),
        database: metadata.rows[0].database,
        version: metadata.rows[0].version.split(" on ")[0],
        ssl: metadata.rows[0].ssl,
        size: metadata.rows[0].size,
        counts
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
