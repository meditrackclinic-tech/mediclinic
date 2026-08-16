import { CalendarClock, FileText } from "lucide-react";

export function SymptomTimeline({ selectedPatient, records }) {
  return (
    <section className="panel nurse-timeline-panel">
      <div className="nurse-timeline-heading">
        <div>
          <span className="section-label">Temporal record</span>
          <h3>
            <CalendarClock size={18} />
            Timeline {selectedPatient ? `for ${selectedPatient.firstName}` : ""}
          </h3>
        </div>
        <strong>{records.length} notes</strong>
      </div>
      <div className="timeline">
        {records.map((record) => (
          <article key={record.id} className="timeline-item">
            <time>{new Date(record.date).toLocaleString()}</time>
            <strong>
              <FileText size={16} />
              {record.mainComplaint || record.symptoms.join(", ")}
            </strong>
            {record.visitType ? <span className="visit-type-badge">{record.visitType}</span> : null}
            <p>{record.clinicalSummary || record.rawDescription}</p>
            <div className="chips">
              <span>Symptoms: {(record.symptomsPresent?.length ? record.symptomsPresent : record.symptoms).join(", ") || "not specified"}</span>
              <span>Severity: {record.severity || "not specified"}</span>
              <span>Duration: {record.duration || "not specified"}</span>
              {record.symptomsAbsent?.length ? <span>Absent: {record.symptomsAbsent.join(", ")}</span> : null}
            </div>
          </article>
        ))}
        {!records.length ? <p className="muted">No symptom timeline yet.</p> : null}
      </div>
    </section>
  );
}
