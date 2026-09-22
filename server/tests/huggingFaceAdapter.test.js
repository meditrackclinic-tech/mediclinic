import { describe, expect, it, vi } from "vitest";
import {
  analyzeSymptomText,
  analyzeSymptomTextWithProvider,
  HUGGING_FACE_NLP_MODEL
} from "../src/nlp/clinicalNlpModel.js";
import { enhanceWithHuggingFaceEntities } from "../src/nlp/huggingFaceAdapter.js";

function entity(text, phrase, label, score = 0.94) {
  const start = text.toLowerCase().indexOf(phrase.toLowerCase());
  return { label, text: phrase, score, start, end: start + phrase.length };
}

describe("Hugging Face clinical NLP adapter", () => {
  it("adds symptom concepts that are outside the rule vocabulary", () => {
    const text = "Persistent palpitations for two days.";
    const baseline = analyzeSymptomText(text);
    const enhanced = enhanceWithHuggingFaceEntities(
      text,
      baseline,
      [entity(text, "palpitations", "Sign_symptom")]
    );

    expect(enhanced.mainComplaint).toBe("palpitations");
    expect(enhanced.symptomsPresent).toContain("palpitations");
    expect(enhanced.duration).toBe("two days");
    expect(enhanced.clinicalSummary).toContain("palpitations");
  });

  it("keeps negation inside its own clause", () => {
    const text = "No palpitations, but persistent tiredness today.";
    const baseline = analyzeSymptomText(text);
    const enhanced = enhanceWithHuggingFaceEntities(text, baseline, [
      entity(text, "palpitations", "Sign_symptom"),
      entity(text, "tiredness", "Sign_symptom")
    ]);

    expect(enhanced.symptomsAbsent).toContain("palpitations");
    expect(enhanced.symptomsPresent).toContain("tiredness");
    expect(enhanced.mainComplaint).toBe("tiredness");
  });

  it("ignores model entities below the configured confidence threshold", () => {
    const text = "I feel shaky.";
    const baseline = analyzeSymptomText(text);
    const enhanced = enhanceWithHuggingFaceEntities(
      text,
      baseline,
      [entity(text, "shaky", "Sign_symptom", 0.42)],
      { minimumScore: 0.65 }
    );

    expect(enhanced.symptomsPresent).toEqual([]);
    expect(enhanced.huggingFaceEntities).toEqual([]);
  });

  it("rejects partial WordPiece spans before they become record symptoms", () => {
    const text = "No palpitations today.";
    const baseline = analyzeSymptomText(text);
    const enhanced = enhanceWithHuggingFaceEntities(text, baseline, [
      { label: "Sign_symptom", text: "pal", score: 0.91, start: 3, end: 6 }
    ]);

    expect(enhanced.symptomsAbsent).not.toContain("pal");
    expect(enhanced.huggingFaceEntities).toEqual([]);
  });

  it("uses the hybrid model metadata when the local service succeeds", async () => {
    const text = "Persistent palpitations today.";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entities: [entity(text, "palpitations", "Sign_symptom")] })
    });
    const result = await analyzeSymptomTextWithProvider(text, {
      provider: "hybrid",
      baseUrl: "http://127.0.0.1:8001",
      fetchImpl
    });

    expect(result.mainComplaint).toBe("palpitations");
    expect(result.model).toEqual(HUGGING_FACE_NLP_MODEL);
    expect(result.nlpRuntime.fallback).toBe(false);
  });

  it("falls back without blocking intake when the local service is offline", async () => {
    const result = await analyzeSymptomTextWithProvider("Mild cough today.", {
      provider: "hybrid",
      fetchImpl: vi.fn().mockRejectedValue(new Error("offline"))
    });

    expect(result.mainComplaint).toBe("cough");
    expect(result.nlpRuntime.fallback).toBe(true);
    expect(result.nlpRuntime.usedProvider).toBe("local-rule-based-baseline");
  });
});
