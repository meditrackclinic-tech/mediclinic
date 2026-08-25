import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

let transporter;
let activePort = env.smtp.port;
let lastDeliveryFailure;

function createTransporter(port) {
  return nodemailer.createTransport({
      host: env.smtp.host,
      port,
      secure: port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      },
      connectionTimeout: 15000,
      greetingTimeout: 20000,
      socketTimeout: 20000
    });
}

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter(activePort);
  }

  return transporter;
}

function replaceTransporter(port) {
  transporter?.close();
  activePort = port;
  transporter = createTransporter(port);
  return transporter;
}

function canUseGmailSecurePortFallback(error) {
  const connectionError = ["ECONNECTION", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET"].includes(
    error.code
  );
  return env.smtp.host === "smtp.gmail.com" && activePort === 587 && connectionError;
}

async function sendMailWithFallback(message) {
  try {
    return await getTransporter().sendMail(message);
  } catch (error) {
    if (!canUseGmailSecurePortFallback(error)) {
      throw error;
    }

    console.warn("[email-delivery] Gmail port 587 was unavailable; retrying on port 465.");
    return replaceTransporter(465).sendMail(message);
  }
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
  const operational = configured && !lastDeliveryFailure;

  return {
    configured,
    operational,
    mode: configured ? "smtp" : "console",
    host: env.smtp.host || "",
    port: activePort,
    user: maskEmail(env.smtp.user),
    from: env.smtp.from,
    errorCode: lastDeliveryFailure?.errorCode,
    message: lastDeliveryFailure
      ? lastDeliveryFailure.message
      : configured
        ? "Email delivery is configured. Staff credentials will be sent to their email address."
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

  await sendMailWithFallback({
    from: env.smtp.from,
    to,
    subject,
    text
  });

  lastDeliveryFailure = undefined;
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
    const authenticationFailed = error.code === "EAUTH" || error.responseCode === 535;
    lastDeliveryFailure = {
      errorCode: authenticationFailed ? "SMTP_AUTH_FAILED" : "SMTP_DELIVERY_FAILED",
      message: authenticationFailed
        ? "Gmail rejected the SMTP login. Update the Google App Password and restart the server."
        : "The last email could not be delivered. Check the network and try the email test again."
    };
    replaceTransporter(env.smtp.port);
    return { sent: false, mode: "failed", error: lastDeliveryFailure.message };
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
