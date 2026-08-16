const medicationReviewPattern = /\bmedication review\b/i;
const followUpVisitPattern = /\b(follow[- ]?up|check[- ]?up|came (for|in) (a )?review|for review)\b/i;

const severityRank = {
  mild: 1,
  moderate: 2,
  severe: 3
};

function rankOf(severity) {
  return severityRank[String(severity || "").toLowerCase()] || 0;
}

function findMatchingPriorEntry(mainComplaint, previousTimelineEntries = []) {
  if (!mainComplaint) {
    return null;
  }

  const matches = previousTimelineEntries.filter(
    (entry) => (entry.mainComplaint || "").toLowerCase() === mainComplaint.toLowerCase()
  );

  return matches.length ? matches[matches.length - 1] : null;
}

export function classifyVisit(structured = {}, symptomStatement = "", previousTimelineEntries = []) {
  const text = String(symptomStatement || "").toLowerCase();

  if (medicationReviewPattern.test(text) || (structured.medicationAction && !structured.mainComplaint)) {
    return "Medication review";
  }

  if (followUpVisitPattern.test(text)) {
    return "Follow-up visit";
  }

  const priorEntry = findMatchingPriorEntry(structured.mainComplaint, previousTimelineEntries);

  if (!priorEntry) {
    return structured.mainComplaint ? "New complaint" : "General consultation";
  }

  const isWorsening = structured.progression === "worsening" || rankOf(structured.severity) > rankOf(priorEntry.severity);

  return isWorsening ? "Worsening complaint" : "Recurring complaint";
}

export function buildHistoryAlerts(structured = {}, previousTimelineEntries = []) {
  const alerts = [];
  const priorEntry = findMatchingPriorEntry(structured.mainComplaint, previousTimelineEntries);

  if (!priorEntry) {
    return alerts;
  }

  alerts.push("Similar complaint recorded in a previous visit.");

  const isWorsening = structured.progression === "worsening" || rankOf(structured.severity) > rankOf(priorEntry.severity);

  if (isWorsening) {
    alerts.push("Complaint appears to be worsening compared to previous visit.");
  }

  return alerts;
}
