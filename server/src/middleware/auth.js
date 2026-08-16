import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { findActiveUserById } from "../data/staffStore.js";
import { findActiveAuthSession, touchAuthSession } from "../data/sessionStore.js";

function logAuthIssue(req, reason, detail) {
  console.warn("[auth]", {
    reason,
    detail,
    method: req.method,
    path: req.originalUrl
  });
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    logAuthIssue(req, "missing_token");
    return res.status(401).json({ message: "Authentication token is required." });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const session = await findActiveAuthSession(payload.sid, payload.sub);

    if (!session) {
      logAuthIssue(req, "expired_or_revoked_session", `userId=${payload.sub}`);
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    const user = await findActiveUserById(payload.sub);

    if (!user) {
      logAuthIssue(req, "inactive_or_missing_user", `userId=${payload.sub}`);
      return res.status(401).json({ message: "User account is not active." });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    };
    req.authSession = session;
    await touchAuthSession(session.id);
    return next();
  } catch (error) {
    logAuthIssue(req, "invalid_token", `${error.name}: ${error.message}`);
    return res.status(401).json({ message: "Invalid or expired authentication token." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      console.warn("[auth]", {
        reason: "forbidden_role",
        requiredRoles: roles,
        actualRole: req.user?.role,
        userId: req.user?.id,
        method: req.method,
        path: req.originalUrl
      });
      return res.status(403).json({ message: "You are not allowed to perform this action." });
    }

    return next();
  };
}
