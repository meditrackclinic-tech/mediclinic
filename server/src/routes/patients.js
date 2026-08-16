import express from "express";
import {
  createPatientRecord,
  getPatientProfileRecord,
  getPatientRecord,
  listPatientRecords
} from "../controllers/patientsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const patientsRouter = express.Router();

patientsRouter.use(requireAuth);

patientsRouter.get("/", asyncHandler(listPatientRecords));
patientsRouter.post("/", requireRole("receptionist", "admin"), asyncHandler(createPatientRecord));
patientsRouter.get("/:id/profile", asyncHandler(getPatientProfileRecord));
patientsRouter.get("/:id", asyncHandler(getPatientRecord));
