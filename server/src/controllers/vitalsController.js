import { z } from "zod";
import { createVitalRecord, findPatientById, listVitalsByPatient } from "../data/clinicalStore.js";
import { addAuditLog } from "../data/staffStore.js";

const vitalsSchema = z
  .object({
    patientId: z.string().min(1),
    temperature: z.coerce.number().min(25).max(45).optional(),
    systolic: z.coerce.number().int().min(50).max(260).optional(),
    diastolic: z.coerce.number().int().min(30).max(160).optional(),
    heartRate: z.coerce.number().int().min(20).max(240).optional(),
    respiratoryRate: z.coerce.number().int().min(5).max(80).optional(),
    oxygenSaturation: z.coerce.number().int().min(50).max(100).optional(),
    notes: z.string().max(500).optional()
  })
  .refine(
    (value) =>
      [
        value.temperature,
        value.systolic,
        value.diastolic,
        value.heartRate,
        value.respiratoryRate,
        value.oxygenSaturation,
        value.notes
      ].some((item) => item !== undefined && item !== ""),
    { message: "At least one vital sign or note is required." }
  );

export async function createPatientVitalRecord(req, res) {
  const parsed = vitalsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Valid patient vital signs are required." });
  }

  const patient = await findPatientById(parsed.data.patientId);

  if (!patient) {
    return res.status(404).json({ message: "Patient was not found." });
  }

  const vital = await createVitalRecord({
    patientId: parsed.data.patientId,
    vitals: parsed.data,
    recordedBy: req.user.id
  });
  await addAuditLog(req.user.id, "vitals.create", {
    patientId: parsed.data.patientId,
    vitalId: vital.id
  });

  return res.status(201).json({ vital });
}

export async function listPatientVitalRecords(req, res) {
  return res.json({ vitals: await listVitalsByPatient(req.params.patientId) });
}
