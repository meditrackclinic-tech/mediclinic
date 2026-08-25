import nodemailer from "nodemailer";

const port = Number(process.env.SMTP_PORT || 587);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

try {
  await transport.verify();
  console.log("SMTP authentication verified.");
} catch (error) {
  if (error.code === "EAUTH" || error.responseCode === 535) {
    console.error(
      "Gmail rejected the login. Confirm the full Gmail address and use a new 16-character Google App Password."
    );
  } else {
    console.error(`SMTP verification failed: ${error.message}`);
  }
  process.exitCode = 1;
} finally {
  transport.close();
}
