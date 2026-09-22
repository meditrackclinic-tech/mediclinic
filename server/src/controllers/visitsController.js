import { z } from "zod";
import {
  completeNurseAssessment as completeNurseAssessmentRecord,
  findPatientById,
  findVisitById,
  listSymptomTimelineByPatient,
  listVisits,
  recordDoctorReview,
  startVisit,
  submitVisitForDoctorReview,
  updateVisitIntake
} from "../data/clinicalStore.js";
import { addAuditLog } from "../data/staffStore.js";
import { analyzeSymptomTextWithProvider, EMPTY_NLP_RESULT } from "../nlp/clinicalNlpModel.js";
import { buildReviewPrompt } from "../nlp/symptomExtractor.js";
import { buildHistoryAlerts, classifyVisit } from "../nlp/visitClassifier.js";

const visitTypeValues = [
  "New complaint",
  "Follow-up visit",
  "Recurring complaint",
  "Worsening complaint",
  "Medication review",
  "General consultation"
];

const visitStartSchema = z.object({
  patientId: z.string().min(1)
});

const visitIntakeSchema = z.object({
  temperature: z.coerce.number().min(25).max(45).optional().or(z.literal("")),
  systolic: z.coerce.number().int().min(50).max(260).optional().or(z.literal("")),
  diastolic: z.coerce.number().int().min(30).max(160).optional().or(z.literal("")),
  heartRate: z.coerce.number().int().min(20).max(240).optional().or(z.literal("")),
  respiratoryRate: z.coerce.number().int().min(5).max(80).optional().or(z.literal("")),
  oxygenSaturation: z.coerce.number().int().min(50).max(100).optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
  symptomStatement: z.string().optional(),
  nlpConfirmed: z.boolean().optional(),
  assessmentOutcome: z.enum(["treated_by_nurse", "referred_to_doctor"]).optional().or(z.literal("")),
  treatmentNotes: z.string().max(1200).optional(),
  inputMethod: z.enum(["voice", "text"]).optional(),
  originalTranscript: z.string().max(4000).optional(),
  prescription: z
    .object({
      medicationName: z.string().max(120).optional(),
      dose: z.string().max(80).optional(),
      frequency: z.string().max(80).optional(),
      duration: z.string().max(80).optional(),
      quantity: z.string().max(80).optional(),
      instructions: z.string().max(500).optional(),
      reason: z.string().max(240).optional(),
      dispensed: z.boolean().optional(),
      medications: z
        .array(
          z.object({
            medicationName: z.string().max(120).optional(),
            quantity: z.string().max(80).optional(),
            instructions: z.string().max(500).optional()
          })
        )
        .max(12)
        .optional()
    })
    .optional(),
  nurseCorrections: z
    .object({
      symptoms: z.string().optional(),
      severity: z.string().optional(),
      duration: z.string().optional(),
      negatedSymptoms: z.string().optional(),
      mainComplaint: z.string().optional(),
      symptomsAbsent: z.string().optional(),
      frequency: z.string().optional(),
      progression: z.string().optional(),
      medicationAction: z.string().optional(),
      followUpInstruction: z.string().optional(),
      clinicalSummary: z.string().optional(),
      visitType: z.enum(visitTypeValues).optional().or(z.literal(""))
    })
    .optional()
});

const doctorReviewSchema = z.object({
  status: z.enum(["reviewed_by_doctor", "returned_for_correction"]),
  notes: z.string().trim().min(4).max(1200),
  consultation: z
    .object({
      examinationNotes: z.string().trim().max(1600).optional(),
      diagnosis: z.string().trim().max(240).optional(),
      outcome: z
        .enum([
          "complete_consultation",
          "follow_up_required",
          "referral_required",
          "further_assessment_required",
          "return_to_nurse"
        ])
        .optional(),
      plan: z.string().trim().max(1400).optional(),
      instructions: z.string().trim().max(1000).optional()
    })
    .optional(),
  continuityPlan: z
    .object({
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
      followUpReason: z.string().trim().max(500).optional(),
      referralRequired: z.boolean().optional(),
      referralDestination: z.string().trim().max(240).optional(),
      referralReason: z.string().trim().max(800).optional(),
      referralUrgency: z.string().trim().max(80).optional(),
      furtherAssessment: z.string().trim().max(500).optional(),
      returnToNurseReason: z.string().trim().max(500).optional()
    })
    .optional(),
  nlpFeedback: z
    .object({
      rating: z.enum(["accurate", "partly_accurate", "incorrect"]).optional(),
      correctionNote: z.string().trim().max(800).optional()
    })
    .optional()
});

