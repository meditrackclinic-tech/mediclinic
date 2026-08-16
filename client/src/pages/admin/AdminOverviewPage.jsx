import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  MailCheck,
  RotateCcw,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

export function AdminOverviewPage() {
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

  const maxRoleValue = useMemo(
    () => Math.max(...(report?.roleDistribution || []).map((item) => item.value), 1),
    [report]
  );
  const maxTrendValue = useMemo(
    () => Math.max(...(report?.audit.trend || []).map((item) => item.value), 1),
    [report]
  );

  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">System administration</span>
          <h2>
            Access &amp; audit
            <span className="pg-meta">
              <ShieldCheck size={13} />
              Security {report?.securityScore || 0} · Readiness {report?.readinessScore || 0}%
            </span>
          </h2>
          <p className="pg-sub">
            Accounts, roles, sessions, credential delivery, and audit posture. No clinical
            detail appears in this view.
          </p>
        </div>
        <div className="pg-actions">
          <button
            className="secondary"
            onClick={() => loadReport().catch((error) => setMessage(error.message))}
            type="button"
          >
            <RotateCcw size={15} />
            Refresh
          </button>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <div className="kpi-grid">
        <article className="kpi">
          <span>Staff accounts</span>
          <strong>{report?.totals.staffAccounts || 0}</strong>
          <small>{report?.totals.activeAccounts || 0} active users</small>
        </article>
        <article className="kpi">
          <span>Active sessions</span>
          <strong>{report?.totals.activeSessions || 0}</strong>
          <small>signed-in staff right now</small>
        </article>
        <article
          className={report?.totals.pendingPasswordChanges ? "kpi kpi-alert" : "kpi"}
        >
          <span>Password pending</span>
          <strong>{report?.totals.pendingPasswordChanges || 0}</strong>
          <small>temporary credentials in use</small>
        </article>
        <article className="kpi">
          <span>Audit events</span>
          <strong>{report?.totals.auditEvents || 0}</strong>
          <small>recorded actions on file</small>
        </article>
      </div>

      <div className="work-grid">
        <div className="work-col">
          <article className="panel">
            <div className="ph-card-head">
              <strong>Role distribution</strong>
              <span>identity</span>
            </div>
            {(report?.roleDistribution || []).map((item) => (
              <div className="bar-row" key={item.role}>
                <span>{item.label}</span>
                <div>
                  <i style={{ "--bar-w": `${Math.max((item.value / maxRoleValue) * 100, 8)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </article>

          <article className="panel">
            <div className="ph-card-head">
              <strong>Identity activity</strong>
              <span>7-day trend</span>
            </div>
            <div className="trend-cols">
              {(report?.audit.trend || []).map((item) => (
                <div key={item.key}>
                  <strong>{item.value}</strong>
                  <i style={{ "--col-h": `${Math.max((item.value / maxTrendValue) * 100, 8)}%` }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="work-col">
          <article className="panel">
            <div className="ph-card-head">
              <strong>Risk signals</strong>
              <span>review first</span>
            </div>
            {(report?.riskQueue || []).map((item) => (
              <div className="note-row" key={item.label}>
                {item.severity === "good" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} style={{ color: "#a15c07" }} />
                )}
                <span>
                  <strong>
                    {item.label} — {item.value}
                  </strong>
                  {item.detail}
                </span>
              </div>
            ))}
          </article>

          <article className="panel">
            <div className="ph-card-head">
              <strong>Security controls</strong>
              <span>posture</span>
            </div>
            {(report?.controlMatrix || []).map((control) => (
              <div className="bar-row" key={control.label}>
                <span>{control.label}</span>
                <div>
                  <i style={{ "--bar-w": `${control.value}%` }} />
                </div>
                <strong>{control.value}</strong>
              </div>
            ))}
          </article>

          <article className="panel">
            <div className="ph-card-head">
              <strong>Service state</strong>
              <span>credentials</span>
            </div>
            <div className="note-row">
              <MailCheck size={16} />
              <span>
                <strong>{report?.email.configured ? "SMTP active" : "SMTP attention needed"}</strong>
                {report?.email.message || "Checking email delivery status."}
              </span>
            </div>
            <div className="note-row">
              <KeyRound size={16} />
              <span>
                <strong>
                  {report?.sessions.expired || 0} expired · {report?.totals.revokedSessions || 0}{" "}
                  revoked sessions
                </strong>
                Tokens past their allowed lifetime or invalidated.
              </span>
            </div>
            <div className="note-row">
              <UsersRound size={16} />
              <span>
                <strong>Generated {formatDate(report?.generatedAt)}</strong>
                Auto-refreshes every 30 seconds.
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
