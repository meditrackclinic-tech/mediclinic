import { nanoid } from "nanoid";
import { hasDatabase, initializePostgres, query } from "./postgres.js";
import { createId, readData, timestamp, writeData } from "./store.js";

let clinicalStoreReady = null;

async function ensureClinicalStore() {
  if (!hasDatabase) {
    return;
  }

  if (!clinicalStoreReady) {
    clinicalStoreReady = initializePostgres();
  }

  await clinicalStoreReady;
}

function normalizeOptional(value) {
  return value === undefined || value === "" ? null : value;
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return undefined;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}

function formatPatientNumber(nextValue) {
  return `PT-${String(nextValue).padStart(6, "0")}`;
}

function formatVisitNumber(nextValue) {
  return `VST-${String(nextValue).padStart(6, "0")}`;
}

function mapPatient(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patientNumber: row.patient_number,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    age: row.age,
    gender: row.gender || "",
    contact: row.contact || "",
    clinicId: row.clinic_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSymptomRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    visitId: row.visit_id,
    patientId: row.patient_id,
    rawDescription: row.raw_description,
    structured: row.structured,
    recordedBy: row.recorded_by,
    createdAt: row.created_at
  };
}

function mapTimelineRecord(record) {
  return {
    id: record.id,
    date: record.createdAt,
    symptoms: record.structured.symptoms,
    severity: record.structured.severity,
    duration: record.structured.duration,
    temporalClues: record.structured.temporalClues,
    rawDescription: record.rawDescription,
    mainComplaint: record.structured.mainComplaint || null,
    symptomsPresent: record.structured.symptomsPresent || record.structured.activeSymptoms || [],
    symptomsAbsent: record.structured.symptomsAbsent || record.structured.negatedSymptoms || [],
    frequency: record.structured.frequency || null,
    progression: record.structured.progression || null,
    medicationAction: record.structured.medicationAction || null,
    followUpInstruction: record.structured.followUpInstruction || null,
    visitType: record.structured.visitType || null,
    clinicalSummary: record.structured.clinicalSummary || null
  };
}

function mapVital(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    visitId: row.visit_id,
    patientId: row.patient_id,
    temperature: row.temperature === null ? undefined : Number(row.temperature),
    systolic: row.systolic ?? undefined,
    diastolic: row.diastolic ?? undefined,
    heartRate: row.heart_rate ?? undefined,
    respiratoryRate: row.respiratory_rate ?? undefined,
    oxygenSaturation: row.oxygen_saturation ?? undefined,
    notes: row.notes || "",
    recordedBy: row.recorded_by,
    createdAt: row.created_at
  };
}

function mapPrescription(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    visitId: row.visit_id,
    patientId: row.patient_id,
    medicationName: row.medication_name,
    dose: row.dose || "",
    frequency: row.frequency || "",
    duration: row.duration || "",
    quantity: row.quantity || "",
    instructions: row.instructions || "",
    reason: row.reason || "",
    prescribedBy: row.prescribed_by,
    prescriberRole: row.prescriber_role || "",
    dispensed: Boolean(row.dispensed),
    createdAt: row.created_at
  };
}

function mapVisit(row) {
  if (!row) {
    return null;
  }

  const firstName = row.first_name || row.patient_first_name || "";
  const lastName = row.last_name || row.patient_last_name || "";

  return {
    id: row.id,
    visitNumber: row.visit_number,
    patientId: row.patient_id,
    patientNumber: row.patient_number,
    patientName: row.patient_name || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    clinicId: row.clinic_id,
    nurseId: row.nurse_id,
    nurseName: row.nurse_name || "",
    status: row.status,
    vitals: {
      temperature: row.temperature === null ? undefined : Number(row.temperature),
      systolic: row.systolic ?? undefined,
      diastolic: row.diastolic ?? undefined,
      heartRate: row.heart_rate ?? undefined,
      respiratoryRate: row.respiratory_rate ?? undefined,
      oxygenSaturation: row.oxygen_saturation ?? undefined,
      notes: row.vitals_notes || ""
    },
    symptomStatement: row.symptom_statement || "",
    nlpResult: row.nlp_result || null,
    nlpConfirmed: Boolean(row.nlp_confirmed),
    nurseCorrections: row.nurse_corrections || {},
    assessmentOutcome: row.assessment_outcome || "",
    treatmentNotes: row.treatment_notes || "",
    prescriptionDraft: row.draft_prescription || {},
    reviewPrompt: {
      level: row.review_prompt_level || "routine_review",
      label: row.review_prompt_label || "Routine Review",
      reasons: row.review_prompt_reasons || []
    },
    doctorId: row.doctor_id,
    doctorNotes: row.doctor_notes || "",
    doctorConsultation: row.doctor_consultation || {},
    continuityPlan: row.continuity_plan || {},
    nlpFeedback: row.nlp_feedback || {},
    patientSummary: row.patient_summary || {},
    visitType: row.visit_type || null,
    historyAlerts: row.history_alerts || [],
    inputMethod: row.input_method || "text",
    originalTranscript: row.original_transcript || "",
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeVisitPayload(payload = {}) {
  return {
    temperature: normalizeOptional(payload.temperature),
    systolic: normalizeOptional(payload.systolic),
    diastolic: normalizeOptional(payload.diastolic),
    heartRate: normalizeOptional(payload.heartRate),
    respiratoryRate: normalizeOptional(payload.respiratoryRate),
    oxygenSaturation: normalizeOptional(payload.oxygenSaturation),
    notes: normalizeOptional(payload.notes),
    symptomStatement: normalizeOptional(payload.symptomStatement),
    nlpConfirmed: Boolean(payload.nlpConfirmed),
    nurseCorrections: payload.nurseCorrections || {},
    assessmentOutcome: normalizeOptional(payload.assessmentOutcome),
    treatmentNotes: normalizeOptional(payload.treatmentNotes),
    prescriptionDraft: payload.prescription || {},
    visitType: normalizeOptional(payload.visitType),
    historyAlerts: payload.historyAlerts || [],
    inputMethod: payload.inputMethod || "text",
    originalTranscript: normalizeOptional(payload.originalTranscript)
  };
}

function patientMatchesSearch(patient, queryText) {
  const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
  const patientNumber = String(patient.patientNumber || "").toLowerCase();
  const contact = String(patient.contact || "").toLowerCase();

  return (
    !queryText ||
    fullName.includes(queryText) ||
    patient.id.toLowerCase().includes(queryText) ||
    patientNumber.includes(queryText) ||
    contact.includes(queryText)
  );
}

export async function countPatients(search = "") {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM patients
        WHERE
          $1 = ''
          OR LOWER(first_name || ' ' || last_name) LIKE '%' || LOWER($1) || '%'
          OR LOWER(id) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(patient_number, '')) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(contact, '')) LIKE '%' || LOWER($1) || '%';
      `,
      [search]
    );
    return result.rows[0].total;
  }

  const data = await readData();
  const queryText = search.toLowerCase();
  return data.patients.filter((patient) => patientMatchesSearch(patient, queryText)).length;
}

export async function listPatients(search = "", { limit = 25, offset = 0 } = {}) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT *
        FROM patients
        WHERE
          $1 = ''
          OR LOWER(first_name || ' ' || last_name) LIKE '%' || LOWER($1) || '%'
          OR LOWER(id) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(patient_number, '')) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(contact, '')) LIKE '%' || LOWER($1) || '%'
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
      `,
      [search, limit, offset]
    );
    return result.rows.map(mapPatient);
  }

  const data = await readData();
  const queryText = search.toLowerCase();
  return data.patients
    .filter((patient) => patientMatchesSearch(patient, queryText))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(offset, offset + limit);
}

