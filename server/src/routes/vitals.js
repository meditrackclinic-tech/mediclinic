import express from "express";
import {
  createPatientVitalRecord,
  listPatientVitalRecords
} from "../controllers/vitalsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const vitalsRouter = express.Router();

vitalsRouter.use(requireAuth);

vitalsRouter.post("/", requireRole("nurse", "admin"), asyncHandler(createPatientVitalRecord));
vitalsRouter.get("/patient/:patientId", asyncHandler(listPatientVitalRecords));
