import { Fingerprint, ListFilter, Plus, RefreshCcw, Search, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";

const blankPatient = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  contact: ""
};

const pageSize = 20;

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return "";
  }

  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : "";
}

function displayDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function ReceptionistPatientsPage() {
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [patientForm, setPatientForm] = useState(blankPatient);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const calculatedAge = useMemo(() => calculateAge(patientForm.dateOfBirth), [patientForm.dateOfBirth]);

  async function loadPatients(nextPage = page) {
    const data = await apiRequest(
      `/patients?q=${encodeURIComponent(search)}&page=${nextPage}&limit=${pageSize}`
    );
    setPatients(data.patients || []);
    setPagination(data.pagination || pagination);
  }

  useEffect(() => {
    loadPatients(page).catch((error) => setMessage(error.message));
  }, [search, page]);

  async function handleCreatePatient(event) {
    event.preventDefault();
    setMessage("");

    try {
      const payload = {
        firstName: patientForm.firstName.trim(),
        lastName: patientForm.lastName.trim(),
        ...(patientForm.dateOfBirth ? { dateOfBirth: patientForm.dateOfBirth } : {}),
        ...(patientForm.gender ? { gender: patientForm.gender } : {}),
        ...(patientForm.contact ? { contact: patientForm.contact.trim() } : {}),
        age: calculatedAge || undefined
      };
      const data = await apiRequest("/patients", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPatientForm(blankPatient);
      setShowCreate(false);
      setSearch(data.patient.patientNumber || `${data.patient.firstName} ${data.patient.lastName}`);
      setPage(1);
      await loadPatients(1);
      setMessage(`Patient record created: ${data.patient.patientNumber}. Send the patient to nurse quick assessment.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="page-stack receptionist-patient-page">
      {message ? <p className="notice">{message}</p> : null}

      <section className="panel receptionist-patient-command">
        <div className="patient-directory-command-header">
          <div>
            <span className="section-label">Search first</span>
            <h3>Find the existing patient before creating another record.</h3>
            <p>
              This page belongs to reception. Nurses use the patient created here to start Quick
              Assessment, record vitals, capture the complaint, and send to doctor when needed.
            </p>
          </div>
          <button onClick={() => setShowCreate((current) => !current)} type="button">
            <Plus size={18} />
            {showCreate ? "Hide Create Form" : "Create Patient"}
          </button>
        </div>

        <div className="directory-toolbar">
          <label className="search-field">
            Search patient number, name, or contact
            <span className="search-input-with-icon">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="PT-000001, name, or phone"
              />
            </span>
          </label>
          <div className="directory-count-card">
            <ListFilter size={18} />
            <span>{pagination.total} matching profiles</span>
          </div>
        </div>

        {showCreate ? (
          <form className="patient-create-card patient-registration-page" onSubmit={handleCreatePatient}>
            <div className="form-section-title">
              <UserRoundCheck size={18} />
              <strong>Create patient only after checking the list above</strong>
            </div>
            <div className="patient-create-grid">
              <label>
                First name
                <input
                  value={patientForm.firstName}
                  onChange={(event) => setPatientForm({ ...patientForm, firstName: event.target.value })}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  value={patientForm.lastName}
                  onChange={(event) => setPatientForm({ ...patientForm, lastName: event.target.value })}
                  required
                />
              </label>
              <label>
                Date of birth
                <input
                  value={patientForm.dateOfBirth}
                  onChange={(event) => setPatientForm({ ...patientForm, dateOfBirth: event.target.value })}
                  type="date"
                />
              </label>
              <label>
                Sex / gender
                <select
                  value={patientForm.gender}
                  onChange={(event) => setPatientForm({ ...patientForm, gender: event.target.value })}
                >
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label>
                Contact
                <input
                  value={patientForm.contact}
                  onChange={(event) => setPatientForm({ ...patientForm, contact: event.target.value })}
                  placeholder="Phone number or guardian contact"
                />
              </label>
              <div className="calculated-age-card">
                <span>Calculated age</span>
                <strong>{calculatedAge || "-"}</strong>
              </div>
            </div>
            <button type="submit">
              <Plus size={18} />
              Create patient record
            </button>
          </form>
        ) : null}

        <div className="patient-table-shell">
          <div className="patient-table-header">
            <span>Patient number</span>
            <span>Name</span>
            <span>Age / DOB</span>
            <span>Contact</span>
            <span>Status</span>
          </div>
          {patients.map((patient) => (
            <article className="patient-table-row" key={patient.id}>
              <span>
                <Fingerprint size={15} />
                {patient.patientNumber || patient.id.slice(0, 8)}
              </span>
              <strong>{patient.firstName} {patient.lastName}</strong>
              <span>
                {patient.age ?? "Age not set"} {patient.dateOfBirth ? `| ${displayDate(patient.dateOfBirth)}` : ""}
              </span>
              <span>{patient.contact || "No contact"}</span>
              <div>
                <span className="status-pill">
                  <UserRoundCheck size={14} />
                  Ready for nurse
                </span>
              </div>
            </article>
          ))}
          {!patients.length ? <p className="muted">No matching patient profiles. Search carefully before creating a new record.</p> : null}
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
          <button
            className="secondary"
            onClick={() => loadPatients(page).catch((error) => setMessage(error.message))}
            type="button"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </section>
    </section>
  );
}