export async function createPatient(patientData, createdBy) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const id = nanoid();
    const patientCount = await query("SELECT COUNT(*)::int AS total FROM patients;");
    const patientNumber = formatPatientNumber(patientCount.rows[0].total + 1);
    const age = patientData.dateOfBirth ? calculateAge(patientData.dateOfBirth) : patientData.age;
    const result = await query(
      `
        INSERT INTO patients (
          id, patient_number, clinic_id, first_name, last_name, date_of_birth, age, gender, contact, created_by
        )
        VALUES ($1, $2, 'khomas-prototype-clinic', $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `,
      [
        id,
        patientNumber,
        patientData.firstName,
        patientData.lastName,
        normalizeOptional(patientData.dateOfBirth),
        normalizeOptional(age),
        normalizeOptional(patientData.gender),
        normalizeOptional(patientData.contact),
        createdBy
      ]
    );
    return mapPatient(result.rows[0]);
  }

  const data = await readData();
  const patientNumber = formatPatientNumber((data.patients || []).length + 1);
  const age = patientData.dateOfBirth ? calculateAge(patientData.dateOfBirth) : patientData.age;
  const patient = {
    id: createId(),
    patientNumber,
    ...patientData,
    age,
    createdAt: timestamp(),
    createdBy
  };

  data.patients.push(patient);
  await writeData(data);
  return patient;
}

export async function findPatientById(id) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query("SELECT * FROM patients WHERE id = $1 LIMIT 1;", [id]);
    return mapPatient(result.rows[0]);
  }

  const data = await readData();
  return data.patients.find((item) => item.id === id) || null;
}

export async function createSymptomRecord({ patientId, visitId, rawDescription, structured, recordedBy }) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const id = nanoid();
    const result = await query(
      `
        INSERT INTO symptom_records (
          id,
          visit_id,
          patient_id,
          raw_description,
          structured,
          symptom_terms,
          severity,
          duration,
          body_part,
          temporal_clues,
          confidence,
          recorded_by
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `,
      [
        id,
        normalizeOptional(visitId),
        patientId,
        rawDescription,
        JSON.stringify(structured),
        structured.symptoms || [],
        normalizeOptional(structured.severity),
        normalizeOptional(structured.duration),
        normalizeOptional(structured.bodyPart),
        structured.temporalClues || [],
        structured.confidence ?? null,
        recordedBy
      ]
    );
    return mapSymptomRecord(result.rows[0]);
  }

  const data = await readData();
  const symptomRecord = {
    id: createId(),
    visitId,
    patientId,
    rawDescription,
    structured,
    recordedBy,
    createdAt: timestamp()
  };

  data.symptomRecords.push(symptomRecord);
  await writeData(data);
  return symptomRecord;
}

