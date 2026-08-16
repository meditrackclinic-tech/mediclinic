import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionMinutes: Number(process.env.SESSION_MINUTES || 120),
  passwordRounds: Number(process.env.BCRYPT_ROUNDS || (process.env.NODE_ENV === "test" ? 4 : 10)),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "MediTrack NLP <no-reply@meditrack.local>"
  }
};
