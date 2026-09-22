import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL || "auto",
  databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
  databaseSslCa: process.env.DATABASE_SSL_CA || "",
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || 10),
  databaseIdleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
  databaseConnectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 15000),
  sessionMinutes: Number(process.env.SESSION_MINUTES || 120),
  passwordRounds: Number(process.env.BCRYPT_ROUNDS || (process.env.NODE_ENV === "test" ? 4 : 10)),
  nlp: {
    provider: process.env.NODE_ENV === "test" ? "rule" : process.env.NLP_PROVIDER || "rule",
    huggingFaceUrl: process.env.HF_NLP_URL || "http://127.0.0.1:8001",
    timeoutMs: Number(process.env.HF_NLP_TIMEOUT_MS || 12000),
    minimumScore: Number(process.env.HF_NLP_MIN_SCORE || 0.65)
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "MediTrack NLP <no-reply@meditrack.local>"
  }
};
