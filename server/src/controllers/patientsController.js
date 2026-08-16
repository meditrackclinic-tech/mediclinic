import { z } from "zod";
import {
  countPatients,
  createPatient,
  findPatientById,
  getPatientProfile,
  listPatients
} from "../data/clinicalStore.js";
import { addAuditLog } from "../data/staffStore.js";

const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
  age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["Female", "Male", "Other", "Prefer not to say"]).optional()
  ),
  contact: z.string().optional()
});

export async function listPatientRecords(req, res) {
  const query = String(req.query.q || "");
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const [patients, total] = await Promise.all([
    listPatients(query, { limit, offset }),
    countPatients(query)
  ]);

  return res.json({
    patients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  });
}

export async function createPatientRecord(req, res) {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Valid patient details are required." });
  }

  const patient = await createPatient(parsed.data, req.user.id);
  await addAuditLog(req.user.id, "patient.create", { patientId: patient.id });

  return res.status(201).json({ patient });
}

export async function getPatientRecord(req, res) {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({ message: "Patient was not found." });
  }

  return res.json({ patient });
}

export async function getPatientProfileRecord(req, res) {
  const profile = await getPatientProfile(req.params.id);

  if (!profile) {
    return res.status(404).json({ message: "Patient was not found." });
  }

  return res.json(profile);
}
