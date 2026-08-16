import { CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";

const visitTypeOptions = [
  "New complaint",
  "Follow-up visit",
  "Recurring complaint",
  "Worsening complaint",
  "Medication review",
  "General consultation"
];

export function VisitClinicalSummaryPanel({
  preview,
  form,
  showCorrections,
  onToggleCorrections,
  onUpdateCorrection,
  onUpdateField,
  onAcceptPreview
}) {
  const corrections = form.nurseCorrections;
  const displayedVisitType = corrections.visitType || preview.visitType || "Not classified yet";

  return (
    <aside className="intake-intelligence-panel">
      {form.originalTranscript ? (
        <div className="intelligence-card">
          <div className="form-section-title">
            <Sparkles size={18} />
            <strong>Original Transcribed Text</strong>
          </div>
          <p className="muted">{form.originalTranscript}</p>
        </div>
      ) : null}

      <div className="intelligence-card">
        <div className="form-section-title">
          <Sparkles size={18} />
          <strong>System-Organised Symptom Summary</strong>
        </div>
        <div className="extraction-grid">
          <span>Main complaint</span>
          <strong>{preview.mainComplaint || "Not detected yet"}</strong>
          <span>Symptoms present</span>
          <strong>{preview.symptoms.length ? preview.symptoms.join(", ") : "Not detected yet"}</strong>
          <span>Symptoms absent</span>
          <strong>{preview.negatedSymptoms.length ? preview.negatedSymptoms.join(", ") : "None detected"}</strong>
          <span>Duration</span>
          <strong>{preview.duration || "Not detected yet"}</strong>
          <span>Severity</span>
          <strong>{preview.severity || "Not detected yet"}</strong>
          <span>Frequency</span>
          <strong>{preview.frequency || "Not detected"}</strong>
          <span>Progression</span>
          <strong>{preview.progression || "Not detected"}</strong>
          <span>Medication / action</span>
          <strong>{preview.medicationAction || "Not detected"}</strong>
          <span>Follow-up instruction</span>
          <strong>{preview.followUpInstruction || "Not detected"}</strong>
          <span>Visit type</span>
          <strong>{displayedVisitType}</strong>
          <span>Clinical summary</span>
          <strong>{preview.clinicalSummary || "Not detected yet"}</strong>
        </div>
      </div>

      <div className="intelligence-card">
        <div className="form-section-title">
          <CheckCircle2 size={18} />
          <strong>Confirm Summary</strong>
        </div>
        <p className="nurse-confirmation-help">
          Use the summary if it matches the patient complaint. Open corrections only when the system is wrong.
        </p>
        <div className="nlp-confirm-actions">
          <button className="secondary action-small accept-preview-button" onClick={onAcceptPreview} type="button">
            <CheckCircle2 size={16} />
            Use Summary
          </button>
          <button className="secondary action-small" onClick={onToggleCorrections} type="button">
            Correct Summary
          </button>
        </div>
        {showCorrections ? (
          <div className="nlp-correction-fields">
            <label>
              Main complaint
              <input
                value={corrections.mainComplaint}
                onChange={(event) => onUpdateCorrection("mainComplaint", event.target.value)}
                placeholder={preview.mainComplaint || "Example: headache"}
              />
            </label>
            <label>
              Symptoms present
              <input
                value={corrections.symptoms}
                onChange={(event) => onUpdateCorrection("symptoms", event.target.value)}
                placeholder={preview.symptoms.length ? preview.symptoms.join(", ") : "Example: cough, chest pain"}
              />
            </label>
            <label>
              Symptoms absent
              <input
                value={corrections.symptomsAbsent}
                onChange={(event) => onUpdateCorrection("symptomsAbsent", event.target.value)}
                placeholder={preview.negatedSymptoms.length ? preview.negatedSymptoms.join(", ") : "Example: fever"}
              />
            </label>
            <label>
              Duration
              <input
                value={corrections.duration}
                onChange={(event) => onUpdateCorrection("duration", event.target.value)}
                placeholder={preview.duration || "Example: 3 days"}
              />
            </label>
            <label>
              Severity
              <input
                value={corrections.severity}
                onChange={(event) => onUpdateCorrection("severity", event.target.value)}
                placeholder={preview.severity || "Example: mild, moderate, severe"}
              />
            </label>
            <label>
              Frequency
              <input
                value={corrections.frequency}
                onChange={(event) => onUpdateCorrection("frequency", event.target.value)}
                placeholder={preview.frequency || "Example: vomiting twice"}
              />
            </label>
            <label>
              Progression
              <input
                value={corrections.progression}
                onChange={(event) => onUpdateCorrection("progression", event.target.value)}
                placeholder={preview.progression || "Example: worsening, improving, stable"}
              />
            </label>
            <label>
              Medication / action
              <input
                value={corrections.medicationAction}
                onChange={(event) => onUpdateCorrection("medicationAction", event.target.value)}
                placeholder={preview.medicationAction || "Example: started on tablets"}
              />
            </label>
            <label>
              Follow-up instruction
              <input
                value={corrections.followUpInstruction}
                onChange={(event) => onUpdateCorrection("followUpInstruction", event.target.value)}
                placeholder={preview.followUpInstruction || "Example: return in 3 days"}
              />
            </label>
            <label>
              Visit type
              <select
                value={corrections.visitType}
                onChange={(event) => onUpdateCorrection("visitType", event.target.value)}
              >
                <option value="">{preview.visitType || "System-classified"}</option>
                {visitTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="nlp-text-entry">
              Clinical summary
              <textarea
                value={corrections.clinicalSummary}
                onChange={(event) => onUpdateCorrection("clinicalSummary", event.target.value)}
                placeholder={preview.clinicalSummary || "Example: Patient reports severe headache since yesterday..."}
              />
            </label>
          </div>
        ) : null}
        <label className="confirmation-check">
          <input
            checked={form.nlpConfirmed}
            onChange={(event) => onUpdateField("nlpConfirmed", event.target.checked)}
            type="checkbox"
          />
          Confirm reviewed summary
        </label>
        <p className="notice non-diagnostic-notice">
          <ShieldAlert size={16} />
          This tool documents and organises what is reported. It does not diagnose and does not replace clinical
          judgment.
        </p>
      </div>
    </aside>
  );
}
