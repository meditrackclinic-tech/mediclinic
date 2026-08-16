import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { systemAdmin } from "../config/systemAdmin.js";
import { hasDatabase, initializePostgres, query } from "./postgres.js";
import { readData, writeData } from "./store.js";

const now = () => new Date().toISOString();
let staffStoreReady = null;

function mapDbUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role_id || row.role,
    status: row.status,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sanitizeUser({ passwordHash, ...user }) {
  return user;
}

async function defaultStaffUsers() {
  return [
    {
      id: systemAdmin.id,
      name: systemAdmin.name,
      email: systemAdmin.email,
      passwordHash: await bcrypt.hash(systemAdmin.defaultPassword, env.passwordRounds),
      role: "admin",
      status: "active",
      mustChangePassword: false,
      createdAt: now(),
      updatedAt: now()
    }
  ];
}

export async function ensureStaffStore() {
  if (!hasDatabase) {
    return;
  }

  if (!staffStoreReady) {
    staffStoreReady = (async () => {
      await initializePostgres();

      await query(`
        DELETE FROM users
        WHERE id IN ('nurse-user', 'doctor-user')
          AND email IN ('nurse@example.com', 'doctor@example.com');
      `);

      await query(
        `
          UPDATE users
          SET email = CONCAT('archived-', id, '-', email),
              role = 'nurse',
              role_id = 'nurse',
              status = 'inactive',
              updated_at = NOW()
          WHERE LOWER(email) = LOWER($1)
            AND id <> $2;
        `,
        [systemAdmin.email, systemAdmin.id]
      );

      await query(
        `
          UPDATE users
          SET id = $1,
              name = $2,
              email = LOWER($3),
              role = 'admin',
              role_id = 'admin',
              status = 'active',
              must_change_password = false,
              updated_at = NOW()
          WHERE id = $1
             OR LOWER(email) = ANY($4::text[]);
        `,
        [
          systemAdmin.id,
          systemAdmin.name,
          systemAdmin.email,
          [systemAdmin.email, ...systemAdmin.legacyEmails].map((email) => email.toLowerCase())
        ]
      );

      await query(
        `
          UPDATE users
          SET role = 'nurse',
              role_id = 'nurse',
              status = 'inactive',
              updated_at = NOW()
          WHERE role_id = 'admin'
            AND NOT (id = $1 AND LOWER(email) = LOWER($2));
        `,
        [systemAdmin.id, systemAdmin.email]
      );

      for (const user of await defaultStaffUsers()) {
        await query(
          `
            INSERT INTO users (
              id, name, email, password_hash, role, role_id, status, must_change_password, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
            ON CONFLICT (email) DO UPDATE
            SET name = EXCLUDED.name,
                role = 'admin',
                role_id = 'admin',
                status = 'active',
                must_change_password = false,
                updated_at = NOW();
          `,
          [
            user.id,
            user.name,
            user.email,
            user.passwordHash,
            user.role,
            user.status,
            user.mustChangePassword,
            user.createdAt,
            user.updatedAt
          ]
        );
      }
    })();
  }

  await staffStoreReady;
}

export async function findUserByEmail(email) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;", [
      email
    ]);
    return mapDbUser(result.rows[0]);
  }

  const data = await readData();
  return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function findActiveUserById(id) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query("SELECT * FROM users WHERE id = $1 AND status = 'active' LIMIT 1;", [
      id
    ]);
    return mapDbUser(result.rows[0]);
  }

  const data = await readData();
  return data.users.find((user) => user.id === id && user.status === "active") || null;
}

export async function findUserById(id) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [id]);
    return mapDbUser(result.rows[0]);
  }

  const data = await readData();
  return data.users.find((user) => user.id === id) || null;
}

export async function listUsers() {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query(`
      SELECT *
      FROM users
      ORDER BY CASE WHEN role_id = 'admin' THEN 0 ELSE 1 END, created_at DESC;
    `);
    return result.rows.map(mapDbUser).map(sanitizeUser);
  }

  const data = await readData();
  return data.users
    .map(sanitizeUser)
    .sort((a, b) => (a.role === "admin" ? -1 : b.role === "admin" ? 1 : 0));
}

