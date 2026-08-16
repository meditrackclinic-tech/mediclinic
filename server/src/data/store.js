import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { systemAdmin } from "../config/systemAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseFileName = process.env.NODE_ENV === "test" ? "test-database.json" : "database.json";
const databasePath = path.resolve(__dirname, "../../data", databaseFileName);
let writeQueue = Promise.resolve();

const now = () => new Date().toISOString();

const demoUserSeeds = [
  {
    id: systemAdmin.id,
    name: systemAdmin.name,
    email: systemAdmin.email,
    password: systemAdmin.defaultPassword,
    role: "admin"
  }
];

async function buildDemoUser(seed) {
  return {
    id: seed.id,
    name: seed.name,
    email: seed.email,
    passwordHash: await bcrypt.hash(seed.password, env.passwordRounds),
    role: seed.role,
    status: "active",
    mustChangePassword: false,
    createdAt: now()
  };
}

async function demoUsers() {
  return Promise.all(demoUserSeeds.map(buildDemoUser));
}

const defaultData = async () => ({
  users: await demoUsers(),
  sessions: [],
  patients: [],
  visits: [],
  symptomRecords: [],
  vitals: [],
  prescriptions: [],
  doctorReviews: [],
  auditLogs: []
});

async function addMissingDemoUsers(data) {
  const existingEmails = new Set(
    data.users.map((user) => user.email?.toLowerCase()).filter(Boolean)
  );
  const missingSeeds = demoUserSeeds.filter(
    (user) => !existingEmails.has(user.email.toLowerCase())
  );

  if (missingSeeds.length) {
    data.users.push(...(await Promise.all(missingSeeds.map(buildDemoUser))));
    return true;
  }

  return false;
}

async function normalizeStore(data) {
  let changed = false;

  if (!Array.isArray(data.users)) {
    data.users = [];
    changed = true;
  }

  const cleanedUsers = data.users.filter(
    (user) => user.role !== "patient" && !["nurse-user", "doctor-user"].includes(user.id)
  );

  if (cleanedUsers.length !== data.users.length) {
    data.users = cleanedUsers;
    changed = true;
  }

  const adminEmails = new Set(
    [systemAdmin.email, ...systemAdmin.legacyEmails].map((email) => email.toLowerCase())
  );
  const protectedAdmin = data.users.find(
    (user) => user.id === systemAdmin.id || adminEmails.has(user.email?.toLowerCase())
  );

  if (protectedAdmin) {
    if (protectedAdmin.id !== systemAdmin.id) {
      protectedAdmin.id = systemAdmin.id;
      changed = true;
    }

    if (protectedAdmin.name !== systemAdmin.name) {
      protectedAdmin.name = systemAdmin.name;
      changed = true;
    }

    if (protectedAdmin.email !== systemAdmin.email) {
      protectedAdmin.email = systemAdmin.email;
      changed = true;
    }

    if (protectedAdmin.role !== "admin") {
      protectedAdmin.role = "admin";
      changed = true;
    }

    if (protectedAdmin.status !== "active") {
      protectedAdmin.status = "active";
      changed = true;
    }

    if (protectedAdmin.mustChangePassword !== false) {
      protectedAdmin.mustChangePassword = false;
      changed = true;
    }
  }

  const uniqueUsers = [];
  const seenEmails = new Set();

  for (const user of data.users) {
    const email = user.email?.toLowerCase();
    const isProtectedAdmin = user.id === systemAdmin.id;

    if (email === systemAdmin.email && !isProtectedAdmin) {
      changed = true;
      continue;
    }

    if (email && seenEmails.has(email)) {
      changed = true;
      continue;
    }

    if (user.role === "admin" && !isProtectedAdmin) {
      user.role = "nurse";
      user.status = "inactive";
      changed = true;
    }

    seenEmails.add(email);
    uniqueUsers.push(user);
  }

  data.users = uniqueUsers;

  for (const key of ["sessions", "patients", "visits", "symptomRecords", "vitals", "prescriptions", "doctorReviews", "auditLogs"]) {
    if (!Array.isArray(data[key])) {
      data[key] = [];
      changed = true;
    }
  }

  changed = (await addMissingDemoUsers(data)) || changed;

  if (changed) {
    await writeData(data);
  }

  return data;
}

async function ensureStore() {
  await mkdir(path.dirname(databasePath), { recursive: true });
  try {
    const data = JSON.parse(await readFile(databasePath, "utf8"));
    return normalizeStore(data);
  } catch {
    const data = await defaultData();
    await writeData(data);
    return data;
  }
}

export async function readData() {
  await ensureStore();
  try {
    return JSON.parse(await readFile(databasePath, "utf8"));
  } catch {
    return ensureStore();
  }
}

export async function writeData(data) {
  const writeOperation = writeQueue
    .catch(() => {})
    .then(async () => {
      await mkdir(path.dirname(databasePath), { recursive: true });
      const tempPath = `${databasePath}.${process.pid}.${Date.now()}.${nanoid()}.tmp`;
      await writeFile(tempPath, JSON.stringify(data, null, 2));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await rename(tempPath, databasePath);
          return;
        } catch (error) {
          if (attempt === 4) {
            throw error;
          }

          await new Promise((resolve) => {
            setTimeout(resolve, 60);
          });
        }
      }
    });

  writeQueue = writeOperation;
  await writeOperation;
}

export async function addAuditLog(userId, action, details = {}) {
  const data = await readData();
  data.auditLogs.unshift({
    id: nanoid(),
    userId,
    action,
    details,
    createdAt: now()
  });
  await writeData(data);
}

export function createId() {
  return nanoid();
}

export function timestamp() {
  return now();
}