export async function listSymptomRecordsByPatient(patientId) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT *
        FROM symptom_records
        WHERE patient_id = $1
        ORDER BY created_at DESC;
      `,
      [patientId]
    );
    return result.rows.map(mapSymptomRecord);
  }

  const data = await readData();
  return data.symptomRecords
    .filter((record) => record.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listSymptomTimelineByPatient(patientId) {
  const records = await listSymptomRecordsByPatient(patientId);
  return records
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(mapTimelineRecord);
}

export async function createVitalRecord({ patientId, visitId, vitals, recordedBy }) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const id = nanoid();
    const result = await query(
      `
        INSERT INTO vitals (
          id,
          visit_id,
          patient_id,
          temperature,
          systolic,
          diastolic,
          heart_rate,
          respiratory_rate,
          oxygen_saturation,
          notes,
          recorded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `,
      [
        id,
        normalizeOptional(visitId),
        patientId,
        normalizeOptional(vitals.temperature),
        normalizeOptional(vitals.systolic),
        normalizeOptional(vitals.diastolic),
        normalizeOptional(vitals.heartRate),
        normalizeOptional(vitals.respiratoryRate),
        normalizeOptional(vitals.oxygenSaturation),
        normalizeOptional(vitals.notes),
        recordedBy
      ]
    );
    return mapVital(result.rows[0]);
  }

  const data = await readData();
  const vital = {
    id: createId(),
    visitId,
    ...vitals,
    patientId,
    recordedBy,
    createdAt: timestamp()
  };

  data.vitals.push(vital);
  await writeData(data);
  return vital;
}

export async function listVitalsByPatient(patientId) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT *
        FROM vitals
        WHERE patient_id = $1
        ORDER BY created_at DESC;
      `,
      [patientId]
    );
    return result.rows.map(mapVital);
  }

  const data = await readData();
  return data.vitals
    .filter((record) => record.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createPrescriptionRecord({
  patientId,
  visitId,
  prescription,
  prescribedBy,
  prescriberRole = "nurse"
}) {
  const medicationName = String(prescription?.medicationName || "").trim();

  if (!medicationName) {
    return null;
  }

  if (hasDatabase) {
    await ensureClinicalStore();
    const id = nanoid();
    const result = await query(
      `
        INSERT INTO prescriptions (
          id,
          visit_id,
          patient_id,
          medication_name,
          dose,
          frequency,
          duration,
          quantity,
          instructions,
          reason,
          prescribed_by,
          prescriber_role,
          dispensed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `,
      [
        id,
        normalizeOptional(visitId),
        patientId,
        medicationName,
        normalizeOptional(prescription.dose),
        normalizeOptional(prescription.frequency),
        normalizeOptional(prescription.duration),
        normalizeOptional(prescription.quantity),
        normalizeOptional(prescription.instructions),
        normalizeOptional(prescription.reason),
        prescribedBy,
        prescriberRole,
        Boolean(prescription.dispensed)
      ]
    );
    return mapPrescription(result.rows[0]);
  }

  const data = await readData();
  const record = {
    id: createId(),
    visitId,
    patientId,
    medicationName,
    dose: prescription.dose || "",
    frequency: prescription.frequency || "",
    duration: prescription.duration || "",
    quantity: prescription.quantity || "",
    instructions: prescription.instructions || "",
    reason: prescription.reason || "",
    prescribedBy,
    prescriberRole,
    dispensed: Boolean(prescription.dispensed),
    createdAt: timestamp()
  };

  data.prescriptions.push(record);
  await writeData(data);
  return record;
}

function normalizePrescriptionEntries(prescription = {}) {
  const rows = Array.isArray(prescription.medications)
    ? prescription.medications
    : prescription.medicationName || prescription.quantity
      ? [prescription]
      : [];

  return rows
    .map((item) => ({
      ...prescription,
      medicationName: String(item?.medicationName || "").trim(),
      quantity: String(item?.quantity || "").trim(),
      instructions: String(item?.instructions || prescription.instructions || "").trim()
    }))
    .filter((item) => item.medicationName);
}

export async function listPrescriptionsByPatient(patientId) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT *
        FROM prescriptions
        WHERE patient_id = $1
        ORDER BY created_at DESC;
      `,
      [patientId]
    );
    return result.rows.map(mapPrescription);
  }

  const data = await readData();
  return (data.prescriptions || [])
    .filter((record) => record.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildMedicationSafety(prescriptions = [], proposedMedication = "") {
  const now = Date.now();
  const proposed = proposedMedication.trim().toLowerCase();
  const recent30 = prescriptions.filter(
    (item) => now - new Date(item.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000
  );
  const sameMedicationRecent = proposed
    ? prescriptions.filter(
        (item) =>
          item.medicationName?.toLowerCase() === proposed &&
          now - new Date(item.createdAt).getTime() <= 14 * 24 * 60 * 60 * 1000
      )
    : [];
  const medicationCounts = recent30.reduce((counts, item) => {
    const key = item.medicationName?.toLowerCase();
    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, {});
  const repeatedMedicines = Object.entries(medicationCounts)
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({ name, count }));
  const alerts = [];

  if (sameMedicationRecent.length) {
    alerts.push({
      level: "warning",
      message: `${sameMedicationRecent[0].medicationName} was already recorded for this patient within the last 14 days. Check before dispensing again.`
    });
  }

  if (recent30.length >= 3) {
    alerts.push({
      level: "review",
      message: "This patient has several recent medicine records. Review the history before issuing more medicine."
    });
  }

  if (repeatedMedicines.length) {
    alerts.push({
      level: "review",
      message: "Repeated medicine requests appear in the recent history. Confirm the clinical reason and quantity."
    });
  }

  if (!alerts.length) {
    alerts.push({
      level: "clear",
      message: "No recent duplicate medicine record detected in this prototype history."
    });
  }

  return {
    alerts,
    recentCount: recent30.length,
    sameMedicationRecent,
    repeatedMedicines
  };
}

export async function startVisit({ patientId, nurseId }) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const id = nanoid();
    const visitCount = await query("SELECT COUNT(*)::int AS total FROM visits;");
    const visitNumber = formatVisitNumber(visitCount.rows[0].total + 1);
    const result = await query(
      `
        INSERT INTO visits (id, visit_number, patient_id, clinic_id, nurse_id, status)
        SELECT $1, $2, patients.id, patients.clinic_id, $3, 'draft'
        FROM patients
        WHERE patients.id = $4
        RETURNING *;
      `,
      [id, visitNumber, nurseId, patientId]
    );

    return mapVisit(result.rows[0]);
  }

  const data = await readData();
  const patient = data.patients.find((item) => item.id === patientId);

  if (!patient) {
    return null;
  }

  const visit = {
    id: createId(),
    visitNumber: formatVisitNumber((data.visits || []).length + 1),
    patientId,
    patientNumber: patient.patientNumber,
    clinicId: patient.clinicId || "khomas-prototype-clinic",
    nurseId,
    status: "draft",
    vitals: {},
    symptomStatement: "",
    nlpResult: null,
    nlpConfirmed: false,
    nurseCorrections: {},
    assessmentOutcome: "",
    treatmentNotes: "",
    prescriptionDraft: {},
    reviewPrompt: {
      level: "routine_review",
      label: "Routine Review",
      reasons: ["No configured review-alert criteria detected."]
    },
    visitType: null,
    historyAlerts: [],
    inputMethod: "text",
    originalTranscript: "",
    createdAt: timestamp(),
    updatedAt: timestamp()
  };

  data.visits.unshift(visit);
  await writeData(data);
  return visit;
}

export async function updateVisitIntake({ visitId, payload, structured, reviewPrompt, status = "in_progress" }) {
  const normalized = normalizeVisitPayload(payload);

  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        UPDATE visits
        SET
          status = $2,
          temperature = $3,
          systolic = $4,
          diastolic = $5,
          heart_rate = $6,
          respiratory_rate = $7,
          oxygen_saturation = $8,
          vitals_notes = $9,
          symptom_statement = $10,
          nlp_result = $11::jsonb,
          nlp_confirmed = $12,
          nurse_corrections = $13::jsonb,
          assessment_outcome = $14,
          treatment_notes = $15,
          draft_prescription = $16::jsonb,
          review_prompt_level = $17,
          review_prompt_label = $18,
          review_prompt_reasons = $19,
          visit_type = $20,
          history_alerts = $21::jsonb,
          input_method = $22,
          original_transcript = $23,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `,
      [
        visitId,
        status,
        normalized.temperature,
        normalized.systolic,
        normalized.diastolic,
        normalized.heartRate,
        normalized.respiratoryRate,
        normalized.oxygenSaturation,
        normalized.notes,
        normalized.symptomStatement,
        JSON.stringify(structured || {}),
        normalized.nlpConfirmed,
        JSON.stringify(normalized.nurseCorrections),
        normalized.assessmentOutcome,
        normalized.treatmentNotes,
        JSON.stringify(normalized.prescriptionDraft),
        reviewPrompt.level,
        reviewPrompt.label,
        reviewPrompt.reasons,
        normalized.visitType,
        JSON.stringify(normalized.historyAlerts),
        normalized.inputMethod,
        normalized.originalTranscript
      ]
    );

    return mapVisit(result.rows[0]);
  }

  const data = await readData();
  const visit = (data.visits || []).find((item) => item.id === visitId);

  if (!visit) {
    return null;
  }

  Object.assign(visit, {
    status,
    vitals: {
      temperature: normalized.temperature,
      systolic: normalized.systolic,
      diastolic: normalized.diastolic,
      heartRate: normalized.heartRate,
      respiratoryRate: normalized.respiratoryRate,
      oxygenSaturation: normalized.oxygenSaturation,
      notes: normalized.notes || ""
    },
    symptomStatement: normalized.symptomStatement || "",
    nlpResult: structured || {},
    nlpConfirmed: normalized.nlpConfirmed,
    nurseCorrections: normalized.nurseCorrections,
    assessmentOutcome: normalized.assessmentOutcome || "",
    treatmentNotes: normalized.treatmentNotes || "",
    prescriptionDraft: normalized.prescriptionDraft,
    reviewPrompt,
    visitType: normalized.visitType || null,
    historyAlerts: normalized.historyAlerts,
    inputMethod: normalized.inputMethod,
    originalTranscript: normalized.originalTranscript || "",
    updatedAt: timestamp()
  });

  await writeData(data);
  return visit;
}

