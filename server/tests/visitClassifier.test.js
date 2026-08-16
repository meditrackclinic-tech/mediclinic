import { describe, expect, it } from "vitest";
import { extractSymptoms } from "../src/nlp/symptomExtractor.js";
import { buildHistoryAlerts, classifyVisit } from "../src/nlp/visitClassifier.js";

describe("classifyVisit", () => {
  it("classifies a first-time complaint as a new complaint (sample 4)", () => {
    const structured = extractSymptoms("Patient has cough and sore throat for three days. Fever started today.");

    expect(classifyVisit(structured, "Patient has cough and sore throat for three days. Fever started today.", [])).toBe(
      "New complaint"
    );
  });

  it("classifies a medication-review statement as a medication review (sample 3)", () => {
    const text = "Patient came for medication review. Complains of dizziness after taking tablets. No vomiting and no chest pain.";
    const structured = extractSymptoms(text);

    expect(classifyVisit(structured, text, [])).toBe("Medication review");
  });

  it("classifies an explicit follow-up mention as a follow-up visit", () => {
    const text = "Patient came back for a follow-up on blood pressure.";
    const structured = extractSymptoms(text);

    expect(classifyVisit(structured, text, [])).toBe("Follow-up visit");
  });

  it("classifies a worsening complaint when progression is worsening and history matches (sample 2)", () => {
    const text = "Patient came back with stomach pain again. Same issue as last week. Today symptoms are worse and patient is vomiting.";
    const structured = extractSymptoms(text);
    const previousTimelineEntries = [{ mainComplaint: "stomach pain", severity: "mild" }];

    expect(classifyVisit(structured, text, previousTimelineEntries)).toBe("Worsening complaint");
  });

  it("classifies a matching same-severity complaint as recurring", () => {
    const text = "Patient reports mild headache again.";
    const structured = extractSymptoms(text);
    const previousTimelineEntries = [{ mainComplaint: "headache", severity: "mild" }];

    expect(classifyVisit(structured, text, previousTimelineEntries)).toBe("Recurring complaint");
  });

  it("classifies statements with no identifiable complaint as a general consultation", () => {
    const structured = extractSymptoms("Patient came in to talk to the nurse.");

    expect(classifyVisit(structured, "Patient came in to talk to the nurse.", [])).toBe("General consultation");
  });
});

describe("buildHistoryAlerts", () => {
  it("returns no alerts when there is no matching prior visit", () => {
    const structured = extractSymptoms("Patient has cough and sore throat for three days.");

    expect(buildHistoryAlerts(structured, [])).toEqual([]);
  });

  it("flags a similar complaint and a worsening complaint when severity increased", () => {
    const text = "Patient came back with stomach pain again. Today symptoms are worse and patient is vomiting.";
    const structured = extractSymptoms(text);
    const previousTimelineEntries = [{ mainComplaint: "stomach pain", severity: "mild" }];

    const alerts = buildHistoryAlerts(structured, previousTimelineEntries);

    expect(alerts).toContain("Similar complaint recorded in a previous visit.");
    expect(alerts).toContain("Complaint appears to be worsening compared to previous visit.");
  });
});
