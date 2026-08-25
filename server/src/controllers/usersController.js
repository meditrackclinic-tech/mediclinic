import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  addAuditLog,
  createStaffUser,
  deleteStaffUser,
  findUserByEmail,
  findUserById,
  listRoles,
  listUsers,
  updateStaffUser,
  updateUserPassword
} from "../data/staffStore.js";
import {
  getVerifiedEmailDeliveryStatus,
  sendStaffCredentialsEmail,
  sendStaffPasswordResetEmail,
  sendSystemTestEmail
} from "../services/email.js";

const staffRoles = ["receptionist", "nurse", "doctor"];
const statuses = ["active", "inactive"];

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(staffRoles)
});

const updateUserSchema = z
  .object({
    role: z.enum(staffRoles).optional(),
    status: z.enum(statuses).optional()
  })
  .refine((value) => value.role || value.status, {
    message: "Role or status is required."
  });

const testEmailSchema = z.object({
  to: z.string().email().optional()
});

function generateTemporaryPassword() {
  return `Med-${nanoid(8)}!`;
}

export async function listStaffUsers(req, res) {
  return res.json({ users: await listUsers() });
}

export async function listStaffRoles(req, res) {
  return res.json({
    roles: await listRoles(),
    assignableRoles: await listRoles({ assignableOnly: true })
  });
}

export async function getStaffEmailStatus(req, res) {
  return res.json({ email: await getVerifiedEmailDeliveryStatus() });
}

async function requireOperationalEmail(res) {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  const email = await getVerifiedEmailDeliveryStatus();
  if (email.operational) {
    return true;
  }

  res.status(503).json({
    message: `Staff account email is unavailable. ${email.message}`,
    email
  });
  return false;
}

export async function sendStaffEmailTest(req, res) {
  const parsed = testEmailSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid test email address is required." });
  }

  const to = parsed.data.to || req.user.email;
  if (!(await requireOperationalEmail(res))) {
    return;
  }

  const emailDelivery = await sendSystemTestEmail({
    to,
    name: req.user.name
  });

  await addAuditLog(req.user.id, "email.test", {
    to,
    mode: emailDelivery.mode
  });

  if (process.env.NODE_ENV !== "test" && !emailDelivery.sent) {
    return res.status(502).json({
      message: "The SMTP connection was verified, but the test email could not be sent.",
      emailDelivery,
      email: await getVerifiedEmailDeliveryStatus()
    });
  }

  return res.json({ emailDelivery, email: await getVerifiedEmailDeliveryStatus() });
}

export async function createUser(req, res) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Valid user details are required." });
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    return res.status(409).json({ message: "A user with this email already exists." });
  }

  if (!(await requireOperationalEmail(res))) {
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await createStaffUser({
    name: parsed.data.name,
    email,
    passwordHash: await bcrypt.hash(temporaryPassword, env.passwordRounds),
    role: parsed.data.role,
    mustChangePassword: true
  });

  await addAuditLog(req.user.id, "user.create", { targetUserId: user.id, role: user.role });
  const emailDelivery = await sendStaffCredentialsEmail({
    to: user.email,
    name: user.name,
    email: user.email,
    password: temporaryPassword,
    role: user.role
  });

  if (process.env.NODE_ENV !== "test" && !emailDelivery.sent) {
    await deleteStaffUser(user.id);
    await addAuditLog(req.user.id, "user.create_email_failed", {
      targetEmail: user.email,
      role: user.role,
      mode: emailDelivery.mode
    });
    return res.status(502).json({
      message: "The login email could not be delivered, so the staff account was not created. Please test email delivery and try again.",
      emailDelivery
    });
  }

  return res.status(201).json({
    user,
    emailDelivery,
    ...(process.env.NODE_ENV === "test" ? { temporaryPassword } : {})
  });
}

export async function updateUser(req, res) {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Valid role or status update is required." });
  }

  const user = await findUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (req.user.id === user.id && parsed.data.status === "inactive") {
    return res.status(400).json({ message: "You cannot deactivate your own admin account." });
  }

  if (user.role === "admin" && parsed.data.role) {
    return res.status(400).json({ message: "The single system admin role cannot be changed." });
  }

  const updatedUser = await updateStaffUser(req.params.id, parsed.data);
  await addAuditLog(req.user.id, "user.update", {
    targetUserId: user.id,
    role: updatedUser.role,
    status: updatedUser.status
  });

  return res.json({ user: updatedUser });
}

export async function resetUserPassword(req, res) {
  const user = await findUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.role === "admin") {
    return res.status(400).json({ message: "The protected admin password cannot be reset here." });
  }

  if (!(await requireOperationalEmail(res))) {
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const emailDelivery = await sendStaffPasswordResetEmail({
    to: user.email,
    name: user.name,
    email: user.email,
    password: temporaryPassword,
    role: user.role
  });

  if (process.env.NODE_ENV !== "test" && !emailDelivery.sent) {
    return res.status(502).json({
      message: "The password-reset email could not be delivered. The existing password remains unchanged.",
      emailDelivery
    });
  }

  const updatedUser = await updateUserPassword(
    user.id,
    await bcrypt.hash(temporaryPassword, env.passwordRounds),
    true
  );

  await addAuditLog(req.user.id, "user.password_reset", {
    targetUserId: user.id,
    role: user.role
  });

  return res.json({
    user: updatedUser,
    emailDelivery,
    ...(process.env.NODE_ENV === "test" ? { temporaryPassword } : {})
  });
}

export async function deleteUser(req, res) {
  const user = await findUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.role === "admin" || user.id === req.user.id) {
    return res.status(400).json({
      message: "The protected system administrator account cannot be deleted."
    });
  }

  await addAuditLog(req.user.id, "user.delete", {
    targetUserId: user.id,
    targetEmail: user.email,
    role: user.role
  });

  const deletedUser = await deleteStaffUser(user.id);

  return res.json({
    message: "Staff account deleted.",
    user: deletedUser
  });
}
