import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Fingerprint,
  HeartPulse,
  ListFilter,
  Pill,
  Plus,
  Search,
  UserRoundCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../api.js";
import { NurseIntakePanel } from "./NurseIntakePanel.jsx";

const pageSize = 20;

const pageText = {
  assess: {
    label: "Quick Assessment",
    directoryLabel: "Find Patient Record",
    title: "Search the patient record created by reception.",
    description:
      "Open the patient record, confirm identity, then complete one nurse assessment in a single flow.",
    backLabel: "Back to Quick Assessment",
    profileLabel: "Patient profile",
    startLabel: "Start Quick Assessment"
  },
  records: {
    label: "Patient Records",
    directoryLabel: "Permanent Patient Records",
    title: "Search registered patient profiles.",
    description:
      "Review patient identity, previous assessments, vital signs, symptom history, and medicine records.",
    backLabel: "Back to Patient Records",
    profileLabel: "Patient record",
    startLabel: "Start Assessment"
  }
};

function displayDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function displayDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function patientName(patient = {}) {
  return `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unnamed patient";
}

function statusText(status) {
  const labels = {
    draft: "Assessment started",
    in_progress: "Assessment started",
    awaiting_doctor_review: "Sent to doctor",
    reviewed_by_doctor: "Doctor reviewed",
    returned_for_correction: "Correction requested",
    completed: "Completed"
  };

  return labels[status] || status?.replaceAll("_", " ") || "No visit yet";
}

function formatVitals(record = {}) {
  const systolic = record.systolic || "-";
  const diastolic = record.diastolic || "-";
  const heartRate = record.heartRate || "-";
  const respiratoryRate = record.respiratoryRate || "-";
  const oxygen = record.oxygenSaturation || "-";

  return `BP ${systolic}/${diastolic}; HR ${heartRate}; RR ${respiratoryRate}; SpO2 ${oxygen}%`;
}

export function NursePatientsPage({ mode = "assess", user }) {
  const copy = pageText[mode] || pageText.assess;
  const isRecordsMode = mode === "records";
  const [view, setView] = useState("directory");
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [profile, setProfile] = useState(null);
  const [activeVisit, setActiveVisit] = useState(null);
  const [completedAssessment, setCompletedAssessment] = useState(null);
  const [message, setMessage] = useState("");

  async function loadPatients(nextPage = page) {
    const data = await apiRequest(
      `/patients?q=${encodeURIComponent(search)}&page=${nextPage}&limit=${pageSize}`
    );
    setPatients(data.patients || []);
    setPagination(data.pagination || pagination);
  }

  async function loadProfile(patientId = selectedPatientId) {
    if (!patientId) {
      setProfile(null);
      return null;
    }

    const data = await apiRequest(`/patients/${patientId}/profile`);
    setProfile(data);
    return data;
  }

  useEffect(() => {
    loadPatients(page).catch((error) => setMessage(error.message));
  }, [search, page]);

  async function openProfile(patientId) {
    setMessage("");
    setSelectedPatientId(patientId);
    setActiveVisit(null);
    setCompletedAssessment(null);
    setView("profile");

    try {
      await loadProfile(patientId);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function startNewVisit(patientId = selectedPatientId) {
    if (!patientId) {
      setMessage("Select a patient before starting an assessment.");
      return;
    }

    try {
      setMessage("");
      const data = await apiRequest("/visits", {
        method: "POST",
        body: JSON.stringify({ patientId })
      });
      setSelectedPatientId(patientId);
      setActiveVisit(data.visit);
      setCompletedAssessment(null);
      await loadProfile(patientId);
      setView("intake");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function backToDirectory() {
    setView("directory");
    setActiveVisit(null);
    setCompletedAssessment(null);
  }

  async function backToProfile() {
    if (selectedPatientId) {
      await loadProfile(selectedPatientId).catch((error) => setMessage(error.message));
    }
    setView("profile");
  }

  async function finishAssessment(visit, completion = {}) {
    setActiveVisit(null);
    setMessage("");
    setCompletedAssessment({
      type: completion.type || "nurse_completed",
      completedAt: completion.completedAt || new Date().toISOString(),
      visitNumber: visit?.visitNumber || activeVisit?.visitNumber || "Assessment",
      patientName: visit?.patientName || (profile?.patient ? patientName(profile.patient) : "Patient"),
      patientNumber: visit?.patientNumber || profile?.patient?.patientNumber || "Patient record"
    });
    setView("completed");
    if (selectedPatientId) {
      await loadProfile(selectedPatientId).catch((error) => setMessage(error.message));
    }
    await loadPatients(page).catch((error) => setMessage(error.message));
  }

  if (view === "completed" && completedAssessment) {
    const referredToDoctor = completedAssessment.type === "doctor_queue";

    return (
      <section className="page-stack nurse-patient-command assessment-completion-page">
        <section className="panel assessment-completion-card" role="status" aria-live="polite">
          <div className="assessment-completion-icon">
            <CheckCircle2 size={42} strokeWidth={1.8} />
          </div>
          <span className="section-label">Assessment Successfully Finished</span>
          <h2>{referredToDoctor ? "Patient sent to the doctor queue." : "Patient visit completed."}</h2>
          <p>
            {referredToDoctor
              ? "The doctor can now open the nurse assessment, vital signs, and organised symptom summary."
              : "The assessment and treatment have been saved to the patient's permanent clinical record."}
          </p>

          <div className="assessment-completion-receipt">
            <div>
              <span>Patient</span>
              <strong>{completedAssessment.patientName}</strong>
              <small>{completedAssessment.patientNumber}</small>
            </div>
            <div>
              <span>Assessment record</span>
              <strong>{completedAssessment.visitNumber}</strong>
              <small>{displayDateTime(completedAssessment.completedAt)}</small>
            </div>
            <div>
              <span>Final status</span>
              <strong>{referredToDoctor ? "Waiting for doctor" : "Completed by nurse"}</strong>
              <small>Saved successfully</small>
            </div>
          </div>

          <div className="assessment-completion-actions">
            <button className="secondary" onClick={backToDirectory} type="button">
              <ArrowLeft size={18} />
              Assess Another Patient
            </button>
            <button onClick={() => setView("profile")} type="button">
              <ClipboardList size={18} />
              View Patient Record
            </button>
          </div>
        </section>
      </section>
    );
  }

  if (view === "profile") {
    const patient = profile?.patient;
    const recentVisits = (profile?.visits || [])
      .filter((visit) => !["draft", "in_progress"].includes(visit.status))
      .slice(0, 4);
    const recentVitals = (profile?.vitalsHistory || []).slice(0, 3);
    const recentSymptoms = (profile?.symptomTimeline || []).slice(-4).reverse();
    const recentMedicines = (profile?.prescriptionHistory || []).slice(0, 4);

    return (
      <section className="page-stack nurse-patient-command">
        {message ? <p className="notice">{message}</p> : null}

        {!patient ? (
          <section className="panel patient-profile-page empty-profile-page">
            <UserRoundCheck size={26} />
            <h3>Loading patient profile</h3>
            <p>Please wait while the patient record opens.</p>
          </section>
        ) : (
          <section className="panel patient-profile-page clean-patient-profile">
            <div className="patient-profile-header clean-profile-header">
              <button className="secondary" onClick={backToDirectory} type="button">
                <ArrowLeft size={18} />
                {copy.backLabel}
              </button>
              <div>
                <span className="section-label">{copy.profileLabel}</span>
                <h3>{patientName(patient)}</h3>
                <p>{patient.patientNumber || "No patient number"} | Created by reception</p>
              </div>
              {!isRecordsMode ? (
                <button onClick={() => startNewVisit(patient.id)} type="button">
                  <Plus size={18} />
                  {copy.startLabel}
                </button>
              ) : null}
            </div>

            <div className="clean-profile-grid">
              <section className="profile-identity-card">
                <div className="form-section-title">
                  <Fingerprint size={18} />
                  <strong>Identity details</strong>
                </div>
                <dl>
                  <div>
                    <dt>Patient number</dt>
                    <dd>{patient.patientNumber || "Not assigned"}</dd>
                  </div>
                  <div>
                    <dt>Age</dt>
                    <dd>{patient.age ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Date of birth</dt>
                    <dd>{displayDate(patient.dateOfBirth)}</dd>
                  </div>
                  <div>
                    <dt>Gender</dt>
                    <dd>{patient.gender || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{patient.contact || "No contact recorded"}</dd>
                  </div>
                </dl>
              </section>

              <section className="profile-clinical-summary">
                <div className="form-section-title">
                  <ClipboardList size={18} />
                  <strong>Recent clinical record</strong>
                </div>
                <div className="profile-compact-list">
                  {recentVisits.map((visit) => (
                    <article key={visit.id}>
                      <span>{visit.visitNumber}</span>
                      <strong>{statusText(visit.status)}</strong>
                      <small>{displayDateTime(visit.createdAt)}</small>
                    </article>
                  ))}
                  {!recentVisits.length ? <p>No visit history yet.</p> : null}
                </div>
              </section>
            </div>

            <div className="profile-review-grid">
              <section>
                <div className="form-section-title">
                  <HeartPulse size={18} />
                  <strong>Latest vitals</strong>
                </div>
                <div className="profile-compact-list">
                  {recentVitals.map((record) => (
                    <article key={record.id}>
                      <span>{displayDateTime(record.createdAt)}</span>
                      <strong>{formatVitals(record)}</strong>
                      {record.notes ? <small>{record.notes}</small> : null}
                    </article>
                  ))}
                  {!recentVitals.length ? <p>No vitals recorded yet.</p> : null}
                </div>
              </section>

              <section>
                <div className="form-section-title">
                  <ClipboardList size={18} />
                  <strong>Symptom history</strong>
                </div>
                <div className="profile-compact-list">
                  {recentSymptoms.map((record) => (
                    <article key={record.id}>
                      <span>{displayDate(record.date)}</span>
                      <strong>{record.symptoms?.join(", ") || "No symptom terms"}</strong>
                      <small>
                        {record.severity || "severity not set"} | {record.duration || "duration not set"}
                      </small>
                    </article>
                  ))}
                  {!recentSymptoms.length ? <p>No symptom timeline yet.</p> : null}
                </div>
              </section>

              <section>
                <div className="form-section-title">
                  <Pill size={18} />
                  <strong>Medicine history</strong>
                </div>
                <div className="profile-compact-list">
                  {recentMedicines.map((record) => (
                    <article key={record.id}>
                      <span>{displayDate(record.createdAt)}</span>
                      <strong>{record.medicationName}</strong>
                      <small>
                        {record.quantity || "quantity not recorded"}
                        {record.instructions ? ` | ${record.instructions}` : ""}
                      </small>
                    </article>
                  ))}
                  {!recentMedicines.length ? <p>No medicine issued yet.</p> : null}
                </div>
              </section>
            </div>
          </section>
        )}
      </section>
    );
  }

  if (view === "intake") {
    return (
      <section className="page-stack nurse-patient-command">
        {message ? <p className="notice">{message}</p> : null}

        <section className="panel intake-page-header clean-intake-header">
          <button className="secondary" onClick={() => backToProfile()} type="button">
            <ArrowLeft size={18} />
            Back to Profile
          </button>
          <div>
            <span className="section-label">Quick Assessment</span>
            <h3>
              {profile?.patient ? patientName(profile.patient) : "Patient assessment"}
            </h3>
            <p>Complete the assessment now. Vitals, complaint, NLP summary, and treatment decision are saved together.</p>
          </div>
        </section>

        <NurseIntakePanel
          visit={activeVisit}
          profile={profile}
          nurseName={user?.name}
          onSubmitted={finishAssessment}
        />
      </section>
    );
  }

  return (
    <section className="page-stack nurse-patient-command">
      {message ? <p className="notice">{message}</p> : null}

      <section className="panel patient-directory-command">
        <div className="patient-directory-command-header">
          <div>
            <span className="section-label">{copy.directoryLabel}</span>
            <h3>{copy.title}</h3>
            <p>{copy.description}</p>
          </div>
          {!isRecordsMode ? (
            <div className="reception-required-note">
              <UserRoundCheck size={18} />
              <span>New patient records are created by reception.</span>
            </div>
          ) : null}
        </div>

        <div className="directory-toolbar">
          <label className="search-field">
            Search patient number or name
            <span className="input-with-icon">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="PT-000001 or patient name"
              />
            </span>
          </label>
          <div className="directory-count-card">
            <ListFilter size={18} />
            <span>{pagination.total} matching profiles</span>
          </div>
        </div>

        <div className="patient-table-shell compact-patient-table">
          <div className="patient-table-header">
            <span>Patient number</span>
            <span>Patient</span>
            <span>Action</span>
          </div>
          {patients.map((patient) => (
            <article className={patient.id === selectedPatientId ? "patient-table-row active" : "patient-table-row"} key={patient.id}>
              <span>
                <Fingerprint size={15} />
                {patient.patientNumber || patient.id.slice(0, 8)}
              </span>
              <strong>{patientName(patient)}</strong>
              <div>
                <button className="secondary action-small" onClick={() => openProfile(patient.id)} type="button">
                  Open Profile
                </button>
                {!isRecordsMode ? (
                  <button className="action-small" onClick={() => startNewVisit(patient.id)} type="button">
                    Start Assessment
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!patients.length ? (
            <section className="empty-patient-directory">
              <UserRoundCheck size={24} />
              <strong>No matching patient profiles.</strong>
              <p>Reception must create the patient record before nurse assessment.</p>
            </section>
          ) : null}
        </div>

        <div className="directory-pagination">
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            type="button"
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button
            className="secondary"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages))}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </section>
  );
}
