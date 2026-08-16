import { useMemo, useState } from "react";
import { StaffSecurityPage } from "../../shared/security/StaffSecurityPage.jsx";
import { WorkspaceShell } from "../../shared/shell/WorkspaceShell.jsx";
import { ReceptionistOverviewPage } from "./ReceptionistOverviewPage.jsx";
import { ReceptionistPatientsPage } from "./ReceptionistPatientsPage.jsx";

const pageDetails = {
  overview: {
    label: "Front Desk Dashboard",
    title: "Receptionist Workspace",
    description:
      "Search existing patient records, create new records only when needed, and prepare patients for nurse assessment."
  },
  patients: {
    label: "Patient Identity",
    title: "Patient Records",
    description:
      "Find or create the one long-term digital patient record before clinical assessment starts."
  },
  security: {
    label: "Account Management",
    title: "Security Settings",
    description: "Manage your password and review the security of your staff account."
  }
};

export function ReceptionistDashboard({ user, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState("overview");
  const currentPage = useMemo(
    () => pageDetails[activeTab] || pageDetails.overview,
    [activeTab]
  );

  function renderActivePage() {
    switch (activeTab) {
      case "patients":
        return <ReceptionistPatientsPage />;

      case "security":
        return <StaffSecurityPage user={user} onUserUpdated={onUserUpdated} />;

      case "overview":
      default:
        return <ReceptionistOverviewPage onNavigate={setActiveTab} />;
    }
  }

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onNavigate={setActiveTab}
      user={user}
      onLogout={onLogout}
      title="Receptionist Records System"
    >
      <main className="page-stack receptionist-workspace">
        <section className="panel admin-page-hero">
          <div>
            <span className="section-label">{currentPage.label}</span>
            <h3>{currentPage.title}</h3>
            <p>{currentPage.description}</p>
          </div>
        </section>

        {renderActivePage()}
      </main>
    </WorkspaceShell>
  );
}
