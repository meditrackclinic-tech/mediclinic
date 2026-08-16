import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { auditLogsRouter } from "./routes/auditLogs.js";
import { patientsRouter } from "./routes/patients.js";
import { reportsRouter } from "./routes/reports.js";
import { symptomsRouter } from "./routes/symptoms.js";
import { usersRouter } from "./routes/users.js";
import { visitsRouter } from "./routes/visits.js";
import { vitalsRouter } from "./routes/vitals.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "patient-symptom-record-server"
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/audit-logs", auditLogsRouter);
  app.use("/api/patients", patientsRouter);
  app.use("/api/symptoms", symptomsRouter);
  app.use("/api/visits", visitsRouter);
  app.use("/api/vitals", vitalsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/users", usersRouter);

  app.use((req, res) => {
    console.warn("[api-404]", {
      method: req.method,
      path: req.originalUrl
    });
    res.status(404).json({ message: "Route not found." });
  });

  app.use((error, req, res, next) => {
    console.error("[api-error]", {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: "Unexpected server error." });
  });

  return app;
}
