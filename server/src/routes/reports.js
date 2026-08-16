import express from "express";
import {
  getAdminSystemReport,
  getNurseWorkflowReport,
  getSummaryReport
} from "../controllers/reportsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const reportsRouter = express.Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/admin-system", requireRole("admin"), asyncHandler(getAdminSystemReport));
reportsRouter.get(
  "/nurse-workflow",
  requireRole("admin", "nurse"),
  asyncHandler(getNurseWorkflowReport)
);
reportsRouter.get("/summary", asyncHandler(getSummaryReport));
