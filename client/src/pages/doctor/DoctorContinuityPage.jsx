import { CalendarClock, FileCheck2, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString();
}

function isOverdue(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(date.getTime()) && date < today;
}

export function DoctorContinuityPage() {
  const [visits, setVisits] = useState([]);
  const [message, setMessage] = useState("");

  async function loadContinuity() {
    const data = await apiRequest("/visits?status=reviewed_by_doctor,completed");
    setVisits(data.visits || []);
  }

  useEffect(() => {
    loadContinuity().catch((error) => setMessage(error.message));
  }, []);

  const followUps = useMemo(
    () =>
      visits.filter(
        (visit) =>
          visit.continuityPlan?.followUpRequired ||
          visit.doctorConsultation?.outcome === "follow_up_required"
      ),
    [visits]
  );
  const referrals = useMemo(
    () =>
      visits.filter(
        (visit) =>
          visit.continuityPlan?.referralRequired ||
          visit.doctorConsultation?.outcome === "referral_required"
      ),
    [visits]
  );
  const passportReady = visits.filter((visit) => visit.patientSummary?.status === "passport_ready_draft");
  const overdueFollowUps = followUps.filter((visit) => isOverdue(visit.continuityPlan?.followUpDate));

  return (
    <section className="page-stack doctor-continuity-page">
      {message ? <p className="notice">{message}</p> : null}

      <section className="panel doctor-command-hero-live">
        <div>
          <span className="section-label">After-Consultation Actions</span>
          <h3>See what still needs follow-up, referral, or digital passport attachment.</h3>
          <p>
            This page is not a second dashboard. It is the doctor's worklist after reviewing patients.
          </p>
        </div>
        <button className="secondary" onClick={() => loadContinuity().catch((error) => setMessage(error.message))} type="button">
          <RefreshCcw size={17} />
          Refresh actions
        </button>
      </section>

      <div className="analytics-grid">
        <article className="metric-card">
          <span>Reviewed visits</span>
          <strong>{visits.length}</strong>
          <p>Doctor decisions already saved</p>
        </article>
        <article className="metric-card tone-gold">
          <span>Follow-ups</span>
          <strong>{followUps.length}</strong>
          <p>{overdueFollowUps.length} overdue or past due</p>
        </article>
        <article className="metric-card tone-blue">
          <span>Referrals</span>
          <strong>{referrals.length}</strong>
          <p>Facility handoffs recorded by doctors</p>
        </article>
        <article className="metric-card">
          <span>Ready to attach</span>
          <strong>{passportReady.length}</strong>
          <p>Digital record summaries prepared</p>
        </article>
      </div>

      <div className="doctor-continuity-grid">
        <section className="panel doctor-continuity-list">
          <div className="doctor-card-heading">
            <span>Follow-up worklist</span>
            <strong>Patients who must return</strong>
          </div>
          {followUps.slice(0, 8).map((visit) => (
            <article className={isOverdue(visit.continuityPlan?.followUpDate) ? "continuity-row overdue" : "continuity-row"} key={visit.id}>
              <CalendarClock size={18} />
              <div>
                <strong>{visit.patientName || "Unknown patient"}</strong>
                <span>{formatDate(visit.continuityPlan?.followUpDate)}</span>
                <p>{visit.continuityPlan?.followUpReason || "Follow-up reason not recorded."}</p>
              </div>
            </article>
          ))}
          {!followUps.length ? <p className="muted">No doctor follow-ups have been recorded yet.</p> : null}
        </section>

        <section className="panel doctor-continuity-list">
          <div className="doctor-card-heading">
            <span>Referral worklist</span>
            <strong>Patients sent elsewhere</strong>
          </div>
          {referrals.slice(0, 8).map((visit) => (
            <article className="continuity-row referral" key={visit.id}>
              <Send size={18} />
              <div>
                <strong>{visit.patientName || "Unknown patient"}</strong>
                <span>{visit.continuityPlan?.referralDestination || "Facility not recorded"}</span>
                <p>
                  {visit.continuityPlan?.referralUrgency || "urgency not set"} |{" "}
                  {visit.continuityPlan?.referralReason || "reason not recorded"}
                </p>
              </div>
            </article>
          ))}
          {!referrals.length ? <p className="muted">No referrals have been recorded yet.</p> : null}
        </section>
      </div>

      <section className="panel doctor-passport-board">
        <div className="doctor-card-heading">
          <span>Digital passport attachment queue</span>
          <strong>Summaries created from nurse handoff and doctor diagnosis</strong>
        </div>
        <div className="passport-record-grid">
          {passportReady.slice(0, 9).map((visit) => (
            <article key={visit.id}>
              <FileCheck2 size={18} />
              <strong>{visit.patientName || "Unknown patient"}</strong>
              <span>{visit.visitNumber}</span>
              <p>{visit.patientSummary?.diagnosis || "Doctor diagnosis not recorded"}</p>
              <small>
                Includes nurse vitals, patient complaint, NLP structure, doctor outcome, and follow-up/referral if any.
              </small>
            </article>
          ))}
          {!passportReady.length ? (
            <article className="passport-empty-state">
              <ShieldCheck size={20} />
              <strong>No records ready to attach yet</strong>
              <p>After the doctor saves a consultation, the system-arranged passport summary will appear here.</p>
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}