const requiredVitalFields = [
  ["temperature", "Temperature has not been recorded."],
  ["systolic", "Systolic blood pressure has not been recorded."],
  ["diastolic", "Diastolic blood pressure has not been recorded."],
  ["heartRate", "Heart rate has not been recorded."],
  ["respiratoryRate", "Respiratory rate has not been recorded."],
  ["oxygenSaturation", "Oxygen saturation has not been recorded."]
];

function listFromCorrection(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyNurseCorrections(structured, corrections = {}) {
  const next = { ...structured };

  if (corrections.symptoms !== undefined) {
    const correctedSymptoms = listFromCorrection(corrections.symptoms);
    next.symptoms = correctedSymptoms.length ? correctedSymptoms : structured.symptoms;
    next.activeSymptoms = correctedSymptoms;
    next.symptomsPresent = correctedSymptoms;
  }

  if (corrections.severity !== undefined) {
    next.severity = corrections.severity || null;
  }

  if (corrections.duration !== undefined) {
    next.duration = corrections.duration || null;
  }

  if (corrections.negatedSymptoms !== undefined) {
    const correctedNegated = listFromCorrection(corrections.negatedSymptoms);
    next.negatedSymptoms = correctedNegated;
    next.symptomsAbsent = correctedNegated;
  }

  if (corrections.mainComplaint !== undefined) {
    next.mainComplaint = corrections.mainComplaint || null;
  }

  if (corrections.symptomsAbsent !== undefined) {
    const correctedAbsent = listFromCorrection(corrections.symptomsAbsent);
    next.symptomsAbsent = correctedAbsent;
    next.negatedSymptoms = correctedAbsent;
  }

  if (corrections.frequency !== undefined) {
    next.frequency = corrections.frequency || null;
  }

  if (corrections.progression !== undefined) {
    next.progression = corrections.progression || null;
  }

  if (corrections.medicationAction !== undefined) {
    next.medicationAction = corrections.medicationAction || null;
  }

  if (corrections.followUpInstruction !== undefined) {
    next.followUpInstruction = corrections.followUpInstruction || null;
  }

  if (corrections.clinicalSummary !== undefined) {
    next.clinicalSummary = corrections.clinicalSummary || null;
  }

  return next;
}

function buildQualityChecks(payload, structured) {
  const checks = [];

  for (const [field, message] of requiredVitalFields) {
    if (payload[field] === undefined || payload[field] === "") {
      checks.push({ field, level: "missing", message });
    }
  }

  if (!payload.symptomStatement?.trim()) {
    checks.push({
      field: "symptomStatement",
      level: "missing",
      message: "Patient's reported complaint has not been recorded."
    });
  }

  if (payload.symptomStatement && !structured.duration) {
    checks.push({
      field: "duration",
      level: "clarify",
      message: "Duration was not detected. Clarify if the patient can provide it."
    });
  }

  if (!payload.nlpConfirmed) {
    checks.push({
      field: "nlpConfirmed",
      level: "unconfirmed",
      message: "System-organised symptom summary has not been reviewed and confirmed by the nurse."
    });
  }

  return checks;
}

async function prepareVisitIntake(payload, patientId) {
  const baseStructured = payload.symptomStatement?.trim()
    ? await analyzeSymptomTextWithProvider(payload.symptomStatement)
    : { ...EMPTY_NLP_RESULT };
  const structured = applyNurseCorrections(baseStructured, payload.nurseCorrections);
  const previousTimelineEntries = patientId ? await listSymptomTimelineByPatient(patientId) : [];
  const visitType =
    payload.nurseCorrections?.visitType ||
    classifyVisit(structured, payload.symptomStatement, previousTimelineEntries);
  const historyAlerts = buildHistoryAlerts(structured, previousTimelineEntries);
  structured.visitType = visitType;
  structured.historyAlerts = historyAlerts;
  const reviewPrompt = buildReviewPrompt(structured, payload);
  const qualityChecks = buildQualityChecks(payload, structured);

  return { structured, reviewPrompt, qualityChecks, visitType, historyAlerts };
}

function medicationEntries(payload = {}) {
  const prescription = payload.prescription || {};
  const rows = Array.isArray(prescription.medications)
    ? prescription.medications
    : prescription.medicationName || prescription.quantity
      ? [prescription]
      : [];

  return rows
    .map((item) => ({
      medicationName: String(item?.medicationName || "").trim(),
      quantity: String(item?.quantity || "").trim(),
      instructions: String(item?.instructions || "").trim()
    }))
    .filter((item) => item.medicationName || item.quantity);
}

function hasPrescription(payload = {}) {
  return medicationEntries(payload).some((item) => item.medicationName && item.quantity);
}

function prescriptionMissingFields(payload = {}) {
  return medicationEntries(payload).flatMap((item, index) => {
    const missing = [];

    if (!item.medicationName) {
      missing.push(`medications.${index}.medicationName`);
    }

    if (!item.quantity) {
      missing.push(`medications.${index}.quantity`);
    }

    return missing;
  });
}

function intakeValidationResponse(error) {
  return {
    message:
      "Check the assessment form values. Vital signs must be numbers within the shown ranges, and the patient's reported complaint is required before sending to the doctor.",
    errors: error.flatten().fieldErrors
  };
}

function doctorCompletionErrors(payload) {
  if (payload.status === "returned_for_correction") {
    return [];
  }

  const consultation = payload.consultation || {};
  const continuity = payload.continuityPlan || {};
  const feedback = payload.nlpFeedback || {};
  const errors = [];

  if (!consultation.diagnosis?.trim()) {
    errors.push("The doctor must enter the diagnosis or clinical assessment personally.");
  }

  if (!consultation.outcome) {
    errors.push("Choose the doctor outcome before finalising the visit.");
  }

  if (consultation.outcome === "follow_up_required") {
    if (!continuity.followUpDate) {
      errors.push("Follow-up required: enter the follow-up date.");
    }

    if (!continuity.followUpReason?.trim()) {
      errors.push("Follow-up required: enter the follow-up reason.");
    }
  }

  if (consultation.outcome === "referral_required") {
    if (!continuity.referralDestination?.trim()) {
      errors.push("Referral required: enter the receiving facility.");
    }

    if (!continuity.referralReason?.trim()) {
      errors.push("Referral required: enter the doctor's reason.");
    }

    if (!continuity.referralUrgency?.trim()) {
      errors.push("Referral required: choose urgency.");
    }
  }

  if (consultation.outcome === "further_assessment_required" && !continuity.furtherAssessment?.trim()) {
    errors.push("Further assessment required: specify the assessment and reason.");
  }

  if (consultation.outcome === "return_to_nurse" && !continuity.returnToNurseReason?.trim()) {
    errors.push("Return to nurse: specify what must be corrected or recorded.");
  }

  if (!feedback.rating) {
    errors.push("Rate whether the NLP-organised complaint was accurate for research evaluation.");
  }

  if (["partly_accurate", "incorrect"].includes(feedback.rating) && !feedback.correctionNote?.trim()) {
    errors.push("Add a correction note when the NLP output was partly accurate or incorrect.");
  }

  return errors;
}

export async function listVisitRecords(req, res) {
  const status = String(req.query.status || "");
  const patientId = req.query.patientId ? String(req.query.patientId) : undefined;
  return res.json({ visits: await listVisits({ status, patientId }) });
}

export async function createVisitRecord(req, res) {
  const parsed = visitStartSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Patient ID is required to start a visit." });
  }

  const patient = await findPatientById(parsed.data.patientId);

  if (!patient) {
    return res.status(404).json({ message: "Patient was not found." });
  }

  const visit = await startVisit({
    patientId: parsed.data.patientId,
    nurseId: req.user.id
  });
  await addAuditLog(req.user.id, "visit.start", {
    patientId: parsed.data.patientId,
    visitId: visit.id
  });

  return res.status(201).json({ visit });
}

