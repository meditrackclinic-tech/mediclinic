import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  return transporter;
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
      operational: false,
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
    operational: false,
    mode: configured ? "smtp" : "console",
    host: env.smtp.host || "",
    port: env.smtp.port,
    user: maskEmail(env.smtp.user),
    from: env.smtp.from,
    message: configured
      ? "SMTP settings were found. Checking the mail-server connection."
      : "SMTP is not configured. Temporary passwords are written to the backend terminal."
  };
}

export async function getVerifiedEmailDeliveryStatus() {
  const status = getEmailDeliveryStatus();

  if (process.env.NODE_ENV === "test" || !status.configured) {
    return status;
  }

  try {
    await getTransporter().verify();
    return {
      ...status,
      operational: true,
      message: "Email delivery is active and the SMTP account is authenticated."
    };
  } catch (error) {
    console.error("[email-verification-error]", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message
    });

    const authenticationFailed = error.code === "EAUTH" || error.responseCode === 535;
    return {
      ...status,
      operational: false,
      errorCode: authenticationFailed ? "SMTP_AUTH_FAILED" : "SMTP_CONNECTION_FAILED",
      message: authenticationFailed
        ? "Gmail rejected the SMTP login. Replace SMTP_PASS with a valid Google App Password and restart the server."
        : "The SMTP server could not be reached. Check the host, port, network, and provider settings."
    };
  }
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

  await getTransporter().sendMail({
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
