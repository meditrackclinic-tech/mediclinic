import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { PatientList } from "./components/PatientList.jsx";
import { PatientRegistrationForm } from "./components/PatientRegistrationForm.jsx";
import { SymptomCaptureForm } from "./components/SymptomCaptureForm.jsx";
import { SymptomTimeline } from "./components/SymptomTimeline.jsx";
import { WorkspaceHeader } from "./components/WorkspaceHeader.jsx";

const modeSettings = {
  admin: {
    canRegister: true,
    canCapture: true,
    heading: "Patient Symptom Tracking",
    description: "Admin view of records, symptom capture, and temporal tracking."
  },
  capture: {
    canRegister: true,
    canCapture: true,
    heading: "Capture Patient Symptoms",
    description: "Register patients and save patient-reported symptom descriptions."
  },
  register: {
    canRegister: true,
    canCapture: false,
    heading: "Register Patients",
    description: "Create patient records before symptoms are captured."
  },
  captureOnly: {
    canRegister: false,
    canCapture: true,
    heading: "Capture Symptoms",
    description: "Select an existing patient and save a symptom description."
  },
  review: {
    canRegister: false,
    canCapture: false,
    heading: "Review Symptom History",
    description: "Search patient records and review structured symptom timelines."
  },
  timeline: {
    canRegister: false,
    canCapture: false,
    heading: "Symptom Timeline",
    description: "Review symptom progression over time for the selected patient."
  }
};

export function PatientWorkspace({ mode }) {
  const settings = modeSettings[mode] || modeSettings.capture;
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  function handleWorkspaceError(error) {
    setMessage(error.message);
  }

  async function loadWorkspace() {
    const [patientData, reportData] = await Promise.all([
      apiRequest(`/patients?q=${encodeURIComponent(search)}`),
      apiRequest("/reports/summary")
    ]);
    setPatients(patientData.patients);
    setSummary(reportData);
    if (!selectedPatientId && patientData.patients[0]) {
      setSelectedPatientId(patientData.patients[0].id);
    }
  }

  async function loadRecords(patientId) {
    if (!patientId) {
      setRecords([]);
      return;
    }
    const data = await apiRequest(`/symptoms/patient/${patientId}/timeline`);
    setRecords(data.timeline);
  }

  useEffect(() => {
    loadWorkspace().catch(handleWorkspaceError);
  }, [search]);

  useEffect(() => {
    loadRecords(selectedPatientId).catch(handleWorkspaceError);
  }, [selectedPatientId]);

  async function handlePatientCreated(patient) {
    setSelectedPatientId(patient.id);
    setMessage("Patient record created.");
    await loadWorkspace();
  }

  async function handleSymptomSaved() {
    setMessage("Symptom record saved and structured.");
    await loadRecords(selectedPatientId);
    await loadWorkspace();
  }

  return (
    <>
      <WorkspaceHeader
        heading={settings.heading}
        description={settings.description}
        search={search}
        onSearchChange={setSearch}
        summary={summary}
        onRefresh={() => loadWorkspace().catch(handleWorkspaceError)}
      />

      {message ? <p className="notice">{message}</p> : null}

      <div className="workspace-grid">
        {settings.canRegister ? (
          <PatientRegistrationForm onCreated={handlePatientCreated} />
        ) : (
          <section className="panel">
            <h3>Patient Access</h3>
            <p className="muted">Registration is managed by clinic staff in this prototype.</p>
          </section>
        )}

        <PatientList
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelect={setSelectedPatientId}
        />
      </div>

      {settings.canCapture ? (
        <SymptomCaptureForm
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={setSelectedPatientId}
          onSaved={handleSymptomSaved}
          onError={setMessage}
        />
      ) : null}

      <SymptomTimeline selectedPatient={selectedPatient} records={records} />
    </>
  );
}
