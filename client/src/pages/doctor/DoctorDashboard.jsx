import { useState } from "react";
import { StaffSecurityPage } from "../../shared/security/StaffSecurityPage.jsx";
import { WorkspaceShell } from "../../shared/shell/WorkspaceShell.jsx";
import { DoctorOverviewPage } from "./DoctorOverviewPage.jsx";
import { DoctorContinuityPage } from "./DoctorContinuityPage.jsx";
import { DoctorPatientReviewPage } from "./DoctorPatientReviewPage.jsx";
import { DoctorReportsPage } from "./DoctorReportsPage.jsx";
import { DoctorSymptomTimelinePage } from "./DoctorSymptomTimelinePage.jsx";

export function DoctorDashboard({ user, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onNavigate={setActiveTab}
      user={user}
      onLogout={onLogout}
      title="Doctor Workspace"
    >
      {activeTab === "security" ? (
        <StaffSecurityPage user={user} onUserUpdated={onUserUpdated} />
      ) : (
        <>
          {activeTab === "overview" ? <DoctorOverviewPage onNavigate={setActiveTab} /> : null}
          {activeTab === "review" ? <DoctorPatientReviewPage /> : null}
          {activeTab === "timeline" ? <DoctorSymptomTimelinePage /> : null}
          {activeTab === "continuity" ? <DoctorContinuityPage /> : null}
          {activeTab === "reports" ? <DoctorReportsPage /> : null}
        </>
      )}
    </WorkspaceShell>
  );
}
