import { getNurseWorkflowSummary, getReportSummary } from "../data/clinicalStore.js";
import { getAuthSessionSummary } from "../data/sessionStore.js";
import { listAuditLogs, listRoles, listUsers } from "../data/staffStore.js";
import { getEmailDeliveryStatus } from "../services/email.js";

export async function getSummaryReport(req, res) {
  const users = await listUsers();
  const summary = await getReportSummary();

  return res.json({
    totals: {
      users: users.length,
      ...summary.totals
    },
    commonSymptoms: summary.commonSymptoms,
    recentRecords: summary.recentRecords
  });
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function auditCategoryFor(action) {
  if (action.startsWith("auth.")) {
    return "access";
  }

  if (action.startsWith("user.")) {
    return "identity";
  }

  if (action.startsWith("email.")) {
    return "delivery";
  }

  if (["patient.create", "symptom.create", "vitals.create"].includes(action)) {
    return "clinical-operations";
  }

  return "other";
}

function buildAuditCategories(auditLogs) {
  const labels = {
    access: "Access sessions",
    identity: "Identity management",
    delivery: "Email delivery",
    "clinical-operations": "Clinical operations",
    other: "Other system events"
  };
  const counts = auditLogs.reduce((totals, log) => {
    const category = auditCategoryFor(log.action);
    totals[category] = (totals[category] || 0) + 1;
    return totals;
  }, {});

  return Object.entries(labels).map(([id, label]) => ({
    id,
    label,
    value: counts[id] || 0
  }));
}

function buildAccessTrend(auditLogs) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en", { weekday: "short" }),
      value: 0
    };
  });
  const dayByKey = new Map(days.map((day) => [day.key, day]));

  for (const log of auditLogs) {
    if (!log.action.startsWith("auth.") && !log.action.startsWith("user.")) {
      continue;
    }

    const key = new Date(log.createdAt).toISOString().slice(0, 10);
    const day = dayByKey.get(key);

    if (day) {
      day.value += 1;
    }
  }

  return days;
}

function buildRiskQueue({ email, pendingPasswordChanges, inactiveAccounts, roleCounts, sessions }) {
  return [
    {
      label: "Password rotation",
      severity: pendingPasswordChanges ? "high" : "good",
      value: pendingPasswordChanges,
      detail: pendingPasswordChanges
        ? "Staff still using temporary credentials"
        : "No temporary passwords pending"
    },
    {
      label: "Admin boundary",
      severity: roleCounts.admin === 1 ? "good" : "critical",
      value: roleCounts.admin || 0,
      detail: roleCounts.admin === 1 ? "Single protected admin enforced" : "Review admin count immediately"
    },
    {
      label: "Email delivery",
      severity: email.configured ? "good" : "medium",
      value: email.configured ? 1 : 0,
      detail: email.configured ? "Credential emails configured" : "SMTP not configured"
    },
    {
      label: "Dormant access",
      severity: inactiveAccounts ? "medium" : "good",
      value: inactiveAccounts,
      detail: inactiveAccounts ? "Inactive accounts remain in directory" : "No dormant accounts"
    },
    {
      label: "Session surface",
      severity: sessions.active > 5 ? "medium" : "good",
      value: sessions.active,
      detail: "Currently valid backend sessions"
    }
  ];
}