export async function createStaffUser({ name, email, passwordHash, role, mustChangePassword = true }) {
  if (role === "admin") {
    throw new Error("Only the seeded system administrator account can use the admin role.");
  }

  if (hasDatabase) {
    await ensureStaffStore();
    const id = nanoid();
    const result = await query(
      `
        INSERT INTO users (id, name, email, password_hash, role, role_id, status, must_change_password)
        VALUES ($1, $2, LOWER($3), $4, $5, $5, 'active', $6)
        RETURNING *;
      `,
      [id, name, email, passwordHash, role, mustChangePassword]
    );
    return sanitizeUser(mapDbUser(result.rows[0]));
  }

  const data = await readData();
  const user = {
    id: nanoid(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    status: "active",
    mustChangePassword,
    createdAt: now(),
    updatedAt: now()
  };
  data.users.push(user);
  await writeData(data);
  return sanitizeUser(user);
}

export async function updateStaffUser(id, updates) {
  if (updates.role === "admin") {
    throw new Error("The admin role is protected and cannot be assigned.");
  }

  if (hasDatabase) {
    await ensureStaffStore();
    const fields = [];
    const values = [];

    if (updates.role) {
      values.push(updates.role);
      fields.push(`role = $${values.length}`);
      fields.push(`role_id = $${values.length}`);
    }

    if (updates.status) {
      values.push(updates.status);
      fields.push(`status = $${values.length}`);
    }

    values.push(id);
    const result = await query(
      `
        UPDATE users
        SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *;
      `,
      values
    );
    return result.rows[0] ? sanitizeUser(mapDbUser(result.rows[0])) : null;
  }

  const data = await readData();
  const user = data.users.find((item) => item.id === id);

  if (!user) {
    return null;
  }

  if (updates.role) {
    user.role = updates.role;
  }

  if (updates.status) {
    user.status = updates.status;
  }

  user.updatedAt = now();
  await writeData(data);
  return sanitizeUser(user);
}

export async function deleteStaffUser(id) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query(
      `
        DELETE FROM users
        WHERE id = $1
        RETURNING *;
      `,
      [id]
    );
    return result.rows[0] ? sanitizeUser(mapDbUser(result.rows[0])) : null;
  }

  const data = await readData();
  const userIndex = data.users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    return null;
  }

  const [deletedUser] = data.users.splice(userIndex, 1);
  data.sessions = (data.sessions || []).filter((session) => session.userId !== id);
  data.auditLogs = (data.auditLogs || []).map((entry) =>
    entry.userId === id ? { ...entry, userId: null } : entry
  );
  await writeData(data);
  return sanitizeUser(deletedUser);
}

export async function listRoles({ assignableOnly = false } = {}) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query(
      `
        SELECT id, name, description, is_system AS "isSystem"
        FROM roles
        WHERE ($1::boolean = false OR id <> 'admin')
        ORDER BY CASE id WHEN 'admin' THEN 0 WHEN 'receptionist' THEN 1 WHEN 'nurse' THEN 2 WHEN 'doctor' THEN 3 ELSE 4 END;
      `,
      [assignableOnly]
    );
    return result.rows;
  }

  const roles = [
    {
      id: "admin",
      name: "System Administrator",
      description: "The single protected account that creates and manages clinic staff.",
      isSystem: true
    },
    {
      id: "receptionist",
      name: "Receptionist",
      description: "Front desk role for finding or creating patient records before clinical assessment.",
      isSystem: true
    },
    {
      id: "nurse",
      name: "Nurse",
      description: "Clinic staff role for quick assessment, vitals, symptom capture, and doctor handoff.",
      isSystem: true
    },
    {
      id: "doctor",
      name: "Doctor",
      description: "Clinical review role for symptom history and temporal timelines.",
      isSystem: true
    }
  ];

  return assignableOnly ? roles.filter((role) => role.id !== "admin") : roles;
}

export async function updateUserPassword(id, passwordHash, mustChangePassword = false) {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query(
      `
        UPDATE users
        SET password_hash = $1, must_change_password = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *;
      `,
      [passwordHash, mustChangePassword, id]
    );
    return result.rows[0] ? sanitizeUser(mapDbUser(result.rows[0])) : null;
  }

  const data = await readData();
  const user = data.users.find((item) => item.id === id);

  if (!user) {
    return null;
  }

  user.passwordHash = passwordHash;
  user.mustChangePassword = mustChangePassword;
  user.updatedAt = now();
  await writeData(data);
  return sanitizeUser(user);
}

export async function addAuditLog(userId, action, details = {}) {
  if (hasDatabase) {
    await ensureStaffStore();
    await query(
      `
        INSERT INTO audit_logs (id, user_id, action, details)
        VALUES ($1, $2, $3, $4::jsonb);
      `,
      [nanoid(), userId, action, JSON.stringify(details)]
    );
    return;
  }

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

export async function listAuditLogs() {
  if (hasDatabase) {
    await ensureStaffStore();
    const result = await query(`
      SELECT
        audit_logs.id,
        audit_logs.user_id AS "userId",
        audit_logs.action,
        audit_logs.details,
        audit_logs.created_at AS "createdAt",
        users.name AS "userName",
        users.role AS "userRole"
      FROM audit_logs
      LEFT JOIN users ON users.id = audit_logs.user_id
      ORDER BY audit_logs.created_at DESC
      LIMIT 50;
    `);

    return result.rows.map((log) => ({
      ...log,
      userName: log.userName || "Unknown user",
      userRole: log.userRole || "unknown"
    }));
  }

  const data = await readData();
  return data.auditLogs.slice(0, 50).map((log) => {
    const user = data.users.find((item) => item.id === log.userId);
    return {
      ...log,
      userName: user?.name || "Unknown user",
      userRole: user?.role || "unknown"
    };
  });
}
