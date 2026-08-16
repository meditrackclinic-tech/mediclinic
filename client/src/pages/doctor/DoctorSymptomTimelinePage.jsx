import { PatientWorkspace } from "../../shared/patient-workspace/PatientWorkspace.jsx";

export function DoctorSymptomTimelinePage() {
  return (
    <section className="doctor-timeline-page page-stack">
      <section className="panel doctor-report-hero">
        <div>
          <span className="section-label">Patient History Timeline</span>
          <h3>Search a patient and review previous visits before deciding.</h3>
          <p>
            This page is for longitudinal history: repeated symptoms, previous medicine records, and past nurse assessments.
          </p>
        </div>
      </section>
      <PatientWorkspace mode="timeline" />
    </section>
  );
}
