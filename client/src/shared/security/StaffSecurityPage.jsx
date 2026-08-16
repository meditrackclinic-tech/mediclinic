import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { apiRequest, updateSavedUser } from "../../api.js";
import { PageSectionHeader } from "../ui/PageSectionHeader.jsx";

const blankForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function StaffSecurityPage({ user, onUserUpdated = () => {} }) {
  const [form, setForm] = useState(blankForm);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }

    try {
      const data = await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });

      updateSavedUser(data.user);
      onUserUpdated(data.user);
      setForm(blankForm);
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="page-stack">
      <section className="panel security-panel">
        <PageSectionHeader
          label="Security"
          title="Account Protection"
          description="Change your password regularly and keep your staff credentials private."
        />

        <div className="security-layout">
          <div className="security-profile-card">
            <ShieldCheck size={24} />
            <div>
              <span>Signed in as</span>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>

          <form className="security-form" onSubmit={handleSubmit}>
            <label>
              Current password
              <input
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
                type="password"
                required
              />
            </label>
            <label>
              New password
              <input
                autoComplete="new-password"
                minLength={8}
                value={form.newPassword}
                onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
                type="password"
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                autoComplete="new-password"
                minLength={8}
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                type="password"
                required
              />
            </label>
            <button type="submit">
              <KeyRound size={18} />
              Change password
            </button>
          </form>
        </div>

        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="panel security-note-panel">
        <LockKeyhole size={20} />
        <div>
          <strong>Temporary passwords are not permanent access.</strong>
          <p>
            When an admin resets a staff password, the account is forced to change it again at
            the next login.
          </p>
        </div>
      </section>
    </section>
  );
}
