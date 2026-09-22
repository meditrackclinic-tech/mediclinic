import { describe, expect, it, vi } from "vitest";
import { migrateClinicalDatabase, copyExactRows, PROTECTED_TABLES } from "../../scripts/lib/clinical-migration.mjs";

const fields = ["id", "history_alerts", "symptom_terms", "created_at", "date_of_birth", "notes"];
const sample = {
  id: "synthetic-migration-record",
  history_alerts: '[{"label": "review", "value": "comma, quote\\\""}]',
  symptom_terms: '{"cough","chest pain"}',
  created_at: "2026-09-23 01:02:03.123456+00",
  date_of_birth: "2010-01-02",
  notes: null
};

function fixture({ existing = [], corrupt = false, failOnInsert = false, targetFields = {} } = {}) {
  const copied = new Map();
  const source = { query: vi.fn(async (sql) => {
    if (sql.includes("pg_class")) return { rows: PROTECTED_TABLES.map((name) => ({ name })) };
    if (sql.includes("information_schema.columns")) return { rows: fields.map((column_name) => ({ column_name })) };
    if (sql.includes("COUNT(*)")) return { rows: [{ count: 3 }] };
    if (sql.startsWith("SELECT")) return { rows: [{ ...sample }] };
    return { rows: [] };
  }) };
  const target = { query: vi.fn(async (sql, values) => {
    if (sql.includes("pg_class")) return { rows: existing.map((name) => ({ name })) };
    if (sql.includes("information_schema.columns")) return { rows: (targetFields[values[0]] || fields).map((column_name) => ({ column_name })) };
    if (sql.includes("pg_roles")) return { rows: [{ rolname: "anon" }, { rolname: "authenticated" }] };
    if (sql.includes("COUNT(*)")) return { rows: [{ count: 0 }] };
    const name = sql.match(/public\."([^\"]+)"/)?.[1];
    if (sql.startsWith("INSERT")) {
      if (failOnInsert) throw new Error("simulated insert failure");
      copied.set(name, Object.fromEntries(fields.map((field, index) => [field, values[index]])));
    }
    if (sql.startsWith("SELECT")) {
      return { rows: [corrupt ? { ...copied.get(name), notes: "corrupted" } : copied.get(name)] };
    }
    return { rows: [] };
  }) };
  return { source, target, initializeSchema: vi.fn(async () => {}) };
}

describe("clinical database migration", () => {
  it("copies serialized database types without converting JSON or timestamp precision", async () => {
    const { source, target } = fixture();
    await expect(copyExactRows(source, target, "visits")).resolves.toEqual({ source: 1, target: 1, contentMatches: true });
    const values = target.query.mock.calls.find(([sql]) => sql.startsWith("INSERT"))[1];
    expect(values).toEqual(fields.map((field) => sample[field]));
  });

  it("verifies content, excludes sessions, and secures tables before commit", async () => {
    const config = fixture();
    const result = await migrateClinicalDatabase(config);
    expect(result.skippedSessions).toBe(3);
    expect(config.initializeSchema).toHaveBeenCalledWith(config.target, { seedReferenceData: false });
    const commands = config.target.query.mock.calls.map(([sql]) => sql);
    expect(commands.filter((sql) => sql.includes("ENABLE ROW LEVEL SECURITY"))).toHaveLength(11);
    expect(commands.filter((sql) => sql.includes('FROM "anon"'))).toHaveLength(11);
    expect(commands.some((sql) => sql.startsWith('INSERT INTO public."user_sessions"'))).toBe(false);
    expect(commands.at(-1)).toBe("COMMIT");
  });

  it("refuses an occupied target before running schema initialization", async () => {
    const config = fixture({ existing: ["patients"] });
    await expect(migrateClinicalDatabase(config)).rejects.toThrow("Target already contains");
    expect(config.initializeSchema).not.toHaveBeenCalled();
    expect(config.target.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("reports missing columns on a later table before copying any rows", async () => {
    const config = fixture({ targetFields: { visits: fields.filter((field) => field !== "notes") } });
    await expect(migrateClinicalDatabase(config)).rejects.toThrow("target is missing columns: notes");
    expect(config.target.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
    expect(config.target.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(config.source.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("reports extra target columns instead of ignoring a schema mismatch", async () => {
    const config = fixture({ targetFields: { visits: [...fields, "new_column"] } });
    await expect(copyExactRows(config.source, config.target, "visits")).rejects.toThrow("target has extra columns: new_column");
    expect(config.target.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });

  it("preserves source column order when the target columns have a different order", async () => {
    const { source, target } = fixture({ targetFields: { visits: [...fields].reverse() } });
    await expect(copyExactRows(source, target, "visits")).resolves.toMatchObject({ contentMatches: true });
    expect(target.query.mock.calls.find(([sql]) => sql.startsWith("INSERT"))[1]).toEqual(fields.map((field) => sample[field]));
  });

  it.each([
    [{ corrupt: true }, "Content verification failed"],
    [{ failOnInsert: true }, "simulated insert failure"]
  ])("rolls back schema and data on failure: %s", async (options, expected) => {
    const config = fixture(options);
    await expect(migrateClinicalDatabase(config)).rejects.toThrow(expected);
    expect(config.target.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(config.source.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(config.target.query).not.toHaveBeenCalledWith("COMMIT");
  });
});
