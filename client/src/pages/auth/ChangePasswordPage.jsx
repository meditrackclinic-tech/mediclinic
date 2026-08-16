import { KeyRound, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { apiRequest, updateSavedUser } from "../../api.js";
import clinicalSystemVisual from "../../assets/clinical-system-visual.svg";

export function ChangePasswordPage({ user, onPasswordChanged, onLogout }) {
  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }

    try {
      const data = await apiRequest("/auth/first-login-password", {
        method: "POST",
        body: JSON.stringify({
          newPassword: form.newPassword
        })
      });
      updateSavedUser(data.user);
      onPasswordChanged(data.user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-row">
          <Stethoscope size={28} />
          <div>
            <h1>MediTrack NLP</h1>
            <p>Secure first sign-in.</p>
          </div>
        </div>
        <button className="text-button" onClick={onLogout} type="button">
          Sign out
        </button>

        <div className="password-change-callout">
          <KeyRound size={20} />
          <div>
            <strong>Change your temporary password</strong>
            <p>{user.name}, create a private password before entering the workspace.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            New password
            <input
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
              minLength={8}
              type="password"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              minLength={8}
              type="password"
              required
            />
          </label>
          <button type="submit">
            <ShieldCheck size={18} />
            Save password
          </button>
        </form>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="login-visual-panel" aria-label="Security preview">
        <div>
          <span>Staff account protection</span>
          <h2>Temporary passwords should not stay active.</h2>
          <p>Each new staff member must set a private password before using the clinical workspace.</p>
        </div>
        <img src={clinicalSystemVisual} alt="Secure clinical dashboard preview" />
        <div className="login-feature-row">
          <span>Role-based</span>
          <span>Audit logged</span>
          <span>Postgres ready</span>
        </div>
      </section>
    </main>
  );
}
