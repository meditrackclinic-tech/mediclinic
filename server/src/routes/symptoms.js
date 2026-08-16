import express from "express";
import {
  createPatientSymptomRecord,
  getPatientSymptomTimeline,
  listPatientSymptomRecords
} from "../controllers/symptomsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const symptomsRouter = express.Router();

symptomsRouter.use(requireAuth);

symptomsRouter.post("/", requireRole("nurse", "admin"), asyncHandler(createPatientSymptomRecord));
symptomsRouter.get("/patient/:patientId", asyncHandler(listPatientSymptomRecords));
symptomsRouter.get("/patient/:patientId/timeline", asyncHandler(getPatientSymptomTimeline));
