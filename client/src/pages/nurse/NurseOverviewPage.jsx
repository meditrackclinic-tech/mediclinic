import { ClipboardList, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../api.js";

function patientName(patient) {
  return `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unnamed patient";
}

function displayDate(value) {
  if (!value) {
    return "Just added";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently added"
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const flowSteps = [
  { title: "Open the patient record", note: "Reception creates it first — search, don't re-register." },
  { title: "Record vitals", note: "Temperature, BP, pulse, respiration, SpO₂." },
  { title: "Capture the complaint", note: "The patient's own words; NLP structures them." },
  { title: "Treat or hand off", note: "Complete care, or send to the doctor line." }
];

export function NurseOverviewPage({ onNavigate = () => {} }) {
  const [patients, setPatients] = useState([]);
  const [message, setMessage] = useState("");

  async function loadLatestPatients() {
    setMessage("");
    const data = await apiRequest("/patients?page=1&limit=3");
    setPatients(data.patients || []);
  }

  useEffect(() => {
    loadLatestPatients().catch((error) => setMessage(error.message));
    const timer = window.setInterval(() => {
      loadLatestPatients().catch((error) => setMessage(error.message));
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">Assessment workspace</span>
          <h2>Ready for quick assessment</h2>
          <p className="pg-sub">
            Open an existing record, capture vitals and the complaint, confirm the NLP summary,
            then complete care or send to the doctor.
          </p>
        </div>
        <div className="pg-actions">
          <button
            className="secondary"
            onClick={() => loadLatestPatients().catch((error) => setMessage(error.message))}
            type="button"
          >
            <RefreshCcw size={15} />
            Refresh
          </button>
          <button onClick={() => onNavigate("assess")} type="button">
            <ClipboardList size={16} />
            Open Quick Assessment
          </button>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <div className="step-strip" aria-label="Assessment flow">
        {flowSteps.map((step, index) => (
          <article key={step.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.note}</small>
            </div>
          </article>
        ))}
      </div>

      <article className="panel">
        <div className="ph-card-head">
          <strong>Latest from reception</strong>
          <span>newest records · identity only</span>
        </div>

        <div className="line-rows">
          {patients.map((patient, index) => (
            <button
              className="line-row"
              key={patient.id}
              onClick={() => onNavigate("assess")}
              type="button"
            >
              <span className="ln-pos">{String(index + 1).padStart(2, "0")}</span>
              <span className="ln-main">
                <strong>{patientName(patient)}</strong>
                <small>{patient.patientNumber || "No patient number yet"}</small>
              </span>
              <span className="ln-vitals">{displayDate(patient.createdAt)}</span>
              <span className="stamp stamp-teal">Ready</span>
            </button>
          ))}
        </div>

        {!patients.length ? (
          <div className="empty-note">
            <strong>No patients added yet</strong>
            Ask reception to create the patient record before nurse assessment.
          </div>
        ) : null}
      </article>
    </section>
  );
}
