import { useMemo, useState } from "react";

import { StaffSecurityPage } from "../../shared/security/StaffSecurityPage.jsx";
import { WorkspaceShell } from "../../shared/shell/WorkspaceShell.jsx";
import { NurseOverviewPage } from "./NurseOverviewPage.jsx";
import { NursePatientRecordsPage } from "./NursePatientRecordsPage.jsx";
import { NursePatientsPage } from "./NursePatientsPage.jsx";

const pageDetails = {
  overview: {
    label: "Nurse Workspace",
    title: "Clinical Assessment and Patient Records",
    description:
      "Open reception-created patient records, run quick assessments, and keep patient histories clean."
  },
  assess: {
    label: "Current Clinical Work",
    title: "Quick Assessment",
    description:
      "Find the patient record created by reception, record vitals, capture the complaint, use NLP, then treat or send to doctor."
  },
  records: {
    label: "Digital Patient Records",
    title: "Patient Records",
    description:
      "Search permanent patient profiles and review previous visits, vital signs, prescriptions, and symptom records."
  },
  security: {
    label: "Account Management",
    title: "Security Settings",
    description:
      "Manage your password and review the security of your staff account."
  }
};

export function NurseDashboard({ user, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState("overview");

  const currentPage = useMemo(
    () => pageDetails[activeTab] || pageDetails.overview,
    [activeTab]
  );

  function renderActivePage() {
    switch (activeTab) {
      case "assess":
        return <NursePatientsPage user={user} />;

      case "records":
        return <NursePatientRecordsPage user={user} />;

      case "security":
        return (
          <StaffSecurityPage
            user={user}
            onUserUpdated={onUserUpdated}
          />
        );

      case "overview":
      default:
        return <NurseOverviewPage onNavigate={setActiveTab} />;
    }
  }

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onNavigate={setActiveTab}
      user={user}
      onLogout={onLogout}
      title="Clinical Records System"
    >
      <main className="nurse-portal">
        <header className="nurse-portal-header">
          <span className="nurse-portal-label">{currentPage.label}</span>
          <h1>{currentPage.title}</h1>
          <p>{currentPage.description}</p>
        </header>

        <section className="nurse-portal-content">
          {renderActivePage()}
        </section>
      </main>
    </WorkspaceShell>
  );
}
