import { describe, expect, it } from "vitest";
import { analyzeSymptomText, CLINICAL_NLP_MODEL } from "../src/nlp/clinicalNlpModel.js";

describe("clinical NLP model boundary", () => {
  it("returns versioned, non-diagnostic structured output", () => {
    const result = analyzeSymptomText("Severe headache since yesterday but no fever.");

    expect(result.mainComplaint).toBe("headache");
    expect(result.symptomsAbsent).toContain("fever");
    expect(result.model).toEqual(CLINICAL_NLP_MODEL);
    expect(result.model.diagnostic).toBe(false);
    expect(result.reviewFields).toEqual([]);
  });

  it("normalises common patient wording to canonical symptom concepts", () => {
    const result = analyzeSymptomText("Moderate tummy ache and diarrhoea for two days.");

    expect(result.symptomsPresent).toEqual(expect.arrayContaining(["stomach pain", "diarrhea"]));
    expect(result.duration).toBe("two days");
    expect(result.severity).toBe("moderate");
  });

  it("marks incomplete or unknown text for human review", () => {
    const result = analyzeSymptomText("Does not feel normal");

    expect(result.reviewRequired).toBe(true);
    expect(result.reviewFields).toContain("mainComplaint");
  });

  it.each([
    "I am coughing but not to severe",
    "I am coughing but not too severe",
    "The cough is not severe",
    "The cough isn't very bad"
  ])("understands softened severity in spoken context: %s", (text) => {
    const result = analyzeSymptomText(text);

    expect(result.mainComplaint).toBe("cough");
    expect(result.severity).toBe("mild");
    expect(result.severityContext).toBe("softened_or_negated_severity");
    expect(result.severityEvidence).toBeTruthy();
  });

  it("prefers an explicit severity over a separately negated severity", () => {
    const result = analyzeSymptomText("The cough is moderate, not severe.");

    expect(result.severity).toBe("moderate");
    expect(result.severityContext).toBe("explicit");
  });

  it.each([
    ["I have a little cough", "mild"],
    ["The headache is slightly painful", "mild"],
    ["The headache is moderate", "moderate"],
    ["The headache is somewhat painful", "moderate"],
    ["The headache is very painful", "severe"],
    ["The headache is unbearable", "severe"]
  ])("understands natural severity wording: %s", (text, expectedSeverity) => {
    expect(analyzeSymptomText(text).severity).toBe(expectedSeverity);
  });

  it("does not invent severity when the patient gives none", () => {
    expect(analyzeSymptomText("I have been coughing for two days").severity).toBeNull();
  });

  it("does not let negation cross a contrasting clause", () => {
    const result = analyzeSymptomText("No fever, but I am coughing today.");

    expect(result.symptomsAbsent).toContain("fever");
    expect(result.symptomsPresent).toContain("cough");
  });
});
