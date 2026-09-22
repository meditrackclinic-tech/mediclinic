import { buildClinicalSummary } from "./symptomExtractor.js";

const symptomLabels = new Set(["sign_symptom"]);
const negationPattern = /\b(no|not|without|denies|denied|do not have|does not have|never had)\b/i;
const historicalPattern = /\b(had|previously|before|history of|last week|last month)\b/i;
const improvingPattern = /\b(improving|improved|better|less severe|resolved)\b/i;

function normalizedLabel(entity = {}) {
  return String(entity.label || entity.entity_group || entity.entity || "")
    .replace(/^[BI]-/i, "")
    .trim()
    .toLowerCase();
}

function entityText(sourceText, entity = {}) {
  const start = Number(entity.start);
  const end = Number(entity.end);
  const fromOffsets = Number.isInteger(start) && Number.isInteger(end)
    ? sourceText.slice(start, end)
    : "";

  return String(fromOffsets || entity.text || entity.word || "")
    .replace(/\s*##/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clauseBefore(sourceText, entity = {}, windowSize = 64) {
  const start = Number.isInteger(Number(entity.start))
    ? Number(entity.start)
    : sourceText.toLowerCase().indexOf(entityText(sourceText, entity));
  const prefix = sourceText.slice(0, Math.max(start, 0)).toLowerCase();
  const boundaryPattern = /(?:[.!?;,]|\bbut\b|\bhowever\b|\byet\b)/gi;
  let boundary = -1;
  let match;

  while ((match = boundaryPattern.exec(prefix)) !== null) {
    boundary = match.index + match[0].length;
  }

  return prefix.slice(Math.max(boundary, prefix.length - windowSize, 0));
}

function appendUnique(items, value) {
  if (value && !items.includes(value)) {
    items.push(value);
  }
}

function removeValue(items, value) {
  return items.filter((item) => item !== value);
}

function mappedSeverity(text) {
  if (/\b(severe|very painful|unbearable|intense)\b/i.test(text)) return "severe";
  if (/\b(moderate|medium|somewhat painful)\b/i.test(text)) return "moderate";
  if (/\b(mild|slight|minor|a little|slightly painful)\b/i.test(text)) return "mild";
  return null;
}

function publicEntity(sourceText, entity) {
  return {
    label: normalizedLabel(entity),
    text: entityText(sourceText, entity),
    score: Number(Number(entity.score || 0).toFixed(4)),
    start: Number.isInteger(Number(entity.start)) ? Number(entity.start) : null,
    end: Number.isInteger(Number(entity.end)) ? Number(entity.end) : null
  };
}

function coversWholeTokens(sourceText, entity) {
  if (!Number.isInteger(entity.start) || !Number.isInteger(entity.end)) return true;

  const precedingCharacter = sourceText[entity.start - 1] || "";
  const followingCharacter = sourceText[entity.end] || "";
  return !/[a-z0-9]/i.test(precedingCharacter) && !/[a-z0-9]/i.test(followingCharacter);
}

export function enhanceWithHuggingFaceEntities(
  sourceText,
  baseline,
  entities,
  { minimumScore = 0.65 } = {}
) {
  const acceptedEntities = (Array.isArray(entities) ? entities : [])
    .filter((entity) => Number(entity.score || 0) >= minimumScore)
    .map((entity) => publicEntity(sourceText, entity))
    .filter((entity) => entity.label && entity.text && coversWholeTokens(sourceText, entity));
  let symptomsPresent = [...(baseline.symptomsPresent || [])];
  let symptomsAbsent = [...(baseline.symptomsAbsent || [])];
  let historicalSymptoms = [...(baseline.historicalSymptoms || [])];
  let improvingSymptoms = [...(baseline.improvingSymptoms || [])];
  let severity = baseline.severity;
  let severityEvidence = baseline.severityEvidence;
  let severityContext = baseline.severityContext;
  let duration = baseline.duration;
  let frequency = baseline.frequency;

  for (const entity of acceptedEntities) {
    if (symptomLabels.has(entity.label)) {
      const before = clauseBefore(sourceText, entity);

      if (negationPattern.test(before)) {
        appendUnique(symptomsAbsent, entity.text);
        symptomsPresent = removeValue(symptomsPresent, entity.text);
      } else if (historicalPattern.test(before)) {
        appendUnique(historicalSymptoms, entity.text);
        symptomsPresent = removeValue(symptomsPresent, entity.text);
      } else {
        appendUnique(symptomsPresent, entity.text);
        if (improvingPattern.test(before)) appendUnique(improvingSymptoms, entity.text);
      }
    }

    if (!severity && entity.label === "severity") {
      const mapped = mappedSeverity(entity.text);
      if (mapped) {
        severity = mapped;
        severityEvidence = entity.text;
        severityContext = "hugging_face_entity";
      }
    }

    if (!duration && entity.label === "duration") duration = entity.text;
    if (!frequency && entity.label === "frequency") frequency = entity.text;
  }

  const mainComplaint = baseline.mainComplaint || symptomsPresent[0] || null;
  const symptoms = symptomsPresent.length ? symptomsPresent : baseline.symptoms;
  const symptomScores = acceptedEntities
    .filter((entity) => symptomLabels.has(entity.label))
    .map((entity) => entity.score);
  const confidence = symptomScores.length
    ? Math.max(baseline.confidence, Math.max(...symptomScores))
    : baseline.confidence;

  return {
    ...baseline,
    symptoms,
    activeSymptoms: symptomsPresent,
    negatedSymptoms: symptomsAbsent,
    historicalSymptoms,
    improvingSymptoms,
    mainComplaint,
    symptomsPresent,
    symptomsAbsent,
    severity,
    severityEvidence,
    severityContext,
    duration,
    frequency,
    confidence,
    clinicalSummary: buildClinicalSummary({
      mainComplaint,
      severity,
      duration,
      symptomsPresent,
      symptomsAbsent,
      frequency
    }),
    huggingFaceEntities: acceptedEntities
  };
}

export async function requestHuggingFaceEntities(
  text,
  { baseUrl, timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}
) {
  if (!baseUrl) throw new Error("Hugging Face NLP service URL is not configured.");
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable in this Node runtime.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Hugging Face NLP service returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.entities)) {
      throw new Error("Hugging Face NLP service returned an invalid response.");
    }

    return payload.entities;
  } finally {
    clearTimeout(timeout);
  }
}
