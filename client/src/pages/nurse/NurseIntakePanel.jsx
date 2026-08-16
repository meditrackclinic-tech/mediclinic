import {
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Pill,
  Search,
  Send,
  Stethoscope,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { VoiceRecorder } from "../../shared/voice/VoiceRecorder.jsx";
import { VisitClinicalSummaryPanel } from "./VisitClinicalSummaryPanel.jsx";

function createBlankPrescription() {
  return {
    medications: []
  };
}

const blankNurseCorrections = {
  symptoms: "",
  severity: "",
  duration: "",
  negatedSymptoms: "",
  mainComplaint: "",
  symptomsAbsent: "",
  frequency: "",
  progression: "",
  medicationAction: "",
  followUpInstruction: "",
  clinicalSummary: "",
  visitType: ""
};

const blankForm = {
  temperature: "",
  systolic: "",
  diastolic: "",
  heartRate: "",
  respiratoryRate: "",
  oxygenSaturation: "",
  notes: "",
  symptomStatement: "",
  assessmentOutcome: "",
  treatmentNotes: "",
  prescription: createBlankPrescription(),
  nlpConfirmed: false,
  inputMethod: "text",
  originalTranscript: "",
  nurseCorrections: { ...blankNurseCorrections }
};

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
  "sore throat",
  "diarrhea",
  "weakness"
];

const medicineCatalogue = [
  {
    id: "paracetamol-500",
    medicationName: "Paracetamol 500 mg",
    quantity: "10 tablets",
    instructions: "1 tablet up to 3 times daily"
  },
  {
    id: "ors",
    medicationName: "Oral rehydration salts",
    quantity: "3 sachets",
    instructions: "1 sachet mixed with clean water as directed"
  },
  {
    id: "cetirizine-10",
    medicationName: "Cetirizine 10 mg",
    quantity: "5 tablets",
    instructions: "1 tablet once daily"
  },
  {
    id: "ibuprofen-200",
    medicationName: "Ibuprofen 200 mg",
    quantity: "6 tablets",
    instructions: "1 tablet up to 3 times daily after food"
  },
  {
    id: "cough-syrup",
    medicationName: "Cough syrup",
    quantity: "100 ml",
    instructions: "Use according to clinic label instructions"
  },
  {
    id: "amoxicillin-500",
    medicationName: "Amoxicillin 500 mg",
    quantity: "15 capsules",
    instructions: "1 capsule 3 times daily"
  }
];

const vitalInputFields = [
  {
    field: "temperature",
    label: "Temperature",
    unit: "deg C",
    placeholder: "Example: 37.0",
    min: "25",
    max: "45",
    step: "0.1",
    inputMode: "decimal"
  },
  {
    field: "systolic",
    label: "Systolic blood pressure",
    unit: "mmHg",
    placeholder: "Example: 120",
    min: "50",
    max: "260",
    step: "1",
    inputMode: "numeric"
  },
  {
    field: "diastolic",
    label: "Diastolic blood pressure",
    unit: "mmHg",
    placeholder: "Example: 80",
    min: "30",
    max: "160",
    step: "1",
    inputMode: "numeric"
  },
  {
    field: "heartRate",
    label: "Pulse / heart rate",
    unit: "beats per min",
    placeholder: "Example: 82",
    min: "20",
    max: "240",
    step: "1",
    inputMode: "numeric"
  },
  {
    field: "respiratoryRate",
    label: "Respiratory rate",
    unit: "breaths per min",
    placeholder: "Example: 18",
    min: "5",
    max: "80",
    step: "1",
    inputMode: "numeric"
  },
  {
    field: "oxygenSaturation",
    label: "Oxygen saturation",
    unit: "SpO2 %",
    placeholder: "Example: 98",
    min: "50",
    max: "100",
    step: "1",
    inputMode: "numeric"
  }
];

function normalizeMedicationRows(prescription = {}) {
  const rows = Array.isArray(prescription.medications)
    ? prescription.medications
    : prescription.medicationName || prescription.quantity
      ? [prescription]
      : [];

  const normalized = rows.map((item) => ({
    medicationName: item?.medicationName || "",
    quantity: item?.quantity || "",
    instructions: item?.instructions || ""
  })).filter((item) => item.medicationName || item.quantity);

  return normalized;
}

