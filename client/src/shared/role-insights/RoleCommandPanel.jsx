import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  FileSearch,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../api.js";
import adminVisual from "../../assets/admin-command-visual.svg";
import doctorVisual from "../../assets/doctor-review-visual.svg";
import nurseVisual from "../../assets/nurse-intake-visual.svg";

export function RoleCommandPanel({ role, onNavigate }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiRequest("/reports/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const totals = summary?.totals || {};

  if (role === "admin") {
    return <AdminCommand totals={totals} onNavigate={onNavigate} />;
  }

  if (role === "nurse") {
    return <NurseCommand totals={totals} onNavigate={onNavigate} />;
  }

  if (role === "doctor") {
    return <DoctorCommand totals={totals} onNavigate={onNavigate} />;
  }

  return null;
}

function AdminCommand({ totals, onNavigate }) {
  return (
    <section className="role-command role-command-admin admin-command-layout">
      <div className="role-command-main">
        <span className="role-command-kicker">
          <UserCog size={18} />
          Admin command center
        </span>
        <h3>System oversight with audit-ready visibility.</h3>
        <p>
          Track users, records, and activity from one controlled prototype workspace while keeping
          patient symptom data protected.
        </p>
        <div className="role-command-actions">
          <button onClick={() => onNavigate("users")} type="button">
            <UsersRound size={16} />
            Users
          </button>
          <button onClick={() => onNavigate("reports")} type="button">
            <BarChart3 size={16} />
            Reports
          </button>
          <button onClick={() => onNavigate("audit")} type="button">
            <ShieldCheck size={16} />
            Audit
          </button>
        </div>
      </div>

      <div className="admin-visual-zone">
        <img className="role-picture" src={adminVisual} alt="Admin analytics dashboard illustration" />
        <div className="admin-stat-strip">
          <MiniStat label="Users" value={totals.users || 0} />
          <MiniStat label="Patients" value={totals.patients || 0} />
          <MiniStat label="Records" value={totals.symptomRecords || 0} />
        </div>
      </div>
    </section>
  );
}

function NurseCommand({ totals, onNavigate }) {
  return (
    <section className="role-command role-command-nurse nurse-command-layout">
      <div className="nurse-flow-board">
        <img className="role-picture" src={nurseVisual} alt="Nurse intake workflow illustration" />
        <div className="intake-steps">
          <FlowNode icon={<UserPlus size={16} />} label="Register" />
          <FlowNode icon={<ClipboardPlus size={16} />} label="Capture" />
          <FlowNode icon={<CheckCircle2 size={16} />} label="Ready" />
        </div>
      </div>

      <div className="role-command-main">
        <span className="role-command-kicker">
          <ClipboardPlus size={18} />
          Nurse intake
        </span>
        <h3>Move quickly from patient details to symptom capture.</h3>
        <p>
          The nurse workspace is structured around intake speed: create the patient record, capture
          the symptom story, and keep the timeline available for review.
        </p>
        <div className="role-command-actions">
          <button onClick={() => onNavigate("register")} type="button">
            <UserPlus size={16} />
            Register
          </button>
          <button onClick={() => onNavigate("vitals")} type="button">
            <HeartPulse size={16} />
            Vitals
          </button>
          <button onClick={() => onNavigate("capture")} type="button">
            <ClipboardPlus size={16} />
            Capture
          </button>
          <button onClick={() => onNavigate("records")} type="button">
            <FileSearch size={16} />
            Records
          </button>
        </div>
        <div className="nurse-mini-queue">
          <MiniStat label="Patients" value={totals.patients || 0} />
          <MiniStat label="Records" value={totals.symptomRecords || 0} />
          <MiniStat label="Vitals" value={totals.vitals || 0} />
        </div>
      </div>
    </section>
  );
}

function DoctorCommand({ totals, onNavigate }) {
  return (
    <section className="role-command role-command-doctor doctor-command-layout">
      <div className="role-command-main">
        <span className="role-command-kicker">
          <Stethoscope size={18} />
          Clinical review
        </span>
        <h3>Review structured symptoms beside patient history.</h3>
        <p>
          The doctor workspace emphasizes retrieval, extracted symptom detail, and progression over
          time without making diagnostic claims.
        </p>
        <div className="doctor-review-cards">
          <ReviewCard label="Raw note" value="Patient-reported text" />
          <ReviewCard label="NLP output" value="Symptoms, duration, severity" />
          <ReviewCard label="Timeline" value="Progression across visits" />
        </div>
        <div className="role-command-actions">
          <button onClick={() => onNavigate("review")} type="button">
            <FileSearch size={16} />
            Review
          </button>
          <button onClick={() => onNavigate("timeline")} type="button">
            <CalendarClock size={16} />
            Timeline
          </button>
          <button onClick={() => onNavigate("reports")} type="button">
            <BarChart3 size={16} />
            Reports
          </button>
        </div>
      </div>

      <div className="doctor-visual-zone">
        <img className="role-picture" src={doctorVisual} alt="Doctor patient review illustration" />
        <div className="doctor-timeline-mini">
          <span>Records</span>
          <strong>{totals.symptomRecords || 0}</strong>
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FlowNode({ icon, label }) {
  return (
    <div className="process-node">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ReviewCard({ label, value }) {
  return (
    <div className="review-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
