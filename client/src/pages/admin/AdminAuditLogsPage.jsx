import { ChevronLeft, ChevronRight, RotateCcw, ScrollText, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { EmptyState } from "../../shared/ui/EmptyState.jsx";
import { MetricCard } from "../../shared/ui/MetricCard.jsx";
import { PageSectionHeader } from "../../shared/ui/PageSectionHeader.jsx";

const pageSize = 8;

function actionLabel(action) {
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

function actionCategory(action) {
  if (action.startsWith("auth.")) return "access";
  if (action.startsWith("user.")) return "identity";
  if (action.startsWith("email.")) return "delivery";
  if (["patient.create", "symptom.create", "vitals.create"].includes(action)) return "clinical";
  return "other";
}

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");

  async function loadLogs() {
    setMessage("");
    const data = await apiRequest("/audit-logs");
    setLogs(data.logs);
  }

  useEffect(() => {
    loadLogs().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [category, search]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesCategory = category === "all" || actionCategory(log.action) === category;
      const matchesSearch =
        !query ||
        [log.action, actionLabel(log.action), log.userName, log.userRole]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [category, logs, search]);

  const totalPages = Math.max(Math.ceil(filteredLogs.length / pageSize), 1);
  const visibleLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);
  const accessEvents = logs.filter((log) => actionCategory(log.action) === "access").length;
  const identityEvents = logs.filter((log) => actionCategory(log.action) === "identity").length;

  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">Audit control</span>
          <h2>Audit log</h2>
          <p className="pg-sub">
            Search accountability events with category filters and pagination.
          </p>
        </div>
        <div className="pg-actions">
          <button
            className="secondary"
            onClick={() => loadLogs().catch((error) => setMessage(error.message))}
            type="button"
          >
            <RotateCcw size={15} />
            Refresh
          </button>
        </div>
      </header>

      <div className="analytics-grid">
        <MetricCard label="Shown events" value={filteredLogs.length} detail="After filters" />
        <MetricCard label="Access events" value={accessEvents} detail="Login/session activity" tone="green" />
        <MetricCard label="Identity events" value={identityEvents} detail="User administration" tone="blue" />
      </div>

      <section className="panel">
        <PageSectionHeader
          label="Security"
          title="Audit Console"
          description="A compact, paginated view of accountability events. Use filters instead of scrolling through long lists."
        />
        {message ? <p className="notice">{message}</p> : null}

        <div className="admin-toolbar audit-toolbar advanced-audit-toolbar">
          <label>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search audit actions"
            />
          </label>
          <label>
            <ScrollText size={16} />
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              <option value="access">Access</option>
              <option value="identity">Identity</option>
              <option value="delivery">Email delivery</option>
              <option value="clinical">Clinical operations</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button
            className="secondary action-small"
            onClick={() => loadLogs().catch((error) => setMessage(error.message))}
            type="button"
          >
            <RotateCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="audit-console">
          {visibleLogs.map((log) => (
            <article className="audit-console-row" key={log.id}>
              <div className="audit-icon">
                <ScrollText size={18} />
              </div>
              <div>
                <strong>{actionLabel(log.action)}</strong>
                <p>
                  {log.userName || "Unknown user"} - {log.userRole || "unknown role"}
                </p>
              </div>
              <span className="status-pill">{actionCategory(log.action)}</span>
              <time>{new Date(log.createdAt).toLocaleString()}</time>
            </article>
          ))}
        </div>

        {!visibleLogs.length && !message ? (
          <EmptyState
            title="No audit events found"
            text="Try another category or search term."
          />
        ) : null}

        <div className="audit-pagination">
          <button
            className="secondary action-small"
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            type="button"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary action-small"
            disabled={page === totalPages}
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            type="button"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="insight-strip">
        <ShieldCheck size={20} />
        <span>Audit logs are compact by design: filter, page, and review the signal first.</span>
      </div>
    </section>
  );
}
