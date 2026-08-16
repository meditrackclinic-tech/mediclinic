import { Activity, BrainCircuit, Clock3, Gauge, Save, ShieldCheck, TextSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { apiRequest } from "../../../api.js";

const symptomTerms = [
  "chest pain",
  "cough",
  "fever",
  "headache",
  "shortness of breath",
  "dizziness",
  "fatigue",
  "nausea",
  "vomiting",
  "sore throat"
];

function buildNlpPreview(text) {
  const normalized = text.toLowerCase();
  const symptoms = symptomTerms.filter((term) => normalized.includes(term));
  const duration = normalized.match(/(\d+\s?(day|days|week|weeks|month|months|hour|hours))/)?.[0] || "";
  const severity =
    ["severe", "moderate", "mild"].find((level) => normalized.includes(level)) || "";

  return {
    symptoms: symptoms.length ? symptoms : ["waiting for symptom terms"],
    duration: duration || "not found yet",
    severity: severity || "not found yet",
    readiness: [symptoms.length > 0, Boolean(duration), Boolean(severity)].filter(Boolean).length
  };
}

export function SymptomCaptureForm({
  patients,
  selectedPatientId,
  onSelectPatient,
  onSaved,
  onError
}) {
  const [symptomText, setSymptomText] = useState("");
  const [savedPreview, setSavedPreview] = useState(null);
  const nlpPreview = useMemo(() => buildNlpPreview(symptomText), [symptomText]);
  const readinessPercent = Math.round((nlpPreview.readiness / 3) * 100);

  async function handleSubmitSymptom(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      onError("Select a patient before submitting symptoms.");
      return;
    }

    try {
      const data = await apiRequest("/symptoms", {
        method: "POST",
        body: JSON.stringify({
          patientId: selectedPatientId,
          description: symptomText
        })
      });
      setSavedPreview(data.symptomRecord.structured);
      setSymptomText("");
      onSaved();
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <section className="panel nurse-symptom-panel">
      <div className="nurse-capture-heading">
        <div>
          <span className="section-label">NLP assisted capture</span>
          <h3>
            <Activity size={18} />
            Capture Symptoms
          </h3>
        </div>
        <div className="nlp-readiness-ring" style={{ "--readiness": `${readinessPercent}%` }}>
          <strong>{readinessPercent}%</strong>
          <span>ready</span>
        </div>
      </div>
      <form onSubmit={handleSubmitSymptom} className="symptom-form nurse-symptom-form">
        <label>
          Patient
          <select value={selectedPatientId} onChange={(event) => onSelectPatient(event.target.value)}>
            <option value="">Select patient</option>
            {patients.map((patient) => (
              <option value={patient.id} key={patient.id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Patient-reported symptom note
          <textarea
            value={symptomText}
            onChange={(event) => setSymptomText(event.target.value)}
            placeholder="Example: I have severe chest pain and cough for 3 days."
            required
          />
        </label>
        <div className="symptom-writing-aids">
          <span>
            <TextSearch size={15} />
            Symptom terms
          </span>
          <span>
            <Clock3 size={15} />
            Duration
          </span>
          <span>
            <Gauge size={15} />
            Severity
          </span>
          <span>
            <ShieldCheck size={15} />
            No diagnosis
          </span>
        </div>
        <button type="submit">
          <Save size={18} />
          Save symptom record
        </button>
      </form>
      <div className="nlp-preview">
        <div className="nlp-preview-heading">
          <BrainCircuit size={18} />
          <div>
            <strong>NLP extraction preview</strong>
            <span>Runs on symptom text before the structured record is saved.</span>
          </div>
        </div>
        <div className="nlp-preview-grid">
          <div>
            <TextSearch size={16} />
            <span>Symptoms</span>
            <strong>{nlpPreview.symptoms.join(", ")}</strong>
          </div>
          <div>
            <Clock3 size={16} />
            <span>Duration</span>
            <strong>{nlpPreview.duration}</strong>
          </div>
          <div>
            <Gauge size={16} />
            <span>Severity</span>
            <strong>{nlpPreview.severity}</strong>
          </div>
        </div>
        {savedPreview ? (
          <p className="nlp-saved-note">
            Saved backend NLP output: {savedPreview.symptoms.join(", ")}; duration{" "}
            {savedPreview.duration || "not specified"}; severity{" "}
            {savedPreview.severity || "not specified"}.
          </p>
        ) : (
          <p className="nlp-saved-note">
            Final NLP output is stored with the raw symptom text after saving.
          </p>
        )}
      </div>
    </section>
  );
}
