import { Clock3, Printer, RotateCcw, ShieldCheck, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { EmptyState } from "../../shared/ui/EmptyState.jsx";
import { MetricCard } from "../../shared/ui/MetricCard.jsx";
import { PageSectionHeader } from "../../shared/ui/PageSectionHeader.jsx";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function adminActionLabel(action) {
  const labels = {
    "auth.login": "Staff sign-in",
    "auth.logout": "Staff sign-out",
    "auth.password_change": "Password changed",
    "auth.first_login_password_change": "First-login password changed",
    "user.create": "Staff account created",
    "user.update": "Staff account updated",
    "user.password_reset": "Password reset",
    "email.test": "Email delivery tested",
    "patient.create": "Clinical record event",
    "symptom.create": "Clinical record event",
    "vitals.create": "Clinical record event"
  };

  return labels[action] || action;
}

export function AdminReportsPage() {
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");

  async function loadReport() {
    setMessage("");
    const data = await apiRequest("/reports/admin-system");
    setReport(data);
  }

  useEffect(() => {
    loadReport().catch((error) => setMessage(error.message));
    const timer = window.setInterval(() => {
      loadReport().catch((error) => setMessage(error.message));
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const auditActions = useMemo(() => (report?.audit.byAction || []).slice(0, 5), [report]);
  const maxCategoryValue = useMemo(
    () => Math.max(...(report?.audit.categories || []).map((item) => item.value), 1),
    [report]
  );

  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">System report center</span>
          <h2>System reports</h2>
          <p className="pg-sub">
            Sessions, audit categories, email delivery, and system boundaries — technical health
            without clinical clutter.
          </p>
        </div>
        <div className="pg-actions">
          <button className="secondary" onClick={() => window.print()} type="button">
            <Printer size={15} />
            Print
          </button>
          <button onClick={() => loadReport().catch((error) => setMessage(error.message))} type="button">
            <RotateCcw size={15} />
            Refresh
          </button>
        </div>
      </header>

      <div className="analytics-grid">
        <MetricCard
          label="Security score"
          value={report?.securityScore || 0}
          detail="Identity posture"
        />
        <MetricCard
          label="Sessions"
          value={report?.sessions.total || 0}
          detail={`${report?.sessions.active || 0} active`}
          tone="green"
        />
        <MetricCard
          label="Audit events"
          value={report?.totals.auditEvents || 0}
          detail="Recent accountability records"
          tone="blue"
        />
      </div>

      {message ? <p className="notice">{message}</p> : null}

      <section className="admin-report-board">
        <article className="panel admin-command-card">
          <PageSectionHeader
            label="Executive audit summary"
            title="Event Categories"
            description="Compact grouped activity instead of long audit lists."
          />
          <div className="admin-category-chart">
            {(report?.audit.categories || []).map((item) => (
              <div className="admin-category-row" key={item.id}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${Math.max((item.value / maxCategoryValue) * 100, 5)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-command-card">
          <PageSectionHeader
            label="Top signals"
            title="Most Frequent Events"
            description="Only the highest-volume event types are shown here."
          />
          <div className="admin-signal-list">
            {auditActions.map((item, index) => (
              <div className="admin-signal-row" key={item.action}>
                <span>{index + 1}</span>
                <strong>{adminActionLabel(item.action)}</strong>
                <em>{item.value}</em>
              </div>
            ))}
          </div>
          {!auditActions.length ? (
            <EmptyState title="No audit events yet" text="System activity will appear after staff use the app." />
          ) : null}
        </article>
      </section>

      <section className="report-grid">
        <article className="panel">
          <PageSectionHeader
            label="Session control"
            title="Recent Sessions"
            description="Only recent backend sessions are shown. Full audit history is paginated on the Audit page."
          />
          <div className="activity-feed compact-feed">
            {(report?.sessions.recent || []).slice(0, 5).map((session) => (
              <div className="activity-item" key={session.id}>
                <Clock3 size={16} />
                <div>
                  <strong>
                    {session.userName} - {session.status}
                  </strong>
                  <p>Last seen {formatDate(session.lastSeenAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {!report?.sessions.recent?.length ? (
            <EmptyState title="No sessions yet" text="Session records will appear after users sign in." />
          ) : null}
        </article>

        <article className="panel">
          <PageSectionHeader
            label="Admin boundary"
            title="What The Admin Should Monitor"
            description="This page is intentionally technical and security-focused."
          />
          <div className="admin-boundary-grid compact-boundaries">
            {(report?.adminBoundaries || []).map((item) => (
              <article key={item}>
                <ShieldCheck size={18} />
                <span>{item}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="insight-strip">
        <TerminalSquare size={20} />
        <span>Admin reports summarize system operation without exposing clinical interpretation.</span>
      </section>
    </section>
  );
}