export async function submitVisitForDoctorReview({ visitId, payload, structured, reviewPrompt }) {
  const visit = await updateVisitIntake({
    visitId,
    payload,
    structured,
    reviewPrompt,
    status: "awaiting_doctor_review"
  });

  if (!visit) {
    return null;
  }

  if (hasDatabase) {
    await query(
      `
        UPDATE visits
        SET submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
        WHERE id = $1;
      `,
      [visitId]
    );
    const refreshed = await findVisitById(visitId);

    if (payload.symptomStatement) {
      await createSymptomRecord({
        patientId: refreshed.patientId,
        visitId,
        rawDescription: payload.symptomStatement,
        structured,
        recordedBy: refreshed.nurseId
      });
    }

    await createVitalRecord({
      patientId: refreshed.patientId,
      visitId,
      vitals: payload,
      recordedBy: refreshed.nurseId
    });

    return findVisitById(visitId);
  }

  const data = await readData();
  const storedVisit = (data.visits || []).find((item) => item.id === visitId);
  storedVisit.submittedAt = storedVisit.submittedAt || timestamp();
  storedVisit.updatedAt = timestamp();

  if (payload.symptomStatement) {
    data.symptomRecords.push({
      id: createId(),
      visitId,
      patientId: storedVisit.patientId,
      rawDescription: payload.symptomStatement,
      structured,
      recordedBy: storedVisit.nurseId,
      createdAt: timestamp()
    });
  }

  data.vitals.push({
    id: createId(),
    visitId,
    patientId: storedVisit.patientId,
    ...payload,
    recordedBy: storedVisit.nurseId,
    createdAt: timestamp()
  });

  await writeData(data);
  return storedVisit;
}

