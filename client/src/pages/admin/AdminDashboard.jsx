import { useState } from "react";
import { StaffSecurityPage } from "../../shared/security/StaffSecurityPage.jsx";
import { WorkspaceShell } from "../../shared/shell/WorkspaceShell.jsx";
import { AdminAuditLogsPage } from "./AdminAuditLogsPage.jsx";
import { AdminOverviewPage } from "./AdminOverviewPage.jsx";
import { AdminReportsPage } from "./AdminReportsPage.jsx";
import { AdminUsersPage } from "./AdminUsersPage.jsx";

export function AdminDashboard({ user, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onNavigate={setActiveTab}
      user={user}
      onLogout={onLogout}
      title="Admin Workspace"
    >
      {activeTab === "security" ? (
        <StaffSecurityPage user={user} onUserUpdated={onUserUpdated} />
      ) : (
        <>
          {activeTab === "overview" ? <AdminOverviewPage /> : null}
          {activeTab === "users" ? <AdminUsersPage /> : null}
          {activeTab === "reports" ? <AdminReportsPage /> : null}
          {activeTab === "audit" ? <AdminAuditLogsPage /> : null}
        </>
      )}
    </WorkspaceShell>
  );
}