export async function getVisitRecord(req, res) {
  const visit = await findVisitById(req.params.id);

  if (!visit) {
    return res.status(404).json({ message: "Visit was not found." });
  }

  return res.json({ visit });
}

export async function saveVisitDraft(req, res) {
  const parsed = visitIntakeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(intakeValidationResponse(parsed.error));
  }

  const existingVisit = await findVisitById(req.params.id);
  const { structured, reviewPrompt, qualityChecks, visitType, historyAlerts } = await prepareVisitIntake(
    parsed.data,
    existingVisit?.patientId
  );
  const visit = await updateVisitIntake({
    visitId: req.params.id,
    payload: { ...parsed.data, visitType, historyAlerts },
    structured,
    reviewPrompt,
    status: "in_progress"
  });

  if (!visit) {
    return res.status(404).json({ message: "Visit was not found." });
  }

  await addAuditLog(req.user.id, "visit.draft", { visitId: req.params.id });
  return res.json({ visit, structured, reviewPrompt, qualityChecks });
}

export async function submitVisitRecord(req, res) {
  const parsed = visitIntakeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(intakeValidationResponse(parsed.error));
  }

  const existingVisit = await findVisitById(req.params.id);
  const payload = { ...parsed.data, assessmentOutcome: "referred_to_doctor" };
  const { structured, reviewPrompt, qualityChecks, visitType, historyAlerts } = await prepareVisitIntake(
    payload,
    existingVisit?.patientId
  );
  const blockingChecks = qualityChecks.filter((check) =>
    ["temperature", "systolic", "diastolic", "heartRate", "respiratoryRate", "oxygenSaturation", "symptomStatement", "nlpConfirmed"].includes(
      check.field
    )
  );

  if (blockingChecks.length) {
    return res.status(400).json({
      message: "Complete required assessment fields before referring the patient to the doctor queue.",
      structured,
      reviewPrompt,
      qualityChecks
    });
  }

  const visit = await submitVisitForDoctorReview({
    visitId: req.params.id,
    payload: { ...payload, visitType, historyAlerts },
    structured,
    reviewPrompt
  });

  if (!visit) {
    return res.status(404).json({ message: "Visit was not found." });
  }

  await addAuditLog(req.user.id, "visit.submit", {
    visitId: req.params.id,
    promptLevel: reviewPrompt.level
  });

  return res.json({ visit, structured, reviewPrompt, qualityChecks });
}

