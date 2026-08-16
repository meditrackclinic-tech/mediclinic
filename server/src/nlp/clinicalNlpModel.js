import { extractSymptoms } from "./symptomExtractor.js";

export const CLINICAL_NLP_MODEL = Object.freeze({
  name: "khomas-symptom-structurer",
  version: "1.2.0",
  type: "deterministic-clinical-information-extraction",
  purpose: "symptom record organisation",
  diagnostic: false
});

export const EMPTY_NLP_RESULT = Object.freeze({
  symptoms: ["unspecified symptom"],
  activeSymptoms: [],
  negatedSymptoms: [],
  historicalSymptoms: [],
  improvingSymptoms: [],
  severity: null,
  severityEvidence: null,
  severityContext: null,
  duration: null,
  bodyPart: null,
  temporalClues: [],
  confidence: 0.2,
  mainComplaint: null,
  symptomsPresent: [],
  symptomsAbsent: [],
  frequency: null,
  progression: null,
  medicationAction: null,
  followUpInstruction: null,
  clinicalSummary: null
});

function normaliseInput(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function determineReviewFields(result) {
  const fields = [];

  if (!result.mainComplaint) fields.push("mainComplaint");
  if (!result.duration) fields.push("duration");
  if (!result.severity) fields.push("severity");

  return fields;
}

/**
 * Stable application boundary for the NLP component.
 * The output organises patient-reported text; it never diagnoses or recommends treatment.
 */
export function analyzeSymptomText(text) {
  const rawText = normaliseInput(text);
  const extracted = rawText ? extractSymptoms(rawText) : { ...EMPTY_NLP_RESULT };
  const reviewFields = determineReviewFields(extracted);

  return {
    ...extracted,
    model: CLINICAL_NLP_MODEL,
    reviewRequired: reviewFields.length > 0 || extracted.confidence < 0.75,
    reviewFields
  };
}