function formFromVisit(visit) {
  if (!visit) {
    return {
      ...blankForm,
      prescription: createBlankPrescription()
    };
  }

  const corrections = visit.nurseCorrections || {};
  const prescriptionDraft = visit.prescriptionDraft || {};
  const nlpResult = visit.nlpResult || {};
  return {
    temperature: visit.vitals?.temperature ?? "",
    systolic: visit.vitals?.systolic ?? "",
    diastolic: visit.vitals?.diastolic ?? "",
    heartRate: visit.vitals?.heartRate ?? "",
    respiratoryRate: visit.vitals?.respiratoryRate ?? "",
    oxygenSaturation: visit.vitals?.oxygenSaturation ?? "",
    notes: visit.vitals?.notes || "",
    symptomStatement: visit.symptomStatement || "",
    assessmentOutcome: visit.assessmentOutcome || "",
    treatmentNotes: visit.treatmentNotes || "",
    prescription: {
      medications: normalizeMedicationRows(prescriptionDraft)
    },
    nlpConfirmed: Boolean(visit.nlpConfirmed),
    inputMethod: visit.inputMethod || "text",
    originalTranscript: visit.originalTranscript || "",
    nurseCorrections: {
      symptoms: corrections.symptoms || nlpResult.symptoms?.join(", ") || "",
      severity: corrections.severity || nlpResult.severity || "",
      duration: corrections.duration || nlpResult.duration || "",
      negatedSymptoms: corrections.negatedSymptoms || nlpResult.negatedSymptoms?.join(", ") || "",
      mainComplaint: corrections.mainComplaint || nlpResult.mainComplaint || "",
      symptomsAbsent: corrections.symptomsAbsent || nlpResult.symptomsAbsent?.join(", ") || "",
      frequency: corrections.frequency || nlpResult.frequency || "",
      progression: corrections.progression || nlpResult.progression || "",
      medicationAction: corrections.medicationAction || nlpResult.medicationAction || "",
      followUpInstruction: corrections.followUpInstruction || nlpResult.followUpInstruction || "",
      clinicalSummary: corrections.clinicalSummary || nlpResult.clinicalSummary || "",
      visitType: corrections.visitType || visit.visitType || ""
    }
  };
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

function splitCorrectionList(value) {
  return value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function findFrequency(normalized, presentSymptoms) {
  const globalFrequencyPattern = /\b(once|twice|\d+\s+times?)(\s+(?:a|per)\s+(?:day|hour|week))?\b/gi;
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

function buildPreview(text, corrections) {
  const normalized = text.toLowerCase();
  const present = [];
  const negated = [];

  for (const term of symptomTerms) {
    if (!normalized.includes(term)) {
      continue;
    }

    const termIndex = normalized.indexOf(term);
    const context = normalized.slice(Math.max(0, termIndex - 34), termIndex + term.length);

    if (/\b(no|not|without|denies|do not have)\b/.test(context)) {
      negated.push(term);
    } else {
      present.push(term);
    }
  }

  const relativeDurationMatch = normalized.match(
    /since\s+(?:yesterday|today|last\s+night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\b(?:yesterday|today)\b/
  );
  const duration =
    normalized.match(/(\d+\s?(day|days|week|weeks|month|months|hour|hours))/)?.[0] ||
    relativeDurationMatch?.[0] ||
    "";
  const severity = ["severe", "moderate", "mild"].find((level) => normalized.includes(level)) || "";
  const symptoms = corrections.symptoms ? splitCorrectionList(corrections.symptoms) : present;
  const negatedSymptoms = corrections.negatedSymptoms ? splitCorrectionList(corrections.negatedSymptoms) : negated;
  const mainComplaint = corrections.mainComplaint || symptoms[0] || "";
  const frequency = corrections.frequency || findFrequency(normalized, symptoms) || "";
  const progression =
    corrections.progression ||
    (/\b(worse|worsened|worsening|deteriorating|getting worse)\b/.test(normalized)
      ? "worsening"
      : /\b(improving|improved|better|resolved)\b/.test(normalized)
        ? "improving"
        : /\b(same|unchanged|stable)\b/.test(normalized)
          ? "stable"
          : "");
  const medicationAction =
    corrections.medicationAction ||
    (/\b(tablet|tablets|dose|dosage|medication|medicine|prescription|refill|side effect)\b/.test(normalized)
      ? "Medicine or dosage mentioned in the statement."
      : "");
  const followUpInstruction =
    corrections.followUpInstruction ||
    (/\b(follow[- ]?up|check[- ]?up|come back|return in|review in)\b/.test(normalized)
      ? "Follow-up or review mentioned in the statement."
      : "");
  const extras = symptoms.filter((symptom) => symptom !== mainComplaint);
  const clinicalSummary =
    corrections.clinicalSummary ||
    (mainComplaint
      ? `Patient reports ${severity ? `${severity} ` : ""}${mainComplaint}${duration ? ` ${duration}` : ""}${
          extras.length ? ` with ${joinWithAnd(extras)}` : ""
        }.${negatedSymptoms.length ? ` No ${joinWithAnd(negatedSymptoms)} reported.` : ""}`
      : "");

  return {
    symptoms,
    severity: corrections.severity || severity,
    duration: corrections.duration || duration,
    negatedSymptoms,
    mainComplaint,
    frequency,
    progression,
    medicationAction,
    followUpInstruction,
    clinicalSummary,
    readiness: [symptoms.length > 0, duration || corrections.duration, severity || corrections.severity].filter(Boolean)
      .length
  };
}

function assessmentStatusText(status) {
  const labels = {
    draft: "Assessment Started",
    in_progress: "Assessment Started",
    awaiting_doctor_review: "Waiting for Doctor",
    reviewed_by_doctor: "Doctor Reviewed",
    returned_for_correction: "Correction Requested",
    completed: "Completed"
  };

  return labels[status] || status?.replaceAll("_", " ") || "Assessment Started";
}

export function NurseIntakePanel({ visit, profile, nurseName, onSubmitted }) {
  const [form, setForm] = useState(() => formFromVisit(visit));
  const [message, setMessage] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showCorrections, setShowCorrections] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(formFromVisit(visit));
    setMessage("");
    setMedicineSearch("");
    setShowCorrections(false);
    setIsSubmitting(false);
  }, [visit?.id]);

  const preview = useMemo(
    () => buildPreview(form.symptomStatement, form.nurseCorrections),
    [form.symptomStatement, form.nurseCorrections]
  );

  const selectedMedicationNames = useMemo(
    () => new Set(form.prescription.medications.map((item) => item.medicationName.toLowerCase())),
    [form.prescription.medications]
  );

  const filteredMedicineCatalogue = useMemo(() => {
    const query = medicineSearch.trim().toLowerCase();
    if (!query) {
      return medicineCatalogue;
    }

    return medicineCatalogue.filter((medicine) =>
      `${medicine.medicationName} ${medicine.quantity} ${medicine.instructions}`.toLowerCase().includes(query)
    );
  }, [medicineSearch]);

  const visibleMedicineOptions = useMemo(
    () => filteredMedicineCatalogue.slice(0, medicineSearch.trim() ? 6 : 4),
    [filteredMedicineCatalogue, medicineSearch]
  );

  const recordedVitalCount = vitalInputFields.filter(
    (vital) => form[vital.field] !== "" && form[vital.field] !== null && form[vital.field] !== undefined
  ).length;
  const complaintRecorded = Boolean(form.symptomStatement.trim());
  const summaryConfirmed = Boolean(form.nlpConfirmed);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCorrection(field, value) {
    setForm((current) => ({
      ...current,
      nurseCorrections: {
        ...current.nurseCorrections,
        [field]: value
      }
    }));
  }

  function addSymptomTerm(term) {
    setForm((current) => {
      const currentText = current.symptomStatement.trim();
      const alreadyIncluded = currentText.toLowerCase().includes(term.toLowerCase());

      if (alreadyIncluded) {
        return current;
      }

      return {
        ...current,
        symptomStatement: currentText
          ? `${currentText}; ${term}`
          : term
      };
    });
  }

  function handleVoiceTranscript(transcriptChunk) {
    setForm((current) => {
      const currentText = current.symptomStatement.trim();
      const nextText = currentText ? `${currentText} ${transcriptChunk}` : transcriptChunk;
      return {
        ...current,
        symptomStatement: nextText,
        originalTranscript: current.originalTranscript
          ? `${current.originalTranscript} ${transcriptChunk}`
          : transcriptChunk,
        inputMethod: "voice"
      };
    });
  }

  function handleVoiceError(errorText) {
    setMessage(errorText);
  }

  function addMedicineFromCatalogue(medicine) {
    setForm((current) => ({
      ...current,
      prescription: {
        ...current.prescription,
        medications: current.prescription.medications.some(
          (item) => item.medicationName.toLowerCase() === medicine.medicationName.toLowerCase()
        )
          ? current.prescription.medications
          : [
              ...current.prescription.medications,
              {
                medicationName: medicine.medicationName,
                quantity: medicine.quantity,
                instructions: medicine.instructions
              }
            ]
      }
    }));
  }

  function removeMedication(index) {
    setForm((current) => ({
      ...current,
      prescription: {
        ...current.prescription,
        medications: current.prescription.medications.filter((_, itemIndex) => itemIndex !== index)
      }
    }));
  }

  function acceptPreview() {
    setForm((current) => ({
      ...current,
      nlpConfirmed: true,
      nurseCorrections: {
        symptoms: preview.symptoms.join(", "),
        severity: preview.severity,
        duration: preview.duration,
        negatedSymptoms: preview.negatedSymptoms.join(", "),
        mainComplaint: preview.mainComplaint,
        symptomsAbsent: preview.negatedSymptoms.join(", "),
        frequency: preview.frequency,
        progression: preview.progression,
        medicationAction: preview.medicationAction,
        followUpInstruction: preview.followUpInstruction,
        clinicalSummary: preview.clinicalSummary,
        visitType: current.nurseCorrections.visitType
      }
    }));
  }

  async function sendIntake(path, completionType, payload = form) {
    if (!visit) {
      setMessage("Start or select an assessment before saving.");
      return;
    }

    if (recordedVitalCount < vitalInputFields.length) {
      setMessage("Step 1 is incomplete. Record all six vital signs before finishing the assessment.");
      return;
    }

    if (!complaintRecorded) {
      setMessage("Step 2 is incomplete. Record the patient's complaint before finishing the assessment.");
      return;
    }

    if (!summaryConfirmed) {
      setMessage("Review the system-organised summary and select Use Summary before finishing.");
      return;
    }

    if (!payload.assessmentOutcome) {
      setMessage("Step 3 is incomplete. Choose Treat Here or Send to Doctor.");
      return;
    }

    if (
      payload.assessmentOutcome === "treated_by_nurse" &&
      !payload.treatmentNotes.trim() &&
      !payload.prescription.medications.length
    ) {
      setMessage("Record a short care note or select the medicine issued before finishing the patient.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");
      const result = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      onSubmitted?.(result.visit, {
        type: completionType,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      setMessage(error.message);
      setIsSubmitting(false);
    }
  }

  if (!visit) {
    return (
      <section className="panel nurse-empty-intake">
        <Stethoscope size={24} />
        <h3>No current patient assessment selected</h3>
        <p>Find the patient record, then start the nurse assessment.</p>
      </section>
    );
  }

  return (
    <section className="panel nurse-intake-workbench">
      <div className="intake-workbench-header">
        <div>
          <span className="section-label">Current Patient Assessment</span>
          <h3>{visit.visitNumber || "New assessment"} assessment record</h3>
          <p>
            {visit.patientName || profile?.patient
              ? `${visit.patientName || `${profile.patient.firstName} ${profile.patient.lastName}`} | ${visit.patientNumber || profile?.patient?.patientNumber || "No patient number"}`
              : "Selected patient assessment"}
            {nurseName ? ` | Nurse: ${nurseName}` : ""} | {new Date(visit.createdAt || Date.now()).toLocaleString()}
          </p>
        </div>
        <div className="visit-status-pill">
          <ClipboardCheck size={16} />
          {assessmentStatusText(visit.status)}
        </div>
      </div>

      <ol className="assessment-step-guide" aria-label="Assessment progress">
        <li className={recordedVitalCount === vitalInputFields.length ? "complete" : "active"}>
          <span>1</span>
          <div>
            <strong>Record vitals</strong>
            <small>{recordedVitalCount} of {vitalInputFields.length} entered</small>
          </div>
        </li>
        <li className={complaintRecorded ? "complete" : recordedVitalCount === vitalInputFields.length ? "active" : ""}>
          <span>2</span>
          <div>
            <strong>Add complaint</strong>
            <small>{complaintRecorded ? "Complaint recorded" : "Waiting"}</small>
          </div>
        </li>
        <li className={summaryConfirmed && form.assessmentOutcome ? "complete" : complaintRecorded ? "active" : ""}>
          <span>3</span>
          <div>
            <strong>Review and finish</strong>
            <small>{summaryConfirmed ? "Summary reviewed" : "Confirmation needed"}</small>
          </div>
        </li>
      </ol>

      {message ? <p className="notice assessment-notice" role="alert">{message}</p> : null}

      <div className="intake-grid">
        <form className="combined-intake-form">
          <div className="form-section-title">
            <span className="assessment-section-number">1</span>
            <HeartPulse size={18} />
            <strong>Vitals</strong>
          </div>
          <div className="vitals-mini-grid">
            {vitalInputFields.map((vital) => (
              <label className="vital-field" key={vital.field}>
                <span className="vital-label-row">
                  <span>{vital.label}</span>
                  <small>{vital.unit}</small>
                </span>
                <input
                  aria-label={`${vital.label} in ${vital.unit}`}
                  autoComplete="off"
                  inputMode={vital.inputMode}
                  max={vital.max}
                  min={vital.min}
                  onChange={(event) => updateField(vital.field, event.target.value)}
                  placeholder={vital.placeholder}
                  step={vital.step}
                  type="number"
                  value={form[vital.field]}
                />
              </label>
            ))}
          </div>
          <label>
            Optional vitals note
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Short note only if needed."
            />
          </label>

          <div className="form-section-title">
            <span className="assessment-section-number">2</span>
            <BrainCircuit size={18} />
            <strong>Patient's Reported Complaint</strong>
          </div>
          <div className="quick-symptom-buttons" aria-label="Quick symptom buttons">
            {symptomTerms.map((term) => (
              <button
                className="secondary action-small"
                key={term}
                onClick={() => addSymptomTerm(term)}
                type="button"
              >
                {term}
              </button>
            ))}
          </div>
          <VoiceRecorder onTranscriptChange={handleVoiceTranscript} onError={handleVoiceError} />
          <label className="nlp-text-entry">
            Short complaint text (speak it above, or type/edit here)
            <textarea
              value={form.symptomStatement}
              onChange={(event) => updateField("symptomStatement", event.target.value)}
              placeholder="Example: severe chest pain and cough for 3 days, no fever."
            />
          </label>
        </form>

        <VisitClinicalSummaryPanel
          form={form}
          onAcceptPreview={acceptPreview}
          onToggleCorrections={() => setShowCorrections((current) => !current)}
          onUpdateCorrection={updateCorrection}
          onUpdateField={updateField}
          preview={preview}
          showCorrections={showCorrections}
        />
      </div>

      <section className="assessment-decision-panel">
        <div className="assessment-decision-heading">
          <span className="assessment-section-number">3</span>
          <div>
            <strong>Choose the patient outcome</strong>
            <p>Select one option. This decides where the record goes next.</p>
          </div>
        </div>
        <div className="assessment-outcome-options">
          <button
            className={form.assessmentOutcome === "treated_by_nurse" ? "outcome-option selected" : "outcome-option"}
            onClick={() => updateField("assessmentOutcome", "treated_by_nurse")}
            type="button"
          >
            <CheckCircle2 size={20} />
            <span>
              <strong>Treat here</strong>
              <small>Complete the visit under nurse care</small>
            </span>
          </button>
          <button
            className={form.assessmentOutcome === "referred_to_doctor" ? "outcome-option selected" : "outcome-option"}
            onClick={() => updateField("assessmentOutcome", "referred_to_doctor")}
            type="button"
          >
            <Send size={20} />
            <span>
              <strong>Send to doctor</strong>
              <small>Add this patient to the doctor queue</small>
            </span>
          </button>
        </div>
      </section>

      {form.assessmentOutcome === "treated_by_nurse" ? (
        <section className="assessment-treatment-panel">
          <div className="form-section-title">
            <Pill size={18} />
            <strong>Treatment given</strong>
          </div>
          <label className="treatment-note-entry">
            Care note
            <textarea
              value={form.treatmentNotes}
              onChange={(event) => updateField("treatmentNotes", event.target.value)}
              placeholder="Briefly record the care given."
            />
          </label>
          <div className="medication-order-card">
            <div className="medication-order-heading">
              <div>
                <span>Medicine issued</span>
                <strong>Search and select from the clinic catalogue.</strong>
              </div>
            </div>
            <label className="medicine-search-field">
              Search medicine
              <span className="input-with-icon">
                <Search size={18} />
                <input
                  value={medicineSearch}
                  onChange={(event) => setMedicineSearch(event.target.value)}
                  placeholder="Example: paracetamol"
                />
              </span>
            </label>
            <div className="medicine-option-grid">
              {visibleMedicineOptions.map((medicine) => {
                const isSelected = selectedMedicationNames.has(medicine.medicationName.toLowerCase());

                return (
                  <button
                    className={isSelected ? "medicine-option selected" : "medicine-option"}
                    disabled={isSelected}
                    key={medicine.id}
                    onClick={() => addMedicineFromCatalogue(medicine)}
                    type="button"
                  >
                    <strong>{medicine.medicationName}</strong>
                    <span>{medicine.quantity}</span>
                    <small>{medicine.instructions}</small>
                  </button>
                );
              })}
              {!filteredMedicineCatalogue.length ? (
                <p className="muted">No medicine in the catalogue matches that search.</p>
              ) : null}
            </div>
            <div className="medication-order-list">
              {form.prescription.medications.map((medicine, index) => (
                <article className="medication-order-row" key={`medicine-${index}`}>
                  <span className="medicine-row-number">{index + 1}</span>
                  <div>
                    <strong>{medicine.medicationName}</strong>
                    <span>{medicine.quantity}</span>
                    <small>{medicine.instructions}</small>
                  </div>
                  <button
                    aria-label={`Remove medicine ${index + 1}`}
                    className="secondary icon-only"
                    onClick={() => removeMedication(index)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
              {!form.prescription.medications.length ? (
                <p className="muted">No medicine selected. Record a care note if no medicine was issued.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="intake-actions">
        {message ? (
          <div className="intake-action-error" role="alert">
            <strong>Assessment not finished</strong>
            <small>{message}</small>
          </div>
        ) : (
          <div>
            <strong>{form.assessmentOutcome ? "Ready to finish" : "Select an outcome above"}</strong>
            <small>The system will show a confirmation after the record is saved.</small>
          </div>
        )}
        <button
          disabled={!form.assessmentOutcome || isSubmitting}
          onClick={() => {
            const isReferral = form.assessmentOutcome === "referred_to_doctor";
            sendIntake(
              `/visits/${visit.id}/${isReferral ? "submit" : "complete"}`,
              isReferral ? "doctor_queue" : "nurse_completed",
              form
            );
          }}
          type="button"
        >
          {form.assessmentOutcome === "referred_to_doctor" ? <Send size={18} /> : <CheckCircle2 size={18} />}
          {isSubmitting
            ? "Saving assessment..."
            : form.assessmentOutcome === "referred_to_doctor"
              ? "Send to Doctor Queue"
              : form.assessmentOutcome === "treated_by_nurse"
                ? "Finish Patient"
                : "Select Patient Outcome"}
        </button>
      </div>
    </section>
  );
}
