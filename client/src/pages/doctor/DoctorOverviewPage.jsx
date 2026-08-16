import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  RefreshCcw,
  Stethoscope
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { consolidateDoctorQueue, statusLabel } from "./doctorQueueUtils.js";

function submittedTime(visit) {
  return new Date(visit.submittedAt || visit.updatedAt || visit.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function levelStamp(level) {
  if (level === "immediate_escalation") return "stamp stamp-red";
  if (level === "prompt_doctor_review") return "stamp stamp-amber";
  return "stamp stamp-teal";
}

export function DoctorOverviewPage({ onNavigate }) {
  const [queue, setQueue] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState("");

  async function loadOverview() {
    const [queueData, summaryData] = await Promise.all([
      apiRequest("/visits?status=awaiting_doctor_review"),
      apiRequest("/reports/summary")
    ]);

    const nextQueue = consolidateDoctorQueue(queueData.visits || []);
    setQueue(nextQueue);
    setSummary(summaryData);
    setSelectedQueueId(
      (current) => nextQueue.find((visit) => visit.id === current)?.id || nextQueue[0]?.id || ""
    );
  }

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
  }, []);

  const metrics = useMemo(
    () => ({
      waiting: queue.length,
      urgent: queue.filter((visit) => visit.reviewPrompt?.level === "immediate_escalation").length,
      prompt: queue.filter((visit) => visit.reviewPrompt?.level === "prompt_doctor_review").length,
      routine: queue.filter((visit) => visit.reviewPrompt?.level === "routine_review").length,
      lowOxygen: queue.filter(
        (visit) =>
          Number(visit.vitals?.oxygenSaturation) && Number(visit.vitals.oxygenSaturation) < 90
      ).length
    }),
    [queue]
  );
  const maxQueue = Math.max(queue.length, 1);
  const selectedQueueItem = queue.find((visit) => visit.id === selectedQueueId) || queue[0] || null;
  const visibleQueue = queue.slice(0, 100);
  const hiddenQueueCount = Math.max(queue.length - visibleQueue.length, 0);

  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">Clinical review</span>
          <h2>Doctor line</h2>
          <p className="pg-sub">
            Nurse-submitted assessments waiting for review — structured symptoms and vitals
            beside the patient's own words.
          </p>
        </div>
        <div className="pg-actions">
          <button
            className="secondary"
            onClick={() => loadOverview().catch((error) => setMessage(error.message))}
            type="button"
          >
            <RefreshCcw size={15} />
            Refresh
          </button>
          <button onClick={() => onNavigate?.("review")} type="button">
            <Stethoscope size={16} />
            Open case review
          </button>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <div className="kpi-grid">
        <article className="kpi">
          <span>Waiting</span>
          <strong>{metrics.waiting}</strong>
          <small>patients in the doctor line</small>
        </article>
        <article className={metrics.urgent ? "kpi kpi-alert" : "kpi"}>
          <span>Urgent</span>
          <strong>{metrics.urgent}</strong>
          <small>escalation indicators raised</small>
        </article>
        <article className="kpi">
          <span>Structured records</span>
          <strong>{summary?.totals?.symptomRecords || 0}</strong>
          <small>NLP symptom records available</small>
        </article>
        <article className={metrics.lowOxygen ? "kpi kpi-alert" : "kpi"}>
          <span>Vitals flags</span>
          <strong>{metrics.lowOxygen}</strong>
          <small>SpO₂ below review threshold</small>
        </article>
      </div>

      <div className="work-grid">
        <article className="panel">
          <div className="ph-card-head">
            <strong>Waiting for review</strong>
            <span>
              {queue.length} in line{hiddenQueueCount ? ` · showing first ${visibleQueue.length}` : ""}
            </span>
          </div>

          <div className="line-rows">
            {visibleQueue.map((visit, index) => (
              <button
                className={
                  selectedQueueItem?.id === visit.id ? "line-row selected" : "line-row"
                }
                key={visit.id}
                onClick={() => setSelectedQueueId(visit.id)}
                type="button"
              >
                <span className="ln-pos">{String(index + 1).padStart(2, "0")}</span>
                <span className="ln-main">
                  <strong>{visit.patientName || "Unknown patient"}</strong>
                  <small>
                    {visit.patientNumber || "No patient number"} · submitted {submittedTime(visit)}
                    {visit.pendingVisitCount > 1
                      ? ` · ${visit.pendingVisitCount} submissions combined`
                      : ""}
                  </small>
                </span>
                <span className="ln-vitals">
                  BP {visit.vitals?.systolic || "–"}/{visit.vitals?.diastolic || "–"} · SpO₂{" "}
                  {visit.vitals?.oxygenSaturation || "–"}%
                </span>
                <span className={levelStamp(visit.reviewPrompt?.level)}>
                  {statusLabel(visit)}
                </span>
              </button>
            ))}
          </div>

          {!queue.length ? (
            <div className="empty-note">
              <strong>The doctor line is clear</strong>
              New nurse submissions will appear here automatically.
            </div>
          ) : null}

          {selectedQueueItem ? (
            <aside className="spot-card">
              <span>{statusLabel(selectedQueueItem)}</span>
              <strong>{selectedQueueItem.patientName || "Unknown patient"}</strong>
              <p>
                {selectedQueueItem.patientNumber || "No patient number"} · BP{" "}
                {selectedQueueItem.vitals?.systolic || "–"}/
                {selectedQueueItem.vitals?.diastolic || "–"} · SpO₂{" "}
                {selectedQueueItem.vitals?.oxygenSaturation || "–"}%
              </p>
              {selectedQueueItem.pendingVisitCount > 1 ? (
                <small>
                  {selectedQueueItem.pendingVisitCount} nurse submissions combined for this
                  patient.
                </small>
              ) : null}
              <button onClick={() => onNavigate?.("review")} type="button">
                Open case review
              </button>
            </aside>
          ) : null}
        </article>

        <div className="work-col">
          <article className="panel">
            <div className="ph-card-head">
              <strong>Review load</strong>
              <span>priority mix</span>
            </div>
            {[
              ["Immediate", metrics.urgent, "#b42318"],
              ["Prompt review", metrics.prompt, "#a15c07"],
              ["Routine", metrics.routine, "#0e7c86"]
            ].map(([label, value, color]) => (
              <div className="bar-row" key={label}>
                <span>{label}</span>
                <div>
                  <i
                    style={{
                      "--bar-w": `${Math.max((value / maxQueue) * 100, value ? 8 : 0)}%`,
                      "--bar-color": color
                    }}
                  />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </article>

          <article className="panel">
            <div className="ph-card-head">
              <strong>Common symptom terms</strong>
              <span>this clinic</span>
            </div>
            {(summary?.commonSymptoms || []).slice(0, 5).map((symptom) => (
              <div className="bar-row" key={symptom.name}>
                <span>{symptom.name}</span>
                <div>
                  <i
                    style={{
                      "--bar-w": `${Math.max(
                        (symptom.count /
                          Math.max(...(summary?.commonSymptoms || []).map((s) => s.count), 1)) *
                          100,
                        8
                      )}%`
                    }}
                  />
                </div>
                <strong>{symptom.count}</strong>
              </div>
            ))}
            {!summary?.commonSymptoms?.length ? (
              <p className="muted">No symptom patterns captured yet.</p>
            ) : null}
          </article>

          <article className="panel">
            <div className="ph-card-head">
              <strong>Clinical safety</strong>
              <span>reminders</span>
            </div>
            <div className="note-row">
              <CheckCircle2 size={16} />
              <span>Vitals are shown beside NLP output.</span>
            </div>
            <div className="note-row">
              <CalendarClock size={16} />
              <span>Timeline history stays available before review.</span>
            </div>
            <div className="note-row">
              <BrainCircuit size={16} />
              <span>NLP text organises the record — it is not a diagnosis.</span>
            </div>
            {metrics.urgent ? (
              <div className="note-row">
                <AlertTriangle size={16} />
                <span>
                  <strong>{metrics.urgent} case(s) flagged for immediate escalation.</strong>
                </span>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}
