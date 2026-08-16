import { describe, expect, it } from "vitest";
import { buildReviewPrompt, extractSymptoms } from "../src/nlp/symptomExtractor.js";

describe("extractSymptoms", () => {
  it("extracts symptom, duration, severity, and body part", () => {
    const result = extractSymptoms("I have severe chest pain and cough for 3 days.");

    expect(result.symptoms).toContain("chest pain");
    expect(result.symptoms).toContain("cough");
    expect(result.severity).toBe("severe");
    expect(result.duration).toBe("3 days");
    expect(result.bodyPart).toBe("chest");
  });

  it("returns an unspecified symptom for unknown input", () => {
    const result = extractSymptoms("I do not feel normal.");

    expect(result.symptoms).toEqual(["unspecified symptom"]);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("separates present and negated symptoms", () => {
    const result = extractSymptoms("I have cough but no fever for 2 days.");

    expect(result.symptoms).toContain("cough");
    expect(result.negatedSymptoms).toContain("fever");
    expect(result.duration).toBe("2 days");
  });

  it("builds non-diagnostic review prompts from symptoms and vitals", () => {
    const structured = extractSymptoms("Severe chest pain and shortness of breath since morning.");
    const prompt = buildReviewPrompt(structured, {
      heartRate: 118,
      respiratoryRate: 30,
      oxygenSaturation: 89
    });

    expect(prompt.level).toBe("immediate_escalation");
    expect(prompt.reasons.length).toBeGreaterThan(0);
  });

  it("extracts clinical fields from a voice-transcribed nurse summary (sample 1)", () => {
    const result = extractSymptoms(
      "Patient reports severe headache since yesterday, vomiting twice, diarrhea, and general weakness. No fever reported."
    );

    expect(result.mainComplaint).toBe("headache");
    expect(result.symptomsPresent).toEqual(expect.arrayContaining(["headache", "vomiting", "diarrhea", "weakness"]));
    expect(result.symptomsAbsent).toEqual(["fever"]);
    expect(result.severity).toBe("severe");
    expect(result.duration).toBe("since yesterday");
    expect(result.frequency).toBe("vomiting twice");
    expect(result.clinicalSummary).toContain("headache");
    expect(result.clinicalSummary).toContain("No fever reported.");
  });

  it("detects worsening progression for a recurring complaint (sample 2)", () => {
    const result = extractSymptoms(
      "Patient came back with stomach pain again. Same issue as last week. Today symptoms are worse and patient is vomiting."
    );

    expect(result.mainComplaint).toBe("stomach pain");
    expect(result.symptomsPresent).toEqual(expect.arrayContaining(["stomach pain", "vomiting"]));
    expect(result.progression).toBe("worsening");
  });

  it("keeps negated symptoms out of symptomsPresent and detects medication mentions (sample 3)", () => {
    const result = extractSymptoms(
      "Patient came for medication review. Complains of dizziness after taking tablets. No vomiting and no chest pain."
    );

    expect(result.mainComplaint).toBe("dizziness");
    expect(result.symptomsAbsent).toEqual(expect.arrayContaining(["vomiting", "chest pain"]));
    expect(result.symptomsPresent).not.toContain("vomiting");
    expect(result.symptomsPresent).not.toContain("chest pain");
    expect(result.medicationAction).toBeTruthy();
  });

  it("extracts duration and multiple present symptoms with no negation (sample 4)", () => {
    const result = extractSymptoms("Patient has cough and sore throat for three days. Fever started today.");

    expect(result.symptomsPresent).toEqual(expect.arrayContaining(["cough", "sore throat", "fever"]));
    expect(result.symptomsAbsent).toEqual([]);
    expect(result.duration).toBe("three days");
  });
});
