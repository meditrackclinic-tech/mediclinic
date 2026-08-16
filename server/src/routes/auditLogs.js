import express from "express";
import { listSystemAuditLogs } from "../controllers/auditLogsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const auditLogsRouter = express.Router();

auditLogsRouter.use(requireAuth, requireRole("admin"));

auditLogsRouter.get("/", asyncHandler(listSystemAuditLogs));
