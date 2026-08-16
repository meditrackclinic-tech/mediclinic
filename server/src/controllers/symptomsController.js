import { z } from "zod";
import {
  createSymptomRecord,
  findPatientById,
  listSymptomRecordsByPatient,
  listSymptomTimelineByPatient
} from "../data/clinicalStore.js";
import { addAuditLog } from "../data/staffStore.js";
import { extractSymptoms } from "../nlp/symptomExtractor.js";

const symptomSchema = z.object({
  patientId: z.string().min(1),
  description: z.string().min(3)
});

export async function createPatientSymptomRecord(req, res) {
  const parsed = symptomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Patient ID and symptom description are required." });
  }

  const patient = await findPatientById(parsed.data.patientId);

  if (!patient) {
    return res.status(404).json({ message: "Patient was not found." });
  }

  const structured = extractSymptoms(parsed.data.description);
  const symptomRecord = await createSymptomRecord({
    patientId: parsed.data.patientId,
    rawDescription: parsed.data.description,
    structured,
    recordedBy: req.user.id
  });
  await addAuditLog(req.user.id, "symptom.create", {
    patientId: parsed.data.patientId,
    symptomRecordId: symptomRecord.id
  });

  return res.status(201).json({ symptomRecord });
}

export async function listPatientSymptomRecords(req, res) {
  return res.json({ records: await listSymptomRecordsByPatient(req.params.patientId) });
}

export async function getPatientSymptomTimeline(req, res) {
  return res.json({ timeline: await listSymptomTimelineByPatient(req.params.patientId) });
}
