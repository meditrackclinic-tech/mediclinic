import { BadgeCheck, Phone, UserPlus } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "../../../api.js";
import { PageSectionHeader } from "../../ui/PageSectionHeader.jsx";

const emptyPatient = {
  firstName: "",
  lastName: "",
  age: "",
  gender: "",
  contact: ""
};

export function PatientRegistrationForm({ onCreated }) {
  const [newPatient, setNewPatient] = useState(emptyPatient);

  async function handleCreatePatient(event) {
    event.preventDefault();
    const data = await apiRequest("/patients", {
      method: "POST",
      body: JSON.stringify({
        ...newPatient,
        age: newPatient.age ? Number(newPatient.age) : undefined
      })
    });
    setNewPatient(emptyPatient);
    onCreated(data.patient);
  }

  return (
    <section className="panel nurse-intake-panel">
      <PageSectionHeader
        label="Patient intake"
        title="Register Patient"
        description="Create the patient record before vitals and symptom notes are attached."
      />
      <form onSubmit={handleCreatePatient} className="nurse-registration-grid" autoComplete="off">
        <label>
          First name
          <input
            autoComplete="off"
            name="patient-first-name"
            placeholder="First name"
            value={newPatient.firstName}
            onChange={(event) => setNewPatient({ ...newPatient, firstName: event.target.value })}
            required
          />
        </label>
        <label>
          Last name
          <input
            autoComplete="off"
            name="patient-last-name"
            placeholder="Last name"
            value={newPatient.lastName}
            onChange={(event) => setNewPatient({ ...newPatient, lastName: event.target.value })}
            required
          />
        </label>
        <label>
          Age
          <input
            placeholder="Age"
            type="number"
            min="0"
            value={newPatient.age}
            onChange={(event) => setNewPatient({ ...newPatient, age: event.target.value })}
          />
        </label>
        <label>
          Gender
          <input
            autoComplete="off"
            placeholder="Gender"
            value={newPatient.gender}
            onChange={(event) => setNewPatient({ ...newPatient, gender: event.target.value })}
          />
        </label>
        <label>
          Contact
          <input
            autoComplete="off"
            placeholder="Contact number"
            value={newPatient.contact}
            onChange={(event) => setNewPatient({ ...newPatient, contact: event.target.value })}
          />
        </label>
        <div className="nurse-intake-checklist">
          <span>
            <BadgeCheck size={15} />
            Confirm identity
          </span>
          <span>
            <Phone size={15} />
            Capture contact if available
          </span>
        </div>
        <button type="submit">
          <UserPlus size={18} />
          Create patient record
        </button>
      </form>
    </section>
  );
}