export async function completeNurseAssessment(req, res) {
  const parsed = visitIntakeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(intakeValidationResponse(parsed.error));
  }

  const existingVisit = await findVisitById(req.params.id);
  const payload = { ...parsed.data, assessmentOutcome: "treated_by_nurse" };
  const { structured, reviewPrompt, qualityChecks, visitType, historyAlerts } = await prepareVisitIntake(
    payload,
    existingVisit?.patientId
  );
  const blockingChecks = qualityChecks.filter((check) =>
    ["temperature", "systolic", "diastolic", "heartRate", "respiratoryRate", "oxygenSaturation", "symptomStatement", "nlpConfirmed"].includes(
      check.field
    )
  );
  const missingPrescriptionFields = prescriptionMissingFields(payload);

  if (missingPrescriptionFields.length) {
    return res.status(400).json({
      message: "Complete the medicine name and quantity before saving a prescription.",
      missingPrescriptionFields,
      structured,
      reviewPrompt,
      qualityChecks
    });
  }

  if (!String(payload.treatmentNotes || "").trim() && !hasPrescription(payload)) {
    return res.status(400).json({
      message: "Record treatment notes or a prescription before completing the nurse assessment.",
      structured,
      reviewPrompt,
      qualityChecks
    });
  }

  if (blockingChecks.length) {
    return res.status(400).json({
      message: "Complete required assessment fields before closing the nurse assessment.",
      structured,
      reviewPrompt,
      qualityChecks
    });
  }

  const result = await completeNurseAssessmentRecord({
    visitId: req.params.id,
    payload: { ...payload, visitType, historyAlerts },
    structured,
    reviewPrompt
  });

  if (!result?.visit) {
    return res.status(404).json({ message: "Visit was not found." });
  }

  await addAuditLog(req.user.id, "visit.nurse_complete", {
    visitId: req.params.id,
    prescriptionId: result.prescription?.id || null
  });

  return res.json({
    visit: result.visit,
    prescription: result.prescription,
    prescriptions: result.prescriptions || [],
    structured,
    reviewPrompt,
    qualityChecks
  });
}

export async function reviewDoctorVisit(req, res) {
  const parsed = doctorReviewSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Add a clear doctor review note before completing or returning the assessment.",
      errors: parsed.error.flatten().fieldErrors
    });
  }

  const currentVisit = await findVisitById(req.params.id);

  if (!currentVisit) {
    return res.status(404).json({ message: "Visit was not found." });
  }

  if (currentVisit.status !== "awaiting_doctor_review") {
    return res.status(400).json({
      message: "Only assessments currently waiting in the doctor queue can be reviewed from this page."
    });
  }

  const completionErrors = doctorCompletionErrors(parsed.data);

  if (completionErrors.length) {
    return res.status(400).json({
      message: "Complete the doctor consultation fields before finalising this visit.",
      qualityChecks: completionErrors
    });
  }

  const visit = await recordDoctorReview({
    visitId: req.params.id,
    doctorId: req.user.id,
    status: parsed.data.status,
    notes: parsed.data.notes,
    consultation: parsed.data.consultation,
    continuityPlan: parsed.data.continuityPlan,
    nlpFeedback: parsed.data.nlpFeedback
  });

  await addAuditLog(req.user.id, "visit.doctor_review", {
    visitId: req.params.id,
    status: parsed.data.status
  });

  return res.json({ visit });
}
