import {
  AlertTriangle,
  Filter,
  KeyRound,
  MailCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  UserRoundCog
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api.js";
import { EmptyState } from "../../shared/ui/EmptyState.jsx";
import { MetricCard } from "../../shared/ui/MetricCard.jsx";
import { PageSectionHeader } from "../../shared/ui/PageSectionHeader.jsx";

const fallbackRoles = [
  { id: "admin", name: "System Administrator" },
  { id: "receptionist", name: "Receptionist" },
  { id: "nurse", name: "Nurse" },
  { id: "doctor", name: "Doctor" }
];
const fallbackAssignableRoles = fallbackRoles.filter((role) => role.id !== "admin");

const blankUser = {
  name: "",
  email: "",
  role: "receptionist"
};

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(fallbackRoles);
  const [assignableRoles, setAssignableRoles] = useState(fallbackAssignableRoles);
  const [emailStatus, setEmailStatus] = useState(null);
  const [newUser, setNewUser] = useState(blankUser);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadAccessData() {
    const emailRequest = apiRequest("/users/email-status")
      .then((emailData) => setEmailStatus(emailData.email))
      .catch((error) =>
        setEmailStatus({
          configured: false,
          operational: false,
          message: `Email status could not be checked: ${error.message}`
        })
      );

    const [userData, roleData] = await Promise.all([
      apiRequest("/users"),
      apiRequest("/users/roles")
    ]);
    const nextAssignableRoles = roleData.assignableRoles?.length
      ? roleData.assignableRoles
      : fallbackAssignableRoles;

    setUsers(userData.users);
    setRoles(roleData.roles?.length ? roleData.roles : fallbackRoles);
    setAssignableRoles(nextAssignableRoles);
    setNewUser((current) =>
      nextAssignableRoles.some((role) => role.id === current.role)
        ? current
        : { ...current, role: nextAssignableRoles[0]?.id || "nurse" }
    );

    await emailRequest;
  }

  useEffect(() => {
    loadAccessData().catch((error) => setMessage(error.message));
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const activeUsers = users.filter((user) => user.status === "active").length;
  const roleCounts = roles.map((role) => ({
    role: role.id,
    label: role.name,
    count: users.filter((user) => user.role === role.id).length
  }));
  const maxRoleCount = Math.max(...roleCounts.map((item) => item.count), 1);

  async function handleCreateUser(event) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify(newUser)
      });
      setUsers((currentUsers) => [...currentUsers, data.user]);
      setNewUser(blankUser);
      setMessage(
        data.emailDelivery?.sent
          ? "User account created and login details were emailed."
          : `User account created, but email delivery failed${data.emailDelivery?.error ? `: ${data.emailDelivery.error}` : "."}`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleUpdateUser(userId, updates) {
    setMessage("");

    try {
      const data = await apiRequest(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === userId ? data.user : user))
      );
      setMessage("User account updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleResetPassword(user) {
    setMessage("");

    const shouldReset = window.confirm(
      `Reset the password for ${user.name}? A temporary password will be sent to ${user.email}.`
    );

    if (!shouldReset) {
      return;
    }

    try {
      const data = await apiRequest(`/users/${user.id}/reset-password`, {
        method: "POST"
      });
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) => (currentUser.id === user.id ? data.user : currentUser))
      );
      setMessage(
        data.emailDelivery?.sent
          ? "Temporary password sent to the staff email address."
          : `Temporary password reset, but email delivery failed${data.emailDelivery?.error ? `: ${data.emailDelivery.error}` : "."}`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteUser() {
    if (!deleteCandidate) {
      return;
    }

    try {
      setIsDeleting(true);
      setMessage("");
      await apiRequest(`/users/${deleteCandidate.id}`, { method: "DELETE" });
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.name}'s staff account was permanently deleted.`);
      setDeleteCandidate(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="page-stack">
      <section className="panel admin-page-hero">
        <div>
          <span className="section-label">Staff access control</span>
          <h3>Manage who can enter the system.</h3>
          <p>Create receptionist, nurse, and doctor accounts, manage access, reset passwords, or permanently remove staff accounts.</p>
        </div>
        <button
          className="secondary"
          onClick={() => loadAccessData().catch((error) => setMessage(error.message))}
          type="button"
        >
          <RotateCcw size={16} />
          Refresh
        </button>
      </section>

      <div className="analytics-grid">
        <MetricCard label="Total users" value={users.length} detail="Registered system accounts" />
        <MetricCard label="Active users" value={activeUsers} detail="Allowed to sign in" tone="gold" />
        <MetricCard
          label="Role groups"
          value={new Set(users.map((user) => user.role)).size}
          detail="Access categories"
          tone="blue"
        />
      </div>

      <section className="panel user-analytics-panel">
        <PageSectionHeader
          label="Visualization"
          title="Staff Access Distribution"
          description="A quick view of how system accounts are distributed across staff roles."
        />
        <div className="user-role-chart">
          {roleCounts.map((item) => (
            <div className="user-role-bar" key={item.role}>
              <span>{item.label}</span>
              <div>
                <i style={{ width: `${Math.max((item.count / maxRoleCount) * 100, 8)}%` }} />
              </div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
        <div
          className="user-status-ring"
          style={{ "--active-users": `${users.length ? (activeUsers / users.length) * 100 : 0}%` }}
          aria-label="Active staff ratio"
        >
          <div>
            <strong>{users.length ? Math.round((activeUsers / users.length) * 100) : 0}%</strong>
            <small>active</small>
          </div>
        </div>
      </section>

      <div className="admin-users-layout">
        <section className="panel admin-user-form-panel">
          <PageSectionHeader
            label="Create access"
            title="Add Staff User"
            description="Create receptionist, nurse, and doctor accounts. The system admin account is protected."
          />
          <div className={emailStatus?.operational ? "email-status-card active" : "email-status-card"}>
            <MailCheck size={20} />
            <div>
              <strong>
                {emailStatus === null
                  ? "Checking email delivery"
                  : emailStatus.operational
                    ? "Email delivery active"
                    : "Email delivery unavailable"}
              </strong>
              <p>{emailStatus?.message || "Checking email delivery settings."}</p>
              {emailStatus?.configured ? (
                <span>
                  {emailStatus.host}:{emailStatus.port} {emailStatus.user ? `as ${emailStatus.user}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <div className="credential-policy-card">
            <KeyRound size={18} />
            <span>
              Temporary passwords are generated randomly for every new staff account and sent to
              the staff email address.
            </span>
          </div>
          <form className="admin-user-form" onSubmit={handleCreateUser} autoComplete="off">
            <label>
              Full name
              <input
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                name="new-staff-full-name"
                value={newUser.name}
                onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                placeholder="Example: Clinic Nurse"
                required
              />
            </label>
            <label>
              Email
              <input
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                name="new-staff-email"
                value={newUser.email}
                onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                placeholder="user@example.com"
                type="email"
                required
              />
            </label>
            <label>
              Role
              <select
                value={newUser.role}
                onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}
              >
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">
              <UserPlus size={18} />
              Create user
            </button>
          </form>
        </section>

        <section className="panel admin-user-directory">
          <PageSectionHeader
            label="Administration"
            title="User and Role Management"
            description="Search accounts, change roles, manage access, reset passwords, or delete staff accounts."
          />
          {message ? <p className="notice">{message}</p> : null}

          <div className="admin-toolbar">
            <label>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users"
              />
            </label>
            <label>
              <Filter size={16} />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <ShieldCheck size={16} />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <button
              className="secondary action-small"
              onClick={() => loadAccessData().catch((error) => setMessage(error.message))}
              type="button"
            >
              <RotateCcw size={16} />
              Refresh
            </button>
          </div>

          <div className="admin-user-list">
            {filteredUsers.map((user) => (
              <article className="admin-user-card" key={user.id}>
                <div className="profile-icon">
                  <UserRoundCog size={22} />
                </div>
                <div className="admin-user-main">
                  <strong>{user.name}</strong>
                  <p>{user.email}</p>
                  <span className={user.status === "active" ? "status-pill" : "status-pill inactive"}>
                    {user.status === "active" ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                    {user.status}
                  </span>
                  {user.mustChangePassword ? (
                    <span className="status-pill warning">
                      <KeyRound size={14} />
                      password change required
                    </span>
                  ) : null}
                </div>
                <select
                  aria-label={`Change role for ${user.name}`}
                  disabled={user.role === "admin"}
                  value={user.role}
                  onChange={(event) => handleUpdateUser(user.id, { role: event.target.value })}
                >
                  {(user.role === "admin" ? roles.filter((role) => role.id === "admin") : assignableRoles).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <div className="admin-account-actions">
                  <button
                    className="secondary action-small"
                    disabled={user.role === "admin"}
                    onClick={() =>
                      handleUpdateUser(user.id, {
                        status: user.status === "active" ? "inactive" : "active"
                      })
                    }
                    type="button"
                  >
                    {user.role === "admin" ? "Protected" : user.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="secondary action-small reset-password-button"
                    disabled={user.role === "admin"}
                    onClick={() => handleResetPassword(user)}
                    type="button"
                  >
                    <KeyRound size={15} />
                    Reset
                  </button>
                  <button
                    aria-label={`Delete account for ${user.name}`}
                    className="secondary action-small delete-account-button"
                    disabled={user.role === "admin"}
                    onClick={() => setDeleteCandidate(user)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!filteredUsers.length && !message ? (
            <EmptyState title="No users found" text="Try changing the search or filter." />
          ) : null}
        </section>
      </div>

      {deleteCandidate ? (
        <div className="account-delete-backdrop" role="presentation">
          <section
            aria-labelledby="delete-account-title"
            aria-modal="true"
            className="account-delete-dialog"
            role="dialog"
          >
            <div className="account-delete-icon">
              <AlertTriangle size={26} />
            </div>
            <span className="section-label">Permanent account removal</span>
            <h3 id="delete-account-title">Delete {deleteCandidate.name}'s account?</h3>
            <p>
              This removes the staff login and ends all of its sessions. Existing clinical records
              and audit history remain preserved.
            </p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{deleteCandidate.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{roles.find((role) => role.id === deleteCandidate.role)?.name || deleteCandidate.role}</dd>
              </div>
            </dl>
            <div className="account-delete-actions">
              <button
                className="secondary"
                disabled={isDeleting}
                onClick={() => setDeleteCandidate(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="delete-account-confirm"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                type="button"
              >
                <Trash2 size={17} />
                {isDeleting ? "Deleting account..." : "Delete Account"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
