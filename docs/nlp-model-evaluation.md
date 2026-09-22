# NLP Model Selection and Evaluation Plan

## Research objective

The NLP component organises a patient's own complaint into record fields. It does not diagnose, prescribe, or replace clinical judgement. The research question is whether a clinical named-entity model improves the completeness and accuracy of symptom records compared with the existing deterministic extractor, while keeping the nurse in control of every saved field.

## Compared approaches

| Approach | Role in the study | Strengths | Known limitations |
| --- | --- | --- | --- |
| MediTrack rule baseline (`khomas-symptom-structurer` 1.3.0) | Control/baseline | Fast, explainable, works offline, explicitly handles negation and conversational severity | Limited fixed vocabulary; rules require manual expansion |
| [`d4data/biomedical-ner-all`](https://huggingface.co/d4data/biomedical-ner-all) at revision `015a4050c9ac99722e61c547aa9b4282bcbedc7f` | Hugging Face candidate | Apache-2.0; DistilBERT; recognises sign/symptom, severity, duration, frequency, and other biomedical entities; standard Transformers pipeline | Trained on English case reports rather than Namibian clinic speech; model card provides no formal task metrics or bias analysis; does not itself solve negation |
| [`BSC-NLP4BIA/DT4H_XLM-R_mtl_en-nl-sv_symptom`](https://huggingface.co/BSC-NLP4BIA/DT4H_XLM-R_mtl_en-nl-sv_symptom) | Documented alternative | Symptom-specific, manually annotated clinical corpora, English strict F1 0.6094 and character F1 0.7445 | Custom PyTorch architecture, no standard `AutoModelForTokenClassification` loading, no formal bias/fairness evaluation, and no support for local Namibian languages |

The first Hugging Face candidate was selected for the prototype because it can be loaded with the standard Transformers token-classification pipeline, its licence permits local research use, and its entity set matches the fields already shown in the assessment. The second model remains a useful future benchmark but has higher integration complexity.

Hugging Face and LangChain are not two equivalent models. Hugging Face supplies models and inference tooling; LangChain is an optional orchestration framework. The current workflow is a small, auditable extraction pipeline, so LangChain would add an extra dependency without improving extraction quality. It should only be reconsidered if the project later needs a multi-step questionnaire or several model/tool calls.

## Implemented hybrid design

The selected Hugging Face model runs in a localhost-only Python service. The Express backend sends complaint text to `127.0.0.1`, applies a configurable confidence threshold, and combines accepted entities with the rule baseline. The rules remain responsible for clause-aware negation and conversational severity. If the model is offline or times out, the request continues with the tested baseline and records that a fallback occurred.

This is pretrained-model integration, not a claim of retraining. Fine-tuning should begin only after an ethically approved, de-identified, locally representative labelled dataset has been collected and split into training, validation, and held-out test sets.

## Quantitative evaluation

Use a de-identified reference set containing typed complaints and transcribed spoken complaints. Two clinical reviewers should independently label the expected entities and resolve disagreements before the test set is scored.

Measure both approaches on exactly the same held-out records:

1. Symptom entity precision, recall, and F1 using exact span match and relaxed concept match.
2. Accuracy for negation, severity, duration, frequency, and progression.
3. Main-complaint accuracy.
4. Field completeness: proportion of applicable reference fields correctly populated.
5. False-positive rate, especially for symptoms that the patient denied or described historically.
6. Nurse correction count per record and time from intake start to confirmed summary.
7. For voice input, word error rate of the transcript and downstream entity F1 compared with typed input.
8. Model latency and fallback rate.

Report confidence intervals and results by input method. With participant consent and sufficient sample size, also inspect performance by age group, language/accent group, and sex to look for systematic differences. Do not report small subgroups in a way that could identify patients.

## Audio and transcript policy before implementation

The current system stores text transcripts, not raw audio. Raw audio retention should only be enabled after the study has defined explicit consent, purpose, access roles, encryption, a retention/deletion period, and ethics approval. Audio must use private object storage rather than public application files. The record should keep separate timestamps for capture, transcription, nurse correction, and final confirmation so the research can compare the original transcript with the confirmed clinical record.

## Questionnaire scope

A wound/no-wound questionnaire can be added as a separate structured intake flow. A generative model such as DeepSeek should not create or interpret clinical questions without an approved questionnaire, clinician review, documented prompt/version, and evaluation. The immediate research priority remains patient complaint transcription and record organisation.
