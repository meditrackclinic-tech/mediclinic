import { X509Certificate } from "node:crypto";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDatabasePoolConfig,
  databaseProvider,
  isSupabaseConnectionString
} from "../src/config/database.js";

describe("database connection configuration", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_SSL", "auto");
    vi.stubEnv("DATABASE_SSL_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("DATABASE_SSL_CA", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recognises direct and pooled Supabase connection strings", () => {
    expect(
      isSupabaseConnectionString(
        "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres"
      )
    ).toBe(true);
    expect(
      isSupabaseConnectionString(
        "postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:5432/postgres"
      )
    ).toBe(true);
    expect(isSupabaseConnectionString("postgresql://app:password@localhost:5432/clinic")).toBe(
      false
    );
  });

  it.each([5432, 6543])("enables verified SSL with the Supabase CA on port %s", (port) => {
    const config = createDatabasePoolConfig({
      connectionString:
        `postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:${port}/postgres`
    });

    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(new X509Certificate(config.ssl.ca).ca).toBe(true);
    expect(new pg.Client(config).ssl).toEqual(config.ssl);
    expect(config.application_name).toBe("meditrack-nlp");
  });

  it.each(["require", "no-verify", "disable"])("keeps explicit certificate verification despite URI sslmode=%s", (mode) => {
    const config = createDatabasePoolConfig({
      connectionString:
        `postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=${mode}&application_name=migration`
    });
    const address = new URL(config.connectionString);
    expect(address.searchParams.has("sslmode")).toBe(false);
    expect(address.searchParams.get("application_name")).toBe("migration");
    expect(new pg.Client(config).ssl).toEqual({ rejectUnauthorized: true, ca: config.ssl.ca });
    expect(config.ssl.ca).toContain("-----BEGIN CERTIFICATE-----");
  });

  it("preserves an explicitly supplied CA and expands escaped newlines", () => {
    const config = createDatabasePoolConfig({
      connectionString: "postgresql://app:password@database.example:5432/clinic?sslmode=require",
      sslMode: "true",
      sslCa: "custom\\ncertificate"
    });
    expect(new pg.Client(config).ssl).toEqual({ rejectUnauthorized: true, ca: "custom\ncertificate" });
  });

  it("keeps local PostgreSQL non-SSL unless explicitly enabled", () => {
    const config = createDatabasePoolConfig({
      connectionString: "postgresql://app:password@localhost:5432/clinic"
    });

    expect(config.ssl).toBeUndefined();
    expect(databaseProvider(config.connectionString)).toBe("postgresql");
  });
});
