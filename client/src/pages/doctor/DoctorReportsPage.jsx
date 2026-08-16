import { Activity, BrainCircuit, CalendarClock, FileText, HeartPulse, RefreshCcw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { consolidateDoctorQueue } from "./doctorQueueUtils.js";

export function DoctorReportsPage() {
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [message, setMessage] = useState("");

  async function loadReports() {
    const [summaryData, queueData, reviewedData] = await Promise.all([
      apiRequest("/reports/summary"),
      apiRequest("/visits?status=awaiting_doctor_review"),
      apiRequest("/visits?status=reviewed_by_doctor,completed,returned_for_correction")
    ]);

    setSummary(summaryData);
    setQueue(consolidateDoctorQueue(queueData.visits || []));
    setReviewed(reviewedData.visits || []);
  }

  useEffect(() => {
    loadReports().catch((error) => setMessage(error.message));
  }, []);

  const reportStats = useMemo(
    () => ({
      waiting: queue.length,
      reviewed: reviewed.filter((visit) => visit.status === "reviewed_by_doctor" || visit.status === "completed").length,
      corrections: reviewed.filter((visit) => visit.status === "returned_for_correction").length,
      symptomRecords: summary?.totals?.symptomRecords || 0
    }),
    [queue, reviewed, summary]
  );
  const maxSymptomCount = Math.max(...(summary?.commonSymptoms || []).map((symptom) => symptom.count), 1);

  return (
    <section className="doctor-reports-page page-stack">
      {message ? <p className="notice">{message}</p> : null}

      <section className="panel doctor-report-hero">
        <div>
          <span className="section-label">Live doctor reports</span>
          <h3>Clinical review activity without admin-only noise.</h3>
          <p>
            These reports show doctor-useful queue, review, symptom, and timeline information from live system data.
          </p>
        </div>
        <button className="secondary" onClick={() => loadReports().catch((error) => setMessage(error.message))} type="button">
          <RefreshCcw size={17} />
          Refresh
        </button>
      </section>

      <section className="doctor-live-metrics">
        <article>
          <HeartPulse size={18} />
          <span>Waiting</span>
          <strong>{reportStats.waiting}</strong>
          <small>in doctor queue</small>
        </article>
        <article>
          <ShieldCheck size={18} />
          <span>Reviewed</span>
          <strong>{reportStats.reviewed}</strong>
          <small>doctor decisions recorded</small>
        </article>
        <article>
          <FileText size={18} />
          <span>Corrections</span>
          <strong>{reportStats.corrections}</strong>
          <small>returned to nurse</small>
        </article>
        <article>
          <BrainCircuit size={18} />
          <span>NLP records</span>
          <strong>{reportStats.symptomRecords}</strong>
          <small>structured symptom notes</small>
        </article>
      </section>

      <section className="doctor-overview-grid">
        <article className="panel doctor-compact-panel">
          <div className="doctor-card-heading">
            <span>Symptom distribution</span>
            <strong>Common extracted terms</strong>
          </div>
          <div className="doctor-symptom-chart">
            {(summary?.commonSymptoms || []).slice(0, 8).map((symptom) => (
              <div className="doctor-symptom-bar" key={symptom.name}>
                <span>{symptom.name}</span>
                <i style={{ width: `${Math.max((symptom.count / maxSymptomCount) * 100, 8)}%` }} />
                <strong>{symptom.count}</strong>
              </div>
            ))}
            {!summary?.commonSymptoms?.length ? <p className="muted">No symptom patterns captured yet.</p> : null}
          </div>
        </article>

        <article className="panel doctor-compact-panel">
          <div className="doctor-card-heading">
            <span>Recent clinical records</span>
            <strong>Timeline updates</strong>
          </div>
          <div className="doctor-recent-records">
            {(summary?.recentRecords || []).slice(0, 6).map((record) => (
              <article key={record.id}>
                <Activity size={16} />
                <div>
                  <strong>{record.patientName || "Patient record"}</strong>
                  <span>{(record.symptoms || []).join(", ") || "No symptom term"} | {record.severity || "severity not set"}</span>
                  <small>{new Date(record.createdAt || record.date).toLocaleString()}</small>
                </div>
              </article>
            ))}
            {!summary?.recentRecords?.length ? <p className="muted">No recent timeline records yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="panel doctor-report-checks">
        <div className="doctor-card-heading">
          <span>Doctor report rules</span>
          <strong>What this page should show</strong>
        </div>
        <span><CalendarClock size={16} /> Queue pressure and review outcomes.</span>
        <span><BrainCircuit size={16} /> Structured symptom patterns from NLP output.</span>
        <span><ShieldCheck size={16} /> Record support only, not automated diagnosis.</span>
      </section>
    </section>
  );
}
