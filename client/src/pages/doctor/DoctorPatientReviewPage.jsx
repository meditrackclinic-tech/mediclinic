import {
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  ListOrdered,
  Pill,
  RefreshCcw,
  Send,
  ShieldCheck,
  Stethoscope,
  Undo2,
  UserRoundCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { consolidateDoctorQueue } from "./doctorQueueUtils.js";

const blankConsultation = {
  diagnosis: "",
  outcome: "complete_consultation"
};

const blankContinuityPlan = {
  followUpDate: "",
  followUpReason: "",
  referralDestination: "",
  referralReason: "",
  referralUrgency: "",
  returnToNurseReason: ""
};

const blankNlpFeedback = {
  rating: "",
  correctionNote: ""
};

function statusText(status) {
  const labels = {
    awaiting_doctor_review: "Waiting in Doctor Queue",
    reviewed_by_doctor: "Doctor Reviewed",
    returned_for_correction: "Correction Requested"
  };

  return labels[status] || status?.replaceAll("_", " ") || "Waiting in Doctor Queue";
}

function formatVitals(vitals = {}) {
  return [
    `Temp ${vitals.temperature ?? "-"} C`,
    `BP ${vitals.systolic ?? "-"} / ${vitals.diastolic ?? "-"}`,
    `HR ${vitals.heartRate ?? "-"}`,
    `RR ${vitals.respiratoryRate ?? "-"}`,
    `SpO2 ${vitals.oxygenSaturation ?? "-"}%`
  ].join(" | ");
}

function truncate(text, maxLength = 90) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function readableOutcome(value) {
  const labels = {
    complete_consultation: "Complete consultation",
    follow_up_required: "Follow-up required",
    referral_required: "Referral required",
    return_to_nurse: "Return to nurse for correction"
  };

  return labels[value] || "Complete consultation";
}

export function DoctorPatientReviewPage() {
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [consultation, setConsultation] = useState(blankConsultation);
  const [continuityPlan, setContinuityPlan] = useState(blankContinuityPlan);
  const [nlpFeedback, setNlpFeedback] = useState(blankNlpFeedback);
  const [qualityChecks, setQualityChecks] = useState([]);
  const [actionMessage, setActionMessage] = useState("");
  const [message, setMessage] = useState("");
  const [caseFocus, setCaseFocus] = useState(false);

  async function loadDoctorQueue() {
    const data = await apiRequest("/visits?status=awaiting_doctor_review");
    const sortedVisits = consolidateDoctorQueue(data.visits || []);
    setVisits(sortedVisits);
    setSelectedVisit((current) =>
      sortedVisits.find((visit) => visit.id === current?.id) || sortedVisits[0] || null
    );
  }

  useEffect(() => {
    loadDoctorQueue().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!selectedVisit?.patientId) {
      setSelectedProfile(null);
      return;
    }

    setConsultation({ ...blankConsultation, ...(selectedVisit.doctorConsultation || {}) });
    setContinuityPlan({ ...blankContinuityPlan, ...(selectedVisit.continuityPlan || {}) });
    setNlpFeedback({ ...blankNlpFeedback, ...(selectedVisit.nlpFeedback || {}) });
    setQualityChecks([]);
    setActionMessage("");

    apiRequest(`/patients/${selectedVisit.patientId}/profile`)
      .then((data) => setSelectedProfile(data))
      .catch((error) => setMessage(error.message));
  }, [selectedVisit?.patientId]);

  const queueSummary = useMemo(
    () => ({
      total: visits.length,
      immediate: visits.filter((visit) => visit.reviewPrompt?.level === "immediate_escalation").length,
      prompt: visits.filter((visit) => visit.reviewPrompt?.level === "prompt_doctor_review").length,
      routine: visits.filter((visit) => visit.reviewPrompt?.level === "routine_review").length
    }),
    [visits]
  );

  const matchingHistory = useMemo(() => {
    const symptoms = new Set(selectedVisit?.nlpResult?.symptoms || []);
    return (selectedProfile?.symptomTimeline || []).filter((record) =>
      record.symptoms?.some((symptom) => symptoms.has(symptom))
    );
  }, [selectedProfile, selectedVisit]);

  const passportSummary = useMemo(() => {
    if (!selectedVisit) {
      return [];
    }

    const nlp = selectedVisit.nlpResult || {};
    const rows = [
      ["Patient", `${selectedVisit.patientName || "Unknown"} (${selectedVisit.patientNumber || "no number"})`],
      ["Visit", `${selectedVisit.visitNumber} | ${new Date(selectedVisit.submittedAt || selectedVisit.createdAt).toLocaleString()}`],
      ["Nurse vitals", formatVitals(selectedVisit.vitals)],
      ["Patient complaint", selectedVisit.symptomStatement || "No patient statement recorded"],
      ["NLP organised complaint", `${(nlp.symptoms || []).join(", ") || "No extracted terms"}; ${nlp.severity || "severity not set"}; ${nlp.duration || "duration not set"}`],
      ["Visit type", selectedVisit.visitType || "Not classified"],
      ["Clinical summary", nlp.clinicalSummary || "No summary generated"],
      ["Doctor diagnosis", consultation.diagnosis || "Waiting for doctor-entered diagnosis"],
      ["Doctor outcome", readableOutcome(consultation.outcome)]
    ];

    if (consultation.outcome === "follow_up_required") {
      rows.push(["Follow-up", `${continuityPlan.followUpDate || "date pending"} | ${continuityPlan.followUpReason || "reason pending"}`]);
    }

    if (consultation.outcome === "referral_required") {
      rows.push([
        "Referral",
        `${continuityPlan.referralDestination || "facility pending"} | ${continuityPlan.referralUrgency || "urgency pending"} | ${continuityPlan.referralReason || "reason pending"}`
      ]);
    }

    return rows;
  }, [consultation, continuityPlan, selectedVisit]);

  async function submitDoctorDecision(status) {
    if (!selectedVisit) {
      return;
    }

    const reviewNote =
      status === "returned_for_correction"
        ? continuityPlan.returnToNurseReason
        : `Doctor completed review. ${readableOutcome(consultation.outcome)}. Passport summary prepared from nurse assessment and doctor-entered diagnosis.`;

    try {
      const result = await apiRequest(`/visits/${selectedVisit.id}/doctor-review`, {
        method: "POST",
        body: JSON.stringify({
          status,
          notes: reviewNote,
          consultation: {
            ...consultation,
            examinationNotes: "Auto-arranged from nurse handoff, vitals, complaint text, and doctor review.",
            plan: readableOutcome(consultation.outcome),
            instructions: passportSummary.map(([label, value]) => `${label}: ${value}`).join("\n")
          },
          continuityPlan: {
            ...continuityPlan,
            followUpRequired: consultation.outcome === "follow_up_required",
            referralRequired: consultation.outcome === "referral_required"
          },
          nlpFeedback
        })
      });
      setActionMessage(
        status === "returned_for_correction"
          ? "Returned to the nurse with the correction needed."
          : "Doctor decision saved. The system arranged the digital passport summary automatically."
      );
      setSelectedVisit(result.visit);
      setCaseFocus(false);
      await loadDoctorQueue();
    } catch (error) {
      setQualityChecks(error.response?.qualityChecks || []);
      setActionMessage(error.message);
    }
  }

  function openCase(visit) {
    setSelectedVisit(visit);
    setCaseFocus(true);
  }

  function updateConsultation(field, value) {
    setConsultation((current) => ({ ...current, [field]: value }));
  }

  function updateContinuity(field, value) {
    setContinuityPlan((current) => ({ ...current, [field]: value }));
  }

  function updateNlpFeedback(field, value) {
    setNlpFeedback((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="page-stack handoff-workspace doctor-review-redesign">
      {message ? <p className="notice">{message}</p> : null}

      <section className="panel digital-doctor-hero">
        <div>
          <span className="section-label">Doctor Review Queue</span>
          <h3>Open the nurse handoff, enter the diagnosis, then attach the clean summary.</h3>
          <p>
            The doctor should not rewrite the nurse assessment. The system organises the handoff and prepares the digital passport summary.
          </p>
        </div>
        <button className="secondary" onClick={() => loadDoctorQueue().catch((error) => setMessage(error.message))} type="button">
          <RefreshCcw size={17} />
          Refresh queue
        </button>
      </section>

      {!caseFocus ? (
        <>
          <div className="analytics-grid">
            <article className="metric-card">
              <span>Waiting</span>
              <strong>{queueSummary.total}</strong>
              <p>Unique patients in the doctor line</p>
            </article>
            <article className="metric-card tone-red">
              <span>Immediate</span>
              <strong>{queueSummary.immediate}</strong>
              <p>Vitals or nurse prompt needs attention</p>
            </article>
            <article className="metric-card tone-gold">
              <span>Prompt</span>
              <strong>{queueSummary.prompt}</strong>
              <p>Should be reviewed soon</p>
            </article>
            <article className="metric-card tone-blue">
              <span>Routine</span>
              <strong>{queueSummary.routine}</strong>
              <p>Standard handoff reviews</p>
            </article>
          </div>

          <section className="panel doctor-queue-table-panel">
            <div className="doctor-card-heading">
              <span>Live line</span>
              <strong>Click a patient to review</strong>
            </div>
            <div className="doctor-review-table">
              <div className="doctor-review-table-head">
                <span>Priority</span>
                <span>Patient</span>
                <span>Visit type &amp; summary</span>
                <span>History</span>
                <span>Action</span>
              </div>
              {visits.map((visit, index) => (
                <article key={visit.id}>
                  <span className={`queue-priority-dot level-${visit.reviewPrompt?.level || "routine_review"}`}>{index + 1}</span>
                  <strong>{visit.patientName || "Unknown patient"}<small>{visit.patientNumber || visit.visitNumber}</small></strong>
                  <span>
                    {visit.visitType ? <span className="visit-type-badge">{visit.visitType}</span> : null}
                    <small>{truncate(visit.nlpResult?.clinicalSummary) || visit.reviewPrompt?.label || "Routine review"}</small>
                  </span>
                  <span>
                    {visit.pendingVisitCount > 1 ? `${visit.pendingVisitCount} nurse submissions` : "One active visit"}
                    {(visit.historyAlerts || []).map((alert) => (
                      <small className="history-alert-chip" key={alert}>{alert}</small>
                    ))}
                  </span>
                  <button onClick={() => openCase(visit)} type="button">Open Handoff</button>
                </article>
              ))}
              {!visits.length ? <p className="muted">No patients are waiting for doctor review.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      {caseFocus && selectedVisit ? (
        <main className="panel doctor-focused-handoff">
          <button className="secondary doctor-back-to-line" onClick={() => setCaseFocus(false)} type="button">
            <ArrowLeft size={18} />
            Back to Doctor Queue
          </button>

          <section className="doctor-handoff-header">
            <div>
              <span className="section-label">Patient handoff from nurse</span>
              <h3>{selectedVisit.patientName}</h3>
              <p>{selectedVisit.patientNumber || "No patient number"} | {selectedVisit.visitNumber} | {statusText(selectedVisit.status)}</p>
            </div>
            <div>
              <strong>{selectedVisit.reviewPrompt?.label || "Routine Review"}</strong>
              {selectedVisit.visitType ? <span className="visit-type-badge">{selectedVisit.visitType}</span> : null}
              <span>{matchingHistory.length ? `${matchingHistory.length} relevant previous notes` : "No matching history"}</span>
              {(selectedVisit.historyAlerts || []).map((alert) => (
                <small className="history-alert-chip" key={alert}>{alert}</small>
              ))}
            </div>
          </section>

          <section className="doctor-handoff-grid">
            <article className="nurse-handoff-card wide">
              <div className="form-section-title">
                <ClipboardList size={18} />
                <strong>What the nurse recorded</strong>
              </div>
              <dl>
                <div><dt>Vitals</dt><dd>{formatVitals(selectedVisit.vitals)}</dd></div>
                <div><dt>Patient words</dt><dd>{selectedVisit.symptomStatement || "No patient statement recorded."}</dd></div>
                <div><dt>Nurse note</dt><dd>{selectedVisit.treatmentNotes || "No nurse treatment note attached."}</dd></div>
              </dl>
            </article>

            <article className="nurse-handoff-card">
              <div className="form-section-title">
                <BrainCircuit size={18} />
                <strong>NLP arranged result</strong>
              </div>
              <dl>
                <div><dt>Main complaint</dt><dd>{selectedVisit.nlpResult?.mainComplaint || "Not detected"}</dd></div>
                <div><dt>Symptoms present</dt><dd>{(selectedVisit.nlpResult?.symptoms || []).join(", ") || "No terms extracted"}</dd></div>
                <div><dt>Symptoms absent</dt><dd>{(selectedVisit.nlpResult?.negatedSymptoms || []).join(", ") || "None recorded"}</dd></div>
                <div><dt>Duration</dt><dd>{selectedVisit.nlpResult?.duration || "Not detected"}</dd></div>
                <div><dt>Severity</dt><dd>{selectedVisit.nlpResult?.severity || "Not detected"}</dd></div>
                <div><dt>Frequency</dt><dd>{selectedVisit.nlpResult?.frequency || "Not detected"}</dd></div>
                <div><dt>Progression</dt><dd>{selectedVisit.nlpResult?.progression || "Not detected"}</dd></div>
                <div><dt>Medication / action</dt><dd>{selectedVisit.nlpResult?.medicationAction || "Not detected"}</dd></div>
                <div><dt>Follow-up instruction</dt><dd>{selectedVisit.nlpResult?.followUpInstruction || "Not detected"}</dd></div>
                <div><dt>Visit type</dt><dd>{selectedVisit.visitType || "Not classified"}</dd></div>
                <div><dt>Clinical summary</dt><dd>{selectedVisit.nlpResult?.clinicalSummary || "Not generated"}</dd></div>
              </dl>
            </article>

            <article className="nurse-handoff-card">
              <div className="form-section-title">
                <CalendarClock size={18} />
                <strong>Relevant history</strong>
              </div>
              <div className="doctor-mini-list">
                {matchingHistory.slice(0, 4).map((record) => (
                  <span key={record.id}>{new Date(record.date).toLocaleDateString()} | {record.symptoms.join(", ")}</span>
                ))}
                {!matchingHistory.length ? <span>No previous matching symptom notes.</span> : null}
              </div>
            </article>

            <article className="nurse-handoff-card">
              <div className="form-section-title">
                <Pill size={18} />
                <strong>Medicine safety</strong>
              </div>
              <div className="doctor-mini-list">
                {(selectedProfile?.prescriptionHistory || []).slice(0, 4).map((item) => (
                  <span key={item.id}>{item.medicationName} | qty {item.quantity || "-"} | {new Date(item.createdAt).toLocaleDateString()}</span>
                ))}
                {!selectedProfile?.prescriptionHistory?.length ? <span>No previous medicine records.</span> : null}
              </div>
            </article>
          </section>

          <section className="doctor-decision-console">
            <div className="doctor-form-heading">
              <div>
                <span className="section-label">Doctor input</span>
                <h3>Only enter what the doctor must personally decide.</h3>
                <p>Nurse findings and NLP results are already above. The system will arrange the passport summary automatically.</p>
              </div>
              <span className="doctor-safe-pill">Diagnosis is doctor-entered</span>
            </div>

            <div className="doctor-form-grid compact-decision">
              <label className="doctor-field">
                Doctor diagnosis / clinical assessment
                <input
                  value={consultation.diagnosis}
                  onChange={(event) => updateConsultation("diagnosis", event.target.value)}
                  placeholder="Doctor enters diagnosis here"
                />
              </label>
              <label className="doctor-field">
                Doctor decision
                <select value={consultation.outcome} onChange={(event) => updateConsultation("outcome", event.target.value)}>
                  <option value="complete_consultation">Complete consultation</option>
                  <option value="follow_up_required">Needs follow-up</option>
                  <option value="referral_required">Refer patient</option>
                  <option value="return_to_nurse">Return to nurse</option>
                </select>
              </label>
              <label className="doctor-field">
                NLP accuracy check
                <select value={nlpFeedback.rating} onChange={(event) => updateNlpFeedback("rating", event.target.value)}>
                  <option value="">Select accuracy</option>
                  <option value="accurate">Accurate</option>
                  <option value="partly_accurate">Partly accurate</option>
                  <option value="incorrect">Incorrect</option>
                </select>
              </label>
            </div>

            {nlpFeedback.rating === "partly_accurate" || nlpFeedback.rating === "incorrect" ? (
              <label className="doctor-field">
                Correct the NLP output for research evaluation
                <textarea
                  value={nlpFeedback.correctionNote}
                  onChange={(event) => updateNlpFeedback("correctionNote", event.target.value)}
                  placeholder="Example: Duration was 5 days, not 3 days."
                />
              </label>
            ) : null}

            {consultation.outcome === "follow_up_required" ? (
              <div className="doctor-form-grid compact-decision">
                <label className="doctor-field">
                  Follow-up date
                  <input type="date" value={continuityPlan.followUpDate} onChange={(event) => updateContinuity("followUpDate", event.target.value)} />
                </label>
                <label className="doctor-field wide">
                  Follow-up reason
                  <input value={continuityPlan.followUpReason} onChange={(event) => updateContinuity("followUpReason", event.target.value)} placeholder="Why the patient must return" />
                </label>
              </div>
            ) : null}

            {consultation.outcome === "referral_required" ? (
              <div className="doctor-form-grid compact-decision">
                <label className="doctor-field">
                  Referral facility
                  <input value={continuityPlan.referralDestination} onChange={(event) => updateContinuity("referralDestination", event.target.value)} placeholder="Hospital, clinic, or service" />
                </label>
                <label className="doctor-field">
                  Urgency
                  <select value={continuityPlan.referralUrgency} onChange={(event) => updateContinuity("referralUrgency", event.target.value)}>
                    <option value="">Select urgency</option>
                    <option value="routine">Routine</option>
                    <option value="soon">Soon</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="doctor-field wide">
                  Referral reason
                  <input value={continuityPlan.referralReason} onChange={(event) => updateContinuity("referralReason", event.target.value)} placeholder="Why this referral is needed" />
                </label>
              </div>
            ) : null}

            {consultation.outcome === "return_to_nurse" ? (
              <label className="doctor-field">
                What must the nurse correct or add?
                <textarea
                  value={continuityPlan.returnToNurseReason}
                  onChange={(event) => updateContinuity("returnToNurseReason", event.target.value)}
                  placeholder="Example: Please repeat oxygen saturation and confirm symptom duration."
                />
              </label>
            ) : null}

            <section className="passport-attach-panel">
              <div>
                <span className="section-label">Digital passport prompt</span>
                <h4>Attach this system-arranged summary to the patient digital record?</h4>
                <p>The summary below is made from nurse-recorded data, NLP organisation, and the doctor-entered diagnosis. Internal prompts and confidence scores are not exposed.</p>
              </div>
              <ShieldCheck size={28} />
            </section>

            <div className="passport-summary-list">
              {passportSummary.map(([label, value]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>

            {qualityChecks.length ? (
              <div className="doctor-quality-check-list">
                <strong>Before completion, fix:</strong>
                {qualityChecks.map((check) => <span key={check}>{check}</span>)}
              </div>
            ) : null}
            {actionMessage ? <p className="notice">{actionMessage}</p> : null}

            <div className="doctor-action-buttons">
              <button className="secondary" onClick={() => submitDoctorDecision("returned_for_correction")} type="button">
                <Undo2 size={18} />
                Return to Nurse
              </button>
              <button onClick={() => submitDoctorDecision("reviewed_by_doctor")} type="button">
                <CheckCircle2 size={18} />
                Save and Attach to Digital Record
              </button>
            </div>
          </section>

          <section className="handoff-prompt routine">
            <FileText size={18} />
            <div>
              <span>What is stored</span>
              <strong>Clinical record support only</strong>
              <p>The system stores the raw patient words, nurse vitals, NLP structure, doctor-entered diagnosis, outcome, follow-up/referral data, and audit trail. It does not diagnose the patient.</p>
            </div>
          </section>
        </main>
      ) : null}
    </section>
  );
}