export async function completeNurseAssessment({ visitId, payload, structured, reviewPrompt }) {
  const visit = await updateVisitIntake({
    visitId,
    payload: {
      ...payload,
      assessmentOutcome: payload.assessmentOutcome || "treated_by_nurse"
    },
    structured,
    reviewPrompt,
    status: "completed"
  });

  if (!visit) {
    return null;
  }

  if (hasDatabase) {
    const refreshed = await findVisitById(visitId);

    if (payload.symptomStatement) {
      await createSymptomRecord({
        patientId: refreshed.patientId,
        visitId,
        rawDescription: payload.symptomStatement,
        structured,
        recordedBy: refreshed.nurseId
      });
    }

    await createVitalRecord({
      patientId: refreshed.patientId,
      visitId,
      vitals: payload,
      recordedBy: refreshed.nurseId
    });

    const prescriptions = (
      await Promise.all(
        normalizePrescriptionEntries(payload.prescription).map((prescription) =>
          createPrescriptionRecord({
            patientId: refreshed.patientId,
            visitId,
            prescription,
            prescribedBy: refreshed.nurseId,
            prescriberRole: "nurse"
          })
        )
      )
    ).filter(Boolean);

    return {
      visit: await findVisitById(visitId),
      prescription: prescriptions[0] || null,
      prescriptions
    };
  }

  const data = await readData();
  const storedVisit = (data.visits || []).find((item) => item.id === visitId);

  if (payload.symptomStatement) {
    data.symptomRecords.push({
      id: createId(),
      visitId,
      patientId: storedVisit.patientId,
      rawDescription: payload.symptomStatement,
      structured,
      recordedBy: storedVisit.nurseId,
      createdAt: timestamp()
    });
  }

  data.vitals.push({
    id: createId(),
    visitId,
    patientId: storedVisit.patientId,
    ...payload,
    recordedBy: storedVisit.nurseId,
    createdAt: timestamp()
  });

  const prescriptions = normalizePrescriptionEntries(payload.prescription).map((prescription) => ({
        id: createId(),
        visitId,
        patientId: storedVisit.patientId,
        medicationName: prescription.medicationName,
        dose: payload.prescription?.dose || "",
        frequency: payload.prescription?.frequency || "",
        duration: payload.prescription?.duration || "",
        quantity: prescription.quantity || "",
        instructions: prescription.instructions || payload.prescription?.instructions || "",
        reason: payload.prescription?.reason || "",
        prescribedBy: storedVisit.nurseId,
        prescriberRole: "nurse",
        dispensed: Boolean(payload.prescription?.dispensed),
        createdAt: timestamp()
      }));

  if (prescriptions.length) {
    data.prescriptions.push(...prescriptions);
  }

  storedVisit.updatedAt = timestamp();
  await writeData(data);

  return { visit: storedVisit, prescription: prescriptions[0] || null, prescriptions };
}

function buildPatientSummary({ visit, consultation = {}, continuityPlan = {} }) {
  const vitals = visit?.vitals || visit || {};
  const nlp = visit?.nlpResult || visit?.nlp_result || {};

  return {
    status: "passport_ready_draft",
    visitNumber: visit?.visitNumber || visit?.visit_number || "",
    visitDate: new Date().toISOString(),
    outcome: consultation.outcome || "",
    diagnosis: consultation.diagnosis || "",
    patientInstructions: consultation.instructions || "",
    nurseAssessment: {
      patientStatement: visit?.symptomStatement || visit?.symptom_statement || "",
      vitals: {
        temperature: vitals.temperature,
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        heartRate: vitals.heartRate,
        respiratoryRate: vitals.respiratoryRate,
        oxygenSaturation: vitals.oxygenSaturation
      },
      nlpStructuredComplaint: {
        symptoms: nlp.symptoms || [],
        severity: nlp.severity || null,
        duration: nlp.duration || null,
        negatedSymptoms: nlp.negatedSymptoms || []
      }
    },
    followUp: continuityPlan.followUpRequired
      ? {
          date: continuityPlan.followUpDate || "",
          reason: continuityPlan.followUpReason || ""
        }
      : null,
    referral: continuityPlan.referralRequired
      ? {
          destination: continuityPlan.referralDestination || "",
          urgency: continuityPlan.referralUrgency || "",
          reason: continuityPlan.referralReason || ""
        }
      : null,
    hiddenFromPatient: [
      "Internal NLP confidence scores",
      "Internal review prompt rules",
      "Unapproved doctor working notes"
    ]
  };
}

export async function recordDoctorReview({
  visitId,
  doctorId,
  status,
  notes,
  consultation = {},
  continuityPlan = {},
  nlpFeedback = {}
}) {
  const nextStatus = status === "returned_for_correction" ? "returned_for_correction" : "reviewed_by_doctor";
  const normalizedNotes = normalizeOptional(notes);
  const currentVisit = await findVisitById(visitId);
  const patientSummary = nextStatus === "reviewed_by_doctor"
    ? buildPatientSummary({ visit: currentVisit || { visitNumber: "" }, consultation, continuityPlan })
    : {};

  if (hasDatabase) {
    await ensureClinicalStore();
    await query(
      `
        INSERT INTO doctor_reviews (id, visit_id, doctor_id, status, notes)
        VALUES ($1, $2, $3, $4, $5);
      `,
      [nanoid(), visitId, doctorId, nextStatus, normalizedNotes]
    );

    const result = await query(
      `
        UPDATE visits
        SET
          status = $2,
          doctor_id = $3,
          doctor_notes = $4,
          doctor_consultation = $5::jsonb,
          continuity_plan = $6::jsonb,
          nlp_feedback = $7::jsonb,
          patient_summary = $8::jsonb,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `,
      [
        visitId,
        nextStatus,
        doctorId,
        normalizedNotes,
        JSON.stringify(consultation || {}),
        JSON.stringify(continuityPlan || {}),
        JSON.stringify(nlpFeedback || {}),
        JSON.stringify(patientSummary)
      ]
    );

    return mapVisit(result.rows[0]);
  }

  const data = await readData();
  const visit = (data.visits || []).find((item) => item.id === visitId);

  if (!visit) {
    return null;
  }

  visit.status = nextStatus;
  visit.doctorId = doctorId;
  visit.doctorNotes = normalizedNotes || "";
  visit.doctorConsultation = consultation || {};
  visit.continuityPlan = continuityPlan || {};
  visit.nlpFeedback = nlpFeedback || {};
  visit.patientSummary = nextStatus === "reviewed_by_doctor"
    ? buildPatientSummary({ visit, consultation, continuityPlan })
    : {};
  visit.reviewedAt = timestamp();
  visit.updatedAt = timestamp();
  data.doctorReviews = data.doctorReviews || [];
  data.doctorReviews.push({
    id: createId(),
    visitId,
    doctorId,
    status: nextStatus,
    notes: normalizedNotes || "",
    createdAt: timestamp()
  });

  await writeData(data);
  return findVisitById(visitId);
}