export async function getAdminSystemReport(req, res) {
  const [users, roles, sessions, auditLogs] = await Promise.all([
    listUsers(),
    listRoles(),
    getAuthSessionSummary(),
    listAuditLogs()
  ]);
  const email = getEmailDeliveryStatus();
  const roleCounts = countBy(users, "role");
  const activeAccounts = users.filter((user) => user.status === "active").length;
  const inactiveAccounts = users.filter((user) => user.status === "inactive").length;
  const pendingPasswordChanges = users.filter((user) => user.mustChangePassword).length;
  const auditActionCounts = countBy(auditLogs, "action");
  const singleAdminHealthy = roleCounts.admin === 1;
  const securityScore = clamp(
    100 -
      pendingPasswordChanges * 8 -
      (email.configured ? 0 : 12) -
      (singleAdminHealthy ? 0 : 35) -
      Math.max(sessions.active - 5, 0) * 3
  );
  const readinessScore = clamp(
    Math.round(
      [
        users.length > 0 ? 25 : 0,
        activeAccounts > 0 ? 20 : 0,
        email.configured ? 20 : 8,
        singleAdminHealthy ? 20 : 0,
        auditLogs.length > 0 ? 15 : 5
      ].reduce((sum, value) => sum + value, 0)
    )
  );
  const riskQueue = buildRiskQueue({
    email,
    pendingPasswordChanges,
    inactiveAccounts,
    roleCounts,
    sessions
  });

  return res.json({
    generatedAt: new Date().toISOString(),
    securityScore,
    readinessScore,
    totals: {
      staffAccounts: users.length,
      activeAccounts,
      inactiveAccounts,
      pendingPasswordChanges,
      roleGroups: roles.length,
      activeSessions: sessions.active,
      revokedSessions: sessions.revoked,
      expiredSessions: sessions.expired,
      auditEvents: auditLogs.length
    },
    roleDistribution: roles.map((role) => ({
      label: role.name,
      role: role.id,
      value: roleCounts[role.id] || 0
    })),
    accountSecurity: [
      {
        label: "Active accounts",
        value: percentage(activeAccounts, users.length)
      },
      {
        label: "Inactive accounts",
        value: percentage(inactiveAccounts, users.length)
      },
      {
        label: "Password change pending",
        value: percentage(pendingPasswordChanges, users.length)
      }
    ],
    sessions,
    audit: {
      byAction: Object.entries(auditActionCounts)
        .map(([action, value]) => ({ action, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      recent: auditLogs.slice(0, 8).map((log) => ({
        id: log.id,
        action: log.action,
        userName: log.userName,
        userRole: log.userRole,
        createdAt: log.createdAt
      })),
      categories: buildAuditCategories(auditLogs),
      trend: buildAccessTrend(auditLogs)
    },
    controlMatrix: [
      {
        label: "Role-based access",
        status: "operational",
        value: percentage(activeAccounts, users.length),
        detail: `${activeAccounts} active staff accounts`
      },
      {
        label: "Session revocation",
        status: "operational",
        value: 100,
        detail: "Logout invalidates backend sessions"
      },
      {
        label: "Credential delivery",
        status: email.configured ? "operational" : "attention",
        value: email.configured ? 100 : 40,
        detail: email.configured ? "SMTP configured" : "Console fallback mode"
      },
      {
        label: "Audit accountability",
        status: auditLogs.length ? "operational" : "attention",
        value: auditLogs.length ? 100 : 30,
        detail: `${auditLogs.length} recent audit events`
      }
    ],
    riskQueue,
    email,
    securityChecks: [
      {
        label: "Single system admin",
        status: roleCounts.admin === 1 ? "good" : "review",
        detail: `${roleCounts.admin || 0} admin account${roleCounts.admin === 1 ? "" : "s"} found`
      },
      {
        label: "SMTP delivery",
        status: email.configured ? "good" : "review",
        detail: email.configured ? "Staff credentials are emailed" : "Emails are not fully configured"
      },
      {
        label: "Session control",
        status: "good",
        detail: `${sessions.active} active session${sessions.active === 1 ? "" : "s"}`
      },
      {
        label: "Password changes",
        status: pendingPasswordChanges ? "review" : "good",
        detail: `${pendingPasswordChanges} staff account${pendingPasswordChanges === 1 ? "" : "s"} pending`
      }
    ],
    adminBoundaries: [
      "Admin dashboard is limited to access control, security, sessions, email delivery, and audit activity.",
      "Clinical symptom details and patient timelines are kept in clinical workspaces.",
      "Audit events show accountability without exposing diagnostic conclusions."
    ]
  });
}

export async function getNurseWorkflowReport(req, res) {
  return res.json(await getNurseWorkflowSummary());
}
