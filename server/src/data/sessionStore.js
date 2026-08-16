import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { hasDatabase, query } from "./postgres.js";
import { readData, writeData } from "./store.js";

const now = () => new Date();

function sessionExpiry() {
  return new Date(Date.now() + env.sessionMinutes * 60 * 1000);
}

function mapDbSession(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id || row.userId,
    userAgent: row.user_agent || row.userAgent || "",
    ipAddress: row.ip_address || row.ipAddress || "",
    expiresAt: row.expires_at || row.expiresAt,
    revokedAt: row.revoked_at || row.revokedAt,
    lastSeenAt: row.last_seen_at || row.lastSeenAt,
    createdAt: row.created_at || row.createdAt
  };
}

function summarizeSessions(sessions, users = []) {
  const nowMs = Date.now();
  const userById = new Map(users.map((user) => [user.id, user]));
  const total = sessions.length;
  const active = sessions.filter(
    (session) => !session.revokedAt && new Date(session.expiresAt).getTime() > nowMs
  ).length;
  const revoked = sessions.filter((session) => session.revokedAt).length;
  const expired = sessions.filter(
    (session) => !session.revokedAt && new Date(session.expiresAt).getTime() <= nowMs
  ).length;
  const recent = sessions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((session) => {
      const user = userById.get(session.userId);

      return {
        id: session.id,
        userId: session.userId,
        userName: user?.name || "Unknown user",
        userRole: user?.role || "unknown",
        status: session.revokedAt
          ? "revoked"
          : new Date(session.expiresAt).getTime() > nowMs
            ? "active"
            : "expired",
        lastSeenAt: session.lastSeenAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      };
    });

  return {
    total,
    active,
    revoked,
    expired,
    recent
  };
}

export async function createAuthSession({ userId, userAgent = "", ipAddress = "" }) {
  const session = {
    id: nanoid(),
    userId,
    userAgent,
    ipAddress,
    expiresAt: sessionExpiry().toISOString(),
    revokedAt: null,
    lastSeenAt: now().toISOString(),
    createdAt: now().toISOString()
  };

  if (hasDatabase) {
    await query(
      `
        INSERT INTO user_sessions (
          id, user_id, user_agent, ip_address, expires_at, last_seen_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *;
      `,
      [session.id, userId, userAgent, ipAddress, session.expiresAt]
    );
    return session;
  }

  const data = await readData();
  data.sessions.unshift(session);
  await writeData(data);
  return session;
}

export async function findActiveAuthSession(sessionId, userId) {
  if (!sessionId || !userId) {
    return null;
  }

  if (hasDatabase) {
    const result = await query(
      `
        SELECT *
        FROM user_sessions
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1;
      `,
      [sessionId, userId]
    );
    return mapDbSession(result.rows[0]);
  }

  const data = await readData();
  const session = data.sessions.find(
    (item) =>
      item.id === sessionId &&
      item.userId === userId &&
      !item.revokedAt &&
      new Date(item.expiresAt).getTime() > Date.now()
  );

  return session || null;
}

export async function touchAuthSession(sessionId) {
  if (!sessionId) {
    return;
  }

  if (hasDatabase) {
    await query(
      `
        UPDATE user_sessions
        SET last_seen_at = NOW()
        WHERE id = $1
          AND revoked_at IS NULL;
      `,
      [sessionId]
    );
    return;
  }

  const data = await readData();
  const session = data.sessions.find((item) => item.id === sessionId && !item.revokedAt);

  if (session) {
    session.lastSeenAt = now().toISOString();
    await writeData(data);
  }
}

export async function revokeAuthSession(sessionId) {
  if (!sessionId) {
    return false;
  }

  if (hasDatabase) {
    const result = await query(
      `
        UPDATE user_sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE id = $1
        RETURNING id;
      `,
      [sessionId]
    );
    return Boolean(result.rows[0]);
  }

  const data = await readData();
  const session = data.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return false;
  }

  session.revokedAt = session.revokedAt || now().toISOString();
  await writeData(data);
  return true;
}

export async function getAuthSessionSummary() {
  if (hasDatabase) {
    const [totals, recent] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW())::int AS active,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked,
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at <= NOW())::int AS expired
        FROM user_sessions;
      `),
      query(`
        SELECT
          user_sessions.id,
          user_sessions.user_id,
          user_sessions.expires_at,
          user_sessions.revoked_at,
          user_sessions.last_seen_at,
          user_sessions.created_at,
          users.name AS user_name,
          users.role_id AS user_role
        FROM user_sessions
        LEFT JOIN users ON users.id = user_sessions.user_id
        ORDER BY user_sessions.created_at DESC
        LIMIT 5;
      `)
    ]);

    return {
      total: totals.rows[0].total,
      active: totals.rows[0].active,
      revoked: totals.rows[0].revoked,
      expired: totals.rows[0].expired,
      recent: recent.rows.map((session) => ({
        id: session.id,
        userId: session.user_id,
        userName: session.user_name || "Unknown user",
        userRole: session.user_role || "unknown",
        status: session.revoked_at
          ? "revoked"
          : new Date(session.expires_at).getTime() > Date.now()
            ? "active"
            : "expired",
        lastSeenAt: session.last_seen_at,
        createdAt: session.created_at,
        expiresAt: session.expires_at
      }))
    };
  }

  const data = await readData();
  return summarizeSessions(data.sessions || [], data.users || []);
}
