import { createHash } from "node:crypto";

export const CLINICAL_TABLES = Object.freeze([
  "roles", "clinics", "users", "patients", "visits", "doctor_reviews",
  "symptom_records", "vitals", "prescriptions", "audit_logs"
]);
export const PROTECTED_TABLES = Object.freeze([...CLINICAL_TABLES, "user_sessions"]);

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function existingTables(client) {
  const result = await client.query(
    `SELECT c.relname AS name FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [PROTECTED_TABLES]
  );
  return result.rows.map((row) => row.name);
}

async function columnsFor(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

export async function readExactRows(client, table, columns) {
  // PostgreSQL serializes its own types, preserving arrays, dates and timestamp precision.
  const projection = columns.map((name) => `${quote(name)}::text AS ${quote(name)}`).join(", ");
  return (await client.query(
    `SELECT ${projection} FROM public.${quote(table)} ORDER BY id COLLATE "C"`
  )).rows;
}

export function rowsDigest(rows) {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(JSON.stringify(row)).update("\n");
  return hash.digest("hex");
}

async function validateTableColumns(source, target, table) {
  const columns = await columnsFor(source, table);
  if (!columns.length) throw new Error(`Source table missing: ${table}.`);
  const targetColumns = await columnsFor(target, table);
  const missing = columns.filter((column) => !targetColumns.includes(column));
  const extra = targetColumns.filter((column) => !columns.includes(column));
  if (missing.length || extra.length) {
    const differences = [
      missing.length && `target is missing columns: ${missing.join(", ")}`,
      extra.length && `target has extra columns: ${extra.join(", ")}`
    ].filter(Boolean).join("; ");
    throw new Error(`Schema mismatch for ${table}; ${differences}. No source fields will be skipped.`);
  }
  return columns;
}

async function copyRowsWithColumns(source, target, table, columns) {
  const rows = await readExactRows(source, table, columns);
  const insert = `INSERT INTO public.${quote(table)} (${columns.map(quote).join(", ")})
    VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`;
  for (const row of rows) await target.query(insert, columns.map((column) => row[column]));
  const copiedRows = await readExactRows(target, table, columns);
  if (rows.length !== copiedRows.length || rowsDigest(rows) !== rowsDigest(copiedRows)) {
    throw new Error(`Content verification failed for ${table}; the target transaction will be rolled back.`);
  }
  return { source: rows.length, target: copiedRows.length, contentMatches: true };
}

export async function copyExactRows(source, target, table) {
  const columns = await validateTableColumns(source, target, table);
  return copyRowsWithColumns(source, target, table, columns);
}

export async function migrateClinicalDatabase({ source, target, initializeSchema, onProgress = () => {} }) {
  let sourceTransaction = false;
  let targetTransaction = false;
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransaction = true;
    await source.query("SET LOCAL TIME ZONE 'UTC'");
    await source.query("SET LOCAL DateStyle = 'ISO, YMD'");
    const available = await existingTables(source);
    if (PROTECTED_TABLES.some((table) => !available.includes(table))) {
      throw new Error("The source does not contain the complete MediTrack schema.");
    }
    await target.query("BEGIN");
    targetTransaction = true;
    await target.query("SET LOCAL search_path TO public");
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    await target.query("SET LOCAL DateStyle = 'ISO, YMD'");
    const existing = await existingTables(target);
    if (existing.length) {
      throw new Error(`Target already contains MediTrack tables: ${existing.join(", ")}. No changes were made; use a fresh project.`);
    }
    await initializeSchema(target, { seedReferenceData: false });
    // Check every table before copying any rows, including fields retained from
    // earlier app versions. Never fix a mismatch by silently dropping columns.
    const columnPlans = new Map();
    for (const table of CLINICAL_TABLES) {
      columnPlans.set(table, await validateTableColumns(source, target, table));
    }
    const verification = {};
    for (const table of CLINICAL_TABLES) {
      verification[table] = await copyRowsWithColumns(source, target, table, columnPlans.get(table));
      onProgress(table, verification[table].source);
    }
    const apiRoles = (await target.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')"
    )).rows.map((row) => row.rolname);
    for (const table of PROTECTED_TABLES) {
      await target.query(`ALTER TABLE public.${quote(table)} ENABLE ROW LEVEL SECURITY`);
      await target.query(`REVOKE ALL ON TABLE public.${quote(table)} FROM PUBLIC`);
      for (const role of apiRoles) {
        await target.query(`REVOKE ALL ON TABLE public.${quote(table)} FROM ${quote(role)}`);
      }
    }
    const skippedSessions = Number((await source.query(
      "SELECT COUNT(*)::int AS count FROM public.user_sessions"
    )).rows[0].count);
    const copiedSessions = Number((await target.query(
      "SELECT COUNT(*)::int AS count FROM public.user_sessions"
    )).rows[0].count);
    if (copiedSessions !== 0) throw new Error("Session exclusion verification failed.");
    await target.query("COMMIT");
    targetTransaction = false;
    await source.query("COMMIT");
    sourceTransaction = false;
    return { success: true, verification, skippedSessions, rowLevelSecurity: PROTECTED_TABLES };
  } catch (error) {
    if (targetTransaction) await target.query("ROLLBACK").catch(() => {});
    if (sourceTransaction) await source.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
