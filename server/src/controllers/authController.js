import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { createAuthSession, revokeAuthSession } from "../data/sessionStore.js";
import {
  addAuditLog,
  findUserByEmail,
  findUserById,
  updateUserPassword
} from "../data/staffStore.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const firstLoginPasswordSchema = z.object({
  newPassword: z.string().min(8)
});

function toAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword
  };
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Valid email and password are required." });
  }

  const user = await findUserByEmail(parsed.data.email);

  if (
    !user ||
    user.status !== "active" ||
    !(await bcrypt.compare(parsed.data.password, user.passwordHash))
  ) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const session = await createAuthSession({
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: req.ip || ""
  });
  const token = jwt.sign({ sub: user.id, role: user.role, sid: session.id }, env.jwtSecret, {
    expiresIn: `${env.sessionMinutes}m`
  });

  await addAuditLog(user.id, "auth.login");

  return res.json({
    token,
    session: {
      id: session.id,
      expiresAt: session.expiresAt
    },
    user: toAuthUser(user)
  });
}

export function getCurrentUser(req, res) {
  return res.json({ user: req.user });
}

export async function logout(req, res) {
  await revokeAuthSession(req.authSession?.id);
  await addAuditLog(req.user.id, "auth.logout", {
    sessionId: req.authSession?.id
  });

  return res.json({ ok: true });
}

export async function changePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Current password and a new 8+ character password are required."
    });
  }

  const user = await findUserById(req.user.id);

  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, env.passwordRounds);
  const updatedUser = await updateUserPassword(user.id, passwordHash, false);
  await addAuditLog(user.id, "auth.password_change");

  return res.json({ user: toAuthUser(updatedUser) });
}

export async function changeFirstLoginPassword(req, res) {
  const parsed = firstLoginPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "A new 8+ character password is required."
    });
  }

  const user = await findUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User account was not found." });
  }

  if (!user.mustChangePassword) {
    return res
      .status(400)
      .json({ message: "This account does not require a first-login password change." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, env.passwordRounds);
  const updatedUser = await updateUserPassword(user.id, passwordHash, false);
  await addAuditLog(user.id, "auth.first_login_password_change");

  return res.json({ user: toAuthUser(updatedUser) });
}
