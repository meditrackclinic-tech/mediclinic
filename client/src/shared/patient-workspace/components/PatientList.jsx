import { ClipboardList, UserRoundCheck } from "lucide-react";

export function PatientList({ patients, selectedPatientId, onSelect }) {
  return (
    <section className="panel nurse-patient-list-panel">
      <div className="nurse-list-heading">
        <div>
          <span className="section-label">Patient index</span>
          <h3>
            <ClipboardList size={18} />
            Patient List
          </h3>
        </div>
        <strong>{patients.length}</strong>
      </div>
      <div className="list">
        {patients.map((patient) => (
          <button
            className={patient.id === selectedPatientId ? "list-item active" : "list-item"}
            key={patient.id}
            onClick={() => onSelect(patient.id)}
          >
            <span className="patient-list-avatar">
              <UserRoundCheck size={16} />
            </span>
            <span>
              <strong>
                {patient.firstName} {patient.lastName}
              </strong>
              <small>{patient.age ? `${patient.age} years` : "Age not set"}</small>
            </span>
          </button>
        ))}
        {!patients.length ? <p className="muted">No patients yet.</p> : null}
      </div>
    </section>
  );
}
