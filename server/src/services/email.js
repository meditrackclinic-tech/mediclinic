import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function maskEmail(value) {
  if (!value || !value.includes("@")) {
    return value ? "configured" : "";
  }

  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

export function getEmailDeliveryStatus() {
  if (process.env.NODE_ENV === "test") {
    return {
      configured: false,
      mode: "console",
      host: "",
      port: env.smtp.port,
      user: "",
      from: env.smtp.from,
      message: "SMTP is disabled during automated tests."
    };
  }

  const configured = hasSmtpConfig();

  return {
    configured,
    mode: configured ? "smtp" : "console",
    host: env.smtp.host || "",
    port: env.smtp.port,
    user: maskEmail(env.smtp.user),
    from: env.smtp.from,
    message: configured
      ? "SMTP is configured. Staff credentials will be sent by email."
      : "SMTP is not configured. Temporary passwords are written to the backend terminal."
  };
}

async function sendStaffAccessEmail({ to, subject, text }) {
  if (process.env.NODE_ENV === "test") {
    return { sent: false, mode: "console" };
  }

  if (!hasSmtpConfig()) {
    console.info("[dev-email] Staff access email not sent because SMTP is not configured.");
    console.info(`[dev-email] To: ${to}`);
    console.info(`[dev-email] Subject: ${subject}`);
    console.info(`[dev-email]\n${text}`);
    return { sent: false, mode: "console" };
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text
  });

  return { sent: true, mode: "smtp" };
}

async function deliverStaffAccessEmail(payload) {
  try {
    return await sendStaffAccessEmail(payload);
  } catch (error) {
    console.error("[email-error]", {
      to: payload.to,
      subject: payload.subject,
      message: error.message
    });
    return { sent: false, mode: "failed", error: error.message };
  }
}

export async function sendStaffCredentialsEmail({ to, name, email, password, role }) {
  const subject = "Your MediTrack NLP staff account";
  const text = [
    `Hello ${name},`,
    "",
    "A staff account has been created for you on MediTrack NLP.",
    "",
    `Role: ${role}`,
    `Login email: ${email}`,
    `Temporary password: ${password}`,
    "",
    "Please sign in and change this password before using the system for real clinic data."
  ].join("\n");

  return deliverStaffAccessEmail({
    to,
    subject,
    text
  });
}

export async function sendStaffPasswordResetEmail({ to, name, email, password, role }) {
  const subject = "Your MediTrack NLP password reset";
  const text = [
    `Hello ${name},`,
    "",
    "Your MediTrack NLP account password has been reset by the system administrator.",
    "",
    `Role: ${role}`,
    `Login email: ${email}`,
    `Temporary password: ${password}`,
    "",
    "Please sign in with this temporary password and create a new private password immediately."
  ].join("\n");

  return deliverStaffAccessEmail({
    to,
    subject,
    text
  });
}

export async function sendSystemTestEmail({ to, name }) {
  const subject = "MediTrack NLP email delivery test";
  const text = [
    `Hello ${name},`,
    "",
    "This is a test email from MediTrack NLP.",
    "",
    "If you received this message, staff account and password reset emails are configured correctly."
  ].join("\n");

  return deliverStaffAccessEmail({
    to,
    subject,
    text
  });
}
