import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

const run = promisify(execFile);
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: process.env.MIGRATION_ENV_PATH || join(projectRoot, "server/.env") });

async function findPostgresTool(name) {
  if (process.env.PG_BIN_DIR) return join(process.env.PG_BIN_DIR, name + (process.platform === "win32" ? ".exe" : ""));
  if (process.platform !== "win32") return name;
  const root = join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL");
  const versions = (await readdir(root)).sort((a, b) => Number.parseInt(b) - Number.parseInt(a));
  for (const version of versions) {
    const tool = join(root, version, "bin", `${name}.exe`);
    if (await access(tool).then(() => true, () => false)) return tool;
  }
  throw new Error("PostgreSQL backup tools were not found. Set PG_BIN_DIR to the PostgreSQL bin folder.");
}

try {
  const source = new URL(process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error("This backup helper expects the current local PostgreSQL database.");
  }
  const backupRoot = join(process.env.LOCALAPPDATA || homedir(), "MediTrack", "backups");
  await mkdir(backupRoot, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const file = join(backupRoot, `before-supabase-${stamp}-${randomUUID().slice(0, 8)}.dump`);
  // Credentials are passed privately through the child environment, never CLI arguments.
  const connectionEnv = {
    ...process.env,
    PGHOST: source.hostname,
    PGPORT: source.port || "5432",
    PGUSER: decodeURIComponent(source.username),
    PGPASSWORD: decodeURIComponent(source.password),
    PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "15",
    PGSSLMODE: "prefer"
  };
  await run(await findPostgresTool("pg_dump"), [
    "--format=custom", "--no-owner", "--no-privileges", "--no-password", "--file", file
  ], { env: connectionEnv, windowsHide: true });
  await run(await findPostgresTool("pg_restore"), ["--list", file], { windowsHide: true });
  console.log(JSON.stringify({ success: true, archiveReadable: true, path: file, bytes: (await stat(file)).size }, null, 2));
} catch {
  console.error("Backup failed. Check the local database connection and PostgreSQL backup tools. No database was changed.");
  process.exitCode = 1;
}
