import { describe, expect, it, vi } from "vitest";
import { initializePostgres } from "../src/data/postgres.js";

describe("PostgreSQL schema initialization", () => {
  it("retains digital queue columns in both new and existing visit tables", async () => {
    const database = { query: vi.fn(async () => ({ rows: [] })) };
    await initializePostgres(database, { seedReferenceData: false });
    const statements = database.query.mock.calls.map(([sql]) => sql);
    const create = statements.find((sql) => sql.includes("CREATE TABLE IF NOT EXISTS visits"));
    for (const definition of ["queue_number TEXT", "queued_at TIMESTAMPTZ", "nurse_started_at TIMESTAMPTZ"]) {
      expect(create).toContain(definition);
      expect(statements.some((sql) => sql.includes("ALTER TABLE visits") && sql.includes(`ADD COLUMN IF NOT EXISTS ${definition}`))).toBe(true);
    }
    expect(statements.some((sql) => /INSERT INTO (roles|clinics)/.test(sql))).toBe(false);
  });
});
