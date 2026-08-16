import express from "express";
import {
  completeNurseAssessment,
  createVisitRecord,
  getVisitRecord,
  listVisitRecords,
  reviewDoctorVisit,
  saveVisitDraft,
  submitVisitRecord
} from "../controllers/visitsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const visitsRouter = express.Router();

visitsRouter.use(requireAuth);

visitsRouter.get("/", asyncHandler(listVisitRecords));
visitsRouter.post("/", requireRole("nurse", "admin"), asyncHandler(createVisitRecord));
visitsRouter.get("/:id", asyncHandler(getVisitRecord));
visitsRouter.post("/:id/draft", requireRole("nurse", "admin"), asyncHandler(saveVisitDraft));
visitsRouter.post("/:id/complete", requireRole("nurse", "admin"), asyncHandler(completeNurseAssessment));
visitsRouter.post("/:id/submit", requireRole("nurse", "admin"), asyncHandler(submitVisitRecord));
visitsRouter.post("/:id/doctor-review", requireRole("doctor", "admin"), asyncHandler(reviewDoctorVisit));
