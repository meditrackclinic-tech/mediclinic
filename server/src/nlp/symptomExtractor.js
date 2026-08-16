const symptomTerms = [
  "abdominal pain",
  "back pain",
  "chest pain",
  "cough",
  "diarrhea",
  "dizziness",
  "fever",
  "flu",
  "headache",
  "nausea",
  "shortness of breath",
  "sore throat",
  "stomach pain",
  "vomiting",
  "weakness"
];

const bodyParts = [
  "abdomen",
  "back",
  "chest",
  "ear",
  "eye",
  "head",
  "leg",
  "stomach",
  "throat"
];

const severityTerms = {
  mild: ["mild", "slight", "minor"],
  moderate: ["moderate", "medium"],
  severe: ["severe", "bad", "badly", "intense", "serious", "strong"]
};

const temporalTerms = [
  "had",
  "started",
  "continued",
  "improved",
  "worsened",
  "worse",
  "better",
  "recurring",
  "resolved",
  "since"
];

const durationPattern =
  /\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks|month|months|hour|hours)\b/i;
const relativeDurationPattern =
  /\bsince\s+(?:yesterday|today|last\s+night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:yesterday|today)\b/i;
const negationPattern = /\b(no|not|without|denies|denied|do not have|does not have)\b/i;
const historicalPattern = /\b(had|last week|last month|previously|before|history of)\b/i;
const improvingPattern = /\b(improving|improved|better|no longer severe|less severe|resolved)\b/i;
const worseningPattern = /\b(worse|worsened|worsening|deteriorating|getting worse)\b/i;
const stablePattern = /\b(same|unchanged|no change|stable)\b/i;
const frequencyPattern = /\b(once|twice|\d+\s+times?)(\s+(?:a|per)\s+(?:day|hour|week))?\b/i;
const medicationKeywords = [
  "tablet",
  "tablets",
  "dose",
  "dosage",
  "medication",
  "medicine",
  "medicines",
  "prescription",
  "refill",
  "side effect",
  "side effects"
];
const followUpKeywords = [
  "come back",
  "return in",
  "follow up in",
  "follow-up",
  "followup",
  "check-up",
  "checkup",
  "review in",
  "see the doctor again"
];

function hasTermNearPattern(text, term, pattern, windowSize = 34) {
  const index = text.indexOf(term);

  if (index === -1) {
    return false;
  }

  const before = text.slice(Math.max(0, index - windowSize), index + term.length);
  return pattern.test(before);
}

function classifySymptoms(text) {
  const present = [];
  const negated = [];
  const historical = [];
  const improving = [];
  const matchedTerms = symptomTerms
    .map((term) => ({ term, index: text.indexOf(term) }))
    .filter((match) => match.index !== -1)
    .sort((a, b) => a.index - b.index);

  for (const { term } of matchedTerms) {
    if (hasTermNearPattern(text, term, negationPattern)) {
      negated.push(term);
      continue;
    }

    if (hasTermNearPattern(text, term, historicalPattern)) {
      historical.push(term);
      continue;
    }

    if (hasTermNearPattern(text, term, improvingPattern)) {
      improving.push(term);
    }

    present.push(term);
  }

  return { present, negated, historical, improving };
}

