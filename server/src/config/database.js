import { readFileSync } from "node:fs";

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function connectionHostname(connectionString) {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isSupabaseConnectionString(connectionString) {
  const hostname = connectionHostname(connectionString);
  return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
}

export function databaseProvider(connectionString) {
  if (!connectionString) {
    return "none";
  }

  return isSupabaseConnectionString(connectionString) ? "supabase" : "postgresql";
}

export function createDatabasePoolConfig({
  connectionString,
  sslMode = process.env.DATABASE_SSL || "auto",
  sslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
  sslCa = process.env.DATABASE_SSL_CA,
  max = process.env.DATABASE_POOL_MAX,
  idleTimeoutMillis = process.env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis = process.env.DATABASE_CONNECTION_TIMEOUT_MS
}) {
  const useSsl =
    String(sslMode).toLowerCase() === "auto"
      ? isSupabaseConnectionString(connectionString)
      : parseBoolean(sslMode, false);
  const ca = sslCa?.replace(/\\n/g, "\n") || (useSsl && isSupabaseConnectionString(connectionString)
    ? readFileSync(new URL("../../certs/supabase-prod-ca-2021.crt", import.meta.url), "utf8")
    : undefined);

  // node-postgres parses URI SSL options last; do not let sslmode=require silently
  // replace the explicit CA and certificate-verification settings below.
  if (useSsl) {
    const address = new URL(connectionString);
    for (const option of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      address.searchParams.delete(option);
    }
    connectionString = address.toString();
  }

  return {
    connectionString,
    max: Number(max || 10),
    idleTimeoutMillis: Number(idleTimeoutMillis || 30000),
    connectionTimeoutMillis: Number(connectionTimeoutMillis || 15000),
    application_name: "meditrack-nlp",
    ...(useSsl
      ? {
          ssl: {
            rejectUnauthorized: parseBoolean(sslRejectUnauthorized, true),
            ...(ca ? { ca } : {})
          }
        }
      : {})
  };
}