export async function findVisitById(visitId) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const result = await query(
      `
        SELECT
          visits.*,
          patients.patient_number,
          patients.first_name,
          patients.last_name,
          users.name AS nurse_name
        FROM visits
        LEFT JOIN patients ON patients.id = visits.patient_id
        LEFT JOIN users ON users.id = visits.nurse_id
        WHERE visits.id = $1
        LIMIT 1;
      `,
      [visitId]
    );

    return mapVisit(result.rows[0]);
  }

  const data = await readData();
  const visit = (data.visits || []).find((item) => item.id === visitId);

  if (!visit) {
    return null;
  }

  const patient = data.patients.find((item) => item.id === visit.patientId);
  return {
    ...visit,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    firstName: patient?.firstName || "",
    lastName: patient?.lastName || "",
    patientNumber: patient?.patientNumber || visit.patientNumber
  };
}

export async function listVisits({ status, patientId } = {}) {
  if (hasDatabase) {
    await ensureClinicalStore();
    const statuses = status ? status.split(",").map((item) => item.trim()).filter(Boolean) : [];
    const result = await query(
      `
        SELECT
          visits.*,
          patients.patient_number,
          patients.first_name,
          patients.last_name,
          users.name AS nurse_name
        FROM visits
        LEFT JOIN patients ON patients.id = visits.patient_id
        LEFT JOIN users ON users.id = visits.nurse_id
        WHERE ($1::text[] IS NULL OR visits.status = ANY($1::text[]))
          AND ($2::text IS NULL OR visits.patient_id = $2)
        ORDER BY visits.updated_at DESC, visits.created_at DESC;
      `,
      [statuses.length ? statuses : null, normalizeOptional(patientId)]
    );

    return result.rows.map(mapVisit);
  }

  const data = await readData();
  const statuses = status ? status.split(",").map((item) => item.trim()).filter(Boolean) : [];

  return (data.visits || [])
    .filter((visit) => !statuses.length || statuses.includes(visit.status))
    .filter((visit) => !patientId || visit.patientId === patientId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map((visit) => {
      const patient = data.patients.find((item) => item.id === visit.patientId);
      return {
        ...visit,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
        firstName: patient?.firstName || "",
        lastName: patient?.lastName || "",
        patientNumber: patient?.patientNumber || visit.patientNumber
      };
    });
}

export async function getPatientProfile(patientId) {
  const patient = await findPatientById(patientId);

  if (!patient) {
    return null;
  }

  const [visits, vitals, timeline, prescriptions] = await Promise.all([
    listVisits({ patientId }),
    listVitalsByPatient(patientId),
    listSymptomTimelineByPatient(patientId),
    listPrescriptionsByPatient(patientId)
  ]);

  return {
    patient,
    latestActivity: {
      visit: visits[0] || null,
      vitals: vitals[0] || null,
      symptoms: timeline[timeline.length - 1] || null,
      prescription: prescriptions[0] || null
    },
    visits,
    vitalsHistory: vitals,
    symptomTimeline: timeline,
    prescriptionHistory: prescriptions,
    medicineSafety: buildMedicationSafety(prescriptions)
  };
}

export async function getReportSummary() {
  if (hasDatabase) {
    await ensureClinicalStore();
    const [patientTotal, symptomTotal, vitalsTotal, commonSymptoms, recentRecords] =
      await Promise.all([
        query("SELECT COUNT(*)::int AS total FROM patients;"),
        query("SELECT COUNT(*)::int AS total FROM symptom_records;"),
        query("SELECT COUNT(*)::int AS total FROM vitals;"),
        query(`
          SELECT symptom AS name, COUNT(*)::int AS count
          FROM symptom_records, UNNEST(symptom_terms) AS symptom
          GROUP BY symptom
          ORDER BY count DESC, symptom ASC
          LIMIT 5;
        `),
        query(`
          SELECT *
          FROM symptom_records
          ORDER BY created_at DESC
          LIMIT 5;
        `)
      ]);

    return {
      totals: {
        patients: patientTotal.rows[0].total,
        symptomRecords: symptomTotal.rows[0].total,
        vitals: vitalsTotal.rows[0].total
      },
      commonSymptoms: commonSymptoms.rows,
      recentRecords: recentRecords.rows.map(mapSymptomRecord)
    };
  }

  const data = await readData();
  const symptomCounts = {};

  for (const record of data.symptomRecords) {
    for (const symptom of record.structured.symptoms) {
      symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
    }
  }

  return {
    totals: {
      patients: data.patients.length,
      symptomRecords: data.symptomRecords.length,
      vitals: data.vitals.length
    },
    commonSymptoms: Object.entries(symptomCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recentRecords: data.symptomRecords
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  };
}

function vitalsCompleteness(record = {}) {
  const requiredFields = [
    "temperature",
    "systolic",
    "diastolic",
    "heartRate",
    "respiratoryRate",
    "oxygenSaturation"
  ];
  const completed = requiredFields.filter(
    (field) => record[field] !== undefined && record[field] !== null && record[field] !== ""
  ).length;

  return Math.round((completed / requiredFields.length) * 100);
}

function getVitalsStatusLabel(record = {}) {
  const completeness = vitalsCompleteness(record);

  if (!completeness) {
    return "No vitals";
  }

  if (completeness < 100) {
    return "Partial";
  }

  return "Complete";
}

function buildFallbackNurseSummary(data) {
  const vitalsByPatient = new Map();

  for (const vital of data.vitals || []) {
    const current = vitalsByPatient.get(vital.patientId);

    if (!current || new Date(vital.createdAt) > new Date(current.createdAt)) {
      vitalsByPatient.set(vital.patientId, vital);
    }
  }

  const symptomPatientIds = new Set((data.symptomRecords || []).map((record) => record.patientId));
  const today = new Date().toISOString().slice(0, 10);
  const needsVitals = (data.patients || [])
    .filter((patient) => !vitalsByPatient.has(patient.id))
    .slice(0, 5)
    .map((patient) => ({
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      age: patient.age,
      reason: "No vitals recorded yet",
      createdAt: patient.createdAt
    }));
  const readyForReview = (data.patients || [])
    .filter((patient) => symptomPatientIds.has(patient.id))
    .slice(0, 5)
    .map((patient) => ({
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      reason: "Symptom note captured",
      createdAt: patient.createdAt
    }));
  const statusCounts = (data.vitals || []).reduce(
    (counts, vital) => {
      counts[getVitalsStatusLabel(vital)] += 1;
      return counts;
    },
    { Complete: 0, Partial: 0, "No vitals": 0 }
  );
  const waitingPatients = (data.patients || []).filter((patient) => !vitalsByPatient.has(patient.id))
    .length;
  const symptomNotesPending = (data.patients || []).filter(
    (patient) => !symptomPatientIds.has(patient.id)
  ).length;
  const urgentReviewCount = (data.symptomRecords || []).filter((record) => {
    const severity = String(record.structured?.severity || "").toLowerCase();
    return ["high", "severe", "urgent", "emergency"].some((term) => severity.includes(term));
  }).length;
  const visitWithPatient = (visit) => {
    const patient = data.patients.find((item) => item.id === visit.patientId);
    return {
      ...visit,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient",
      patientNumber: patient?.patientNumber || visit.patientNumber
    };
  };
  const activeIntakes = (data.visits || [])
    .filter((visit) => ["draft", "in_progress", "returned_for_correction"].includes(visit.status))
    .slice(0, 5)
    .map(visitWithPatient);
  const doctorHandoffs = (data.visits || [])
    .filter((visit) => ["awaiting_doctor_review", "reviewed_by_doctor"].includes(visit.status))
    .slice(0, 5)
    .map(visitWithPatient);
  const recentCompleted = (data.visits || [])
    .filter((visit) => ["completed", "reviewed_by_doctor"].includes(visit.status))
    .slice(0, 5)
    .map(visitWithPatient);

  return {
    generatedAt: timestamp(),
    totals: {
      patients: data.patients.length,
      symptomRecords: data.symptomRecords.length,
      vitals: data.vitals.length,
      waitingPatients,
      vitalsRecordedToday: (data.vitals || []).filter((vital) =>
        String(vital.createdAt || "").startsWith(today)
      ).length,
      symptomNotesPending,
      urgentReviewCount,
      activeIntakes: activeIntakes.length,
      doctorHandoffs: doctorHandoffs.length,
      recentlyCompleted: recentCompleted.length,
      needsVitals: needsVitals.length,
      readyForReview: readyForReview.length
    },
    hourlyLoad: [
      { label: "08:00", value: 0 },
      { label: "09:00", value: 0 },
      { label: "10:00", value: 0 },
      { label: "11:00", value: 0 },
      { label: "12:00", value: 0 },
      { label: "14:00", value: 0 },
      { label: "16:00", value: 0 },
      { label: "18:00", value: 0 }
    ],
    vitalsStatus: Object.entries(statusCounts).map(([label, value]) => ({ label, value })),
    needsVitals,
    readyForReview,
    activeIntakes,
    doctorHandoffs,
    recentCompleted,
    recentCaptures: (data.symptomRecords || [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((record) => {
        const patient = data.patients.find((item) => item.id === record.patientId);

        return {
          id: record.id,
          patientId: record.patientId,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient",
          symptoms: record.structured?.symptoms || [],
          severity: record.structured?.severity || "",
          createdAt: record.createdAt
        };
      }),
    reminders: [
      "Confirm patient identity before recording vitals.",
      "Record vitals before symptom capture when possible.",
      "Escalate concerning observations to the doctor for review."
    ]
  };
}

export async function getNurseWorkflowSummary() {
  if (hasDatabase) {
    await ensureClinicalStore();
    const [
      patientTotal,
      symptomTotal,
      vitalsTotal,
      waitingPatientsTotal,
      vitalsToday,
      symptomNotesPending,
      urgentReviewTotal,
      needsVitals,
      readyForReview,
      recentCaptures,
      hourlyLoad,
      vitalsStatus
    ] = await Promise.all([
      query("SELECT COUNT(*)::int AS total FROM patients;"),
      query("SELECT COUNT(*)::int AS total FROM symptom_records;"),
      query("SELECT COUNT(*)::int AS total FROM vitals;"),
      query(`
        SELECT COUNT(*)::int AS total
        FROM patients
        WHERE NOT EXISTS (
          SELECT 1
          FROM vitals
          WHERE vitals.patient_id = patients.id
        );
      `),
      query("SELECT COUNT(*)::int AS total FROM vitals WHERE created_at::date = CURRENT_DATE;"),
      query(`
        SELECT COUNT(*)::int AS total
        FROM patients
        WHERE NOT EXISTS (
          SELECT 1
          FROM symptom_records
          WHERE symptom_records.patient_id = patients.id
        );
      `),
      query(`
        SELECT COUNT(*)::int AS total
        FROM symptom_records
        WHERE LOWER(COALESCE(severity, structured->>'severity', '')) LIKE ANY (
          ARRAY['%high%', '%severe%', '%urgent%', '%emergency%']
        );
      `),
      query(`
        SELECT
          patients.id,
          patients.first_name,
          patients.last_name,
          patients.age,
          patients.created_at,
          MAX(vitals.created_at) AS last_vitals_at
        FROM patients
        LEFT JOIN vitals ON vitals.patient_id = patients.id
        GROUP BY patients.id
        ORDER BY MAX(vitals.created_at) ASC NULLS FIRST, patients.created_at DESC
        LIMIT 5;
      `),
      query(`
        SELECT
          patients.id,
          patients.first_name,
          patients.last_name,
          MAX(symptom_records.created_at) AS last_symptom_at
        FROM patients
        INNER JOIN symptom_records ON symptom_records.patient_id = patients.id
        GROUP BY patients.id
        ORDER BY MAX(symptom_records.created_at) DESC
        LIMIT 5;
      `),
      query(`
        SELECT
          symptom_records.id,
          symptom_records.patient_id,
          symptom_records.structured,
          symptom_records.severity,
          symptom_records.created_at,
          patients.first_name,
          patients.last_name
        FROM symptom_records
        LEFT JOIN patients ON patients.id = symptom_records.patient_id
        ORDER BY symptom_records.created_at DESC
        LIMIT 5;
      `),
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:00') AS label,
          COUNT(*)::int AS value
        FROM patients
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY DATE_TRUNC('hour', created_at) ASC
        LIMIT 8;
      `),
      query(`
        SELECT 'Complete' AS label,
          COUNT(*) FILTER (
            WHERE temperature IS NOT NULL
              AND systolic IS NOT NULL
              AND diastolic IS NOT NULL
              AND heart_rate IS NOT NULL
              AND respiratory_rate IS NOT NULL
              AND oxygen_saturation IS NOT NULL
          )::int AS value
        FROM vitals
        UNION ALL
        SELECT 'Partial' AS label,
          COUNT(*) FILTER (
            WHERE temperature IS NULL
              OR systolic IS NULL
              OR diastolic IS NULL
              OR heart_rate IS NULL
              OR respiratory_rate IS NULL
              OR oxygen_saturation IS NULL
          )::int AS value
        FROM vitals;
      `)
    ]);
    const [activeIntakes, doctorHandoffs, recentCompleted] = await Promise.all([
      listVisits({ status: "draft,in_progress,returned_for_correction" }),
      listVisits({ status: "awaiting_doctor_review,reviewed_by_doctor,returned_for_correction" }),
      listVisits({ status: "reviewed_by_doctor,completed" })
    ]);

    return {
      generatedAt: timestamp(),
      totals: {
        patients: patientTotal.rows[0].total,
        symptomRecords: symptomTotal.rows[0].total,
        vitals: vitalsTotal.rows[0].total,
        waitingPatients: waitingPatientsTotal.rows[0].total,
        vitalsRecordedToday: vitalsToday.rows[0].total,
        symptomNotesPending: symptomNotesPending.rows[0].total,
        urgentReviewCount: urgentReviewTotal.rows[0].total,
        activeIntakes: activeIntakes.length,
        doctorHandoffs: doctorHandoffs.length,
        recentlyCompleted: recentCompleted.length,
        needsVitals: needsVitals.rows.filter((patient) => !patient.last_vitals_at).length,
        readyForReview: readyForReview.rows.length
      },
      hourlyLoad: hourlyLoad.rows.length
        ? hourlyLoad.rows
        : [
            { label: "08:00", value: 0 },
            { label: "09:00", value: 0 },
            { label: "10:00", value: 0 },
            { label: "11:00", value: 0 },
            { label: "12:00", value: 0 },
            { label: "14:00", value: 0 },
            { label: "16:00", value: 0 },
            { label: "18:00", value: 0 }
          ],
      vitalsStatus: vitalsStatus.rows,
      needsVitals: needsVitals.rows.map((patient) => ({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        age: patient.age,
        reason: patient.last_vitals_at ? "Vitals exist, review if outdated" : "No vitals recorded yet",
        createdAt: patient.created_at
      })),
      readyForReview: readyForReview.rows.map((patient) => ({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        reason: "Symptom note captured",
        createdAt: patient.last_symptom_at
      })),
      activeIntakes: activeIntakes.slice(0, 5),
      doctorHandoffs: doctorHandoffs.slice(0, 5),
      recentCompleted: recentCompleted.slice(0, 5),
      recentCaptures: recentCaptures.rows.map((record) => ({
        id: record.id,
        patientId: record.patient_id,
        patientName:
          record.first_name && record.last_name
            ? `${record.first_name} ${record.last_name}`
            : "Unknown patient",
        symptoms: record.structured?.symptoms || [],
        severity: record.severity || record.structured?.severity || "",
        createdAt: record.created_at
      })),
      reminders: [
        "Confirm patient identity before recording vitals.",
        "Record vitals before symptom capture when possible.",
        "Escalate concerning observations to the doctor for review."
      ]
    };
  }

  const data = await readData();
  return buildFallbackNurseSummary(data);
}