function splitSentences(normalized) {
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function capitalize(sentence) {
  return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : sentence;
}

function findClauseWithKeywords(sentences, keywords) {
  const sentence = sentences.find((candidate) =>
    keywords.some((keyword) => candidate.includes(keyword))
  );
  return sentence ? capitalize(sentence.replace(/[.!?]+$/, "")) : null;
}

function findFrequency(normalized, presentSymptoms) {
  const globalFrequencyPattern = new RegExp(frequencyPattern.source, "gi");
  let match;

  while ((match = globalFrequencyPattern.exec(normalized)) !== null) {
    let nearestTerm = null;
    let nearestDistance = Infinity;

    for (const term of presentSymptoms) {
      const termIndex = normalized.indexOf(term);
      const distance = termIndex === -1 ? -1 : match.index - (termIndex + term.length);

      if (distance >= 0 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestTerm = term;
      }
    }

    if (nearestTerm && nearestDistance <= 24) {
      return `${nearestTerm} ${match[0]}`.trim();
    }
  }

  return null;
}

function detectProgression(normalized) {
  if (worseningPattern.test(normalized)) {
    return "worsening";
  }

  if (improvingPattern.test(normalized)) {
    return "improving";
  }

  if (stablePattern.test(normalized)) {
    return "stable";
  }

  return null;
}

function joinWithAnd(items) {
  if (items.length <= 1) {
    return items[0] || "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildClinicalSummary({ mainComplaint, severity, duration, symptomsPresent, symptomsAbsent, frequency }) {
  if (!mainComplaint) {
    return null;
  }

  const extras = symptomsPresent
    .filter((symptom) => symptom !== mainComplaint)
    .map((symptom) => (frequency && frequency.startsWith(symptom) ? frequency : symptom));

  const severityPart = severity ? `${severity} ` : "";
  const durationPart = duration ? ` ${duration}` : "";
  const extrasPart = extras.length ? ` with ${joinWithAnd(extras)}` : "";
  const absentPart = symptomsAbsent.length ? ` No ${joinWithAnd(symptomsAbsent)} reported.` : "";

  return capitalize(`patient reports ${severityPart}${mainComplaint}${durationPart}${extrasPart}.${absentPart}`)
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSymptoms(text) {
  const normalized = text.toLowerCase();
  const classified = classifySymptoms(normalized);
  const bodyPart = bodyParts.find((term) => normalized.includes(term)) || null;
  const durationMatch = normalized.match(durationPattern) || normalized.match(relativeDurationPattern);
  const severity =
    Object.entries(severityTerms).find(([, words]) =>
      words.some((word) => normalized.includes(word))
    )?.[0] || null;
  const temporalClues = temporalTerms.filter((term) => normalized.includes(term));
  const extractedSymptoms = classified.present.length ? classified.present : ["unspecified symptom"];
  const duration = durationMatch ? durationMatch[0].replace(/^for\s+/i, "") : null;
  const mainComplaint = classified.present[0] || null;
  const sentences = splitSentences(normalized);
  const frequency = findFrequency(normalized, classified.present);
  const progression = detectProgression(normalized);
  const medicationAction = findClauseWithKeywords(sentences, medicationKeywords);
  const followUpInstruction = findClauseWithKeywords(sentences, followUpKeywords);
  const clinicalSummary = buildClinicalSummary({
    mainComplaint,
    severity,
    duration,
    symptomsPresent: classified.present,
    symptomsAbsent: classified.negated,
    frequency
  });

  return {
    symptoms: extractedSymptoms,
    activeSymptoms: classified.present,
    negatedSymptoms: classified.negated,
    historicalSymptoms: classified.historical,
    improvingSymptoms: classified.improving,
    severity,
    duration,
    bodyPart,
    temporalClues,
    confidence: classified.present.length ? 0.82 : 0.35,
    mainComplaint,
    symptomsPresent: classified.present,
    symptomsAbsent: classified.negated,
    frequency,
    progression,
    medicationAction,
    followUpInstruction,
    clinicalSummary
  };
}

export function buildReviewPrompt(structured = {}, vitals = {}) {
  const symptoms = structured.activeSymptoms || structured.symptoms || [];
  const severity = String(structured.severity || "").toLowerCase();
  const reasons = [];
  const immediateReasons = [];

  const hasSymptom = (name) => symptoms.some((symptom) => symptom.includes(name));
  const oxygen = Number(vitals.oxygenSaturation);
  const respiratoryRate = Number(vitals.respiratoryRate);
  const heartRate = Number(vitals.heartRate);
  const temperature = Number(vitals.temperature);

  if (oxygen && oxygen < 90) {
    immediateReasons.push("Configured urgent review indicator: oxygen saturation below 90%.");
  } else if (oxygen && oxygen < 95) {
    reasons.push("Configured review-alert: oxygen saturation below usual intake range.");
  }

  if (respiratoryRate && respiratoryRate >= 30) {
    immediateReasons.push("Configured urgent review indicator: respiratory rate at or above 30.");
  } else if (respiratoryRate && respiratoryRate > 24) {
    reasons.push("Configured review-alert: raised respiratory rate.");
  }

  if (heartRate && heartRate > 110) {
    reasons.push("Configured review-alert: raised heart rate.");
  }

  if (temperature && temperature >= 38) {
    reasons.push("Configured review-alert: fever-range temperature recorded.");
  }

  if (severity === "severe") {
    reasons.push("Severe symptom wording detected in the patient statement.");
  }

  if (hasSymptom("chest pain")) {
    reasons.push("Chest pain detected in the patient statement.");
  }

  if (hasSymptom("shortness of breath")) {
    reasons.push("Shortness of breath detected in the patient statement.");
  }

  if (hasSymptom("chest pain") && hasSymptom("shortness of breath")) {
    immediateReasons.push("Configured urgent review indicator: chest pain with breathing difficulty.");
  }

  if (immediateReasons.length) {
    return {
      level: "immediate_escalation",
      label: "Immediate Escalation According to Protocol",
      reasons: [...immediateReasons, ...reasons]
    };
  }

  if (reasons.length) {
    return {
      level: "prompt_doctor_review",
      label: "Prompt Doctor Review",
      reasons
    };
  }

  return {
    level: "routine_review",
    label: "Routine Review",
    reasons: ["No configured review-alert criteria detected."]
  };
}
