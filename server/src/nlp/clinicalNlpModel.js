import { extractSymptoms } from "./symptomExtractor.js";
import { env } from "../config/env.js";
import {
  enhanceWithHuggingFaceEntities,
  requestHuggingFaceEntities
} from "./huggingFaceAdapter.js";

export const CLINICAL_NLP_MODEL = Object.freeze({
  name: "khomas-symptom-structurer",
  version: "1.3.0",
  type: "deterministic-clinical-information-extraction",
  purpose: "symptom record organisation",
  diagnostic: false,
  provider: "local-rule-based-baseline",
  capabilities: ["symptoms", "negation", "severity", "duration", "temporal-context"]
});

export const HUGGING_FACE_NLP_MODEL = Object.freeze({
  name: "d4data/biomedical-ner-all",
  revision: "015a4050c9ac99722e61c547aa9b4282bcbedc7f",
  version: "1.0.0-hybrid",
  type: "hybrid-clinical-information-extraction",
  purpose: "symptom record organisation",
  diagnostic: false,
  provider: "local-hugging-face-with-rule-fallback",
  capabilities: [
    "biomedical-entities",
    "symptoms",
    "negation",
    "severity",
    "duration",
    "temporal-context"
  ]
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

function finaliseResult(extracted, model, runtime = null) {
  const reviewFields = determineReviewFields(extracted);

  return {
    ...extracted,
    model,
    ...(runtime ? { nlpRuntime: runtime } : {}),
    reviewRequired: reviewFields.length > 0 || extracted.confidence < 0.75,
    reviewFields
  };
}

/**
 * Stable application boundary for the NLP component.
 * The output organises patient-reported text; it never diagnoses or recommends treatment.
 */
export function analyzeSymptomText(text) {
  const rawText = normaliseInput(text);
  const extracted = rawText ? extractSymptoms(rawText) : { ...EMPTY_NLP_RESULT };
  return finaliseResult(extracted, CLINICAL_NLP_MODEL);
}

/**
 * Runtime NLP path used by API controllers. In hybrid mode, patient text is sent only
 * to the configured localhost service. A service failure never blocks clinical intake.
 */
export async function analyzeSymptomTextWithProvider(text, options = {}) {
  const rawText = normaliseInput(text);
  const baseline = analyzeSymptomText(rawText);
  const provider = options.provider || env.nlp.provider;

  if (provider !== "hybrid" || !rawText) {
    return baseline;
  }

  try {
    const entities = await requestHuggingFaceEntities(rawText, {
      baseUrl: options.baseUrl || env.nlp.huggingFaceUrl,
      timeoutMs: options.timeoutMs || env.nlp.timeoutMs,
      fetchImpl: options.fetchImpl
    });
    const enhanced = enhanceWithHuggingFaceEntities(rawText, baseline, entities, {
      minimumScore: options.minimumScore ?? env.nlp.minimumScore
    });

    return finaliseResult(enhanced, HUGGING_FACE_NLP_MODEL, {
      requestedProvider: "hybrid",
      usedProvider: "local-hugging-face-with-rule-context",
      fallback: false
    });
  } catch {
    return finaliseResult(baseline, CLINICAL_NLP_MODEL, {
      requestedProvider: "hybrid",
      usedProvider: "local-rule-based-baseline",
      fallback: true,
      fallbackReason: "Local Hugging Face service unavailable"
    });
  }
}
