import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { apiRequest, saveSession } from "../../api.js";

export function LoginPage({ onLogin, onBack }) {
  const [login, setLogin] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const session = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(login)
      });
      saveSession(session);
      onLogin(session.user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="lg">
      <header className="lg-top">
        <span className="lz-wordmark">
          MediTrack <em>NLP</em>
        </span>
        <button className="lg-back" onClick={onBack} type="button">
          <ArrowLeft size={15} />
          Back to home
        </button>
      </header>

      <section className="lg-stage">
        <figure className="lg-card">
          <span className="lg-stamp">AUTHORIZED · STAFF ONLY</span>

          <h1 className="lg-title">Staff sign in</h1>
          <p className="lg-sub">
            Use the email and password assigned to your staff account.
          </p>

          <form onSubmit={handleLogin} className="lg-form" autoComplete="off">
            <div className="login-autofill-decoys" aria-hidden="true">
              <input autoComplete="username" name="username" tabIndex="-1" type="email" />
              <input
                autoComplete="current-password"
                name="password"
                tabIndex="-1"
                type="password"
              />
            </div>

            <label className="lg-field">
              <span>Email</span>
              <input
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                name="staff-access-id"
                value={login.email}
                onChange={(event) => setLogin({ ...login, email: event.target.value })}
                type="email"
                required
              />
            </label>

            <label className="lg-field">
              <span>Password</span>
              <input
                autoComplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
                name="staff-access-key"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                type="password"
                required
              />
            </label>

            <button className="lg-submit" type="submit">
              Open workspace
              <ArrowRight size={16} />
            </button>
          </form>

          {message ? <p className="lg-error">{message}</p> : null}

          <figcaption className="lg-caption">
            The system opens the workspace for your role — reception, nurse,
            doctor, or admin. Every action is recorded in the audit log.
          </figcaption>
        </figure>

        <p className="lg-footline">
          Records, not diagnosis · Khomas Region, Namibia
        </p>
      </section>
    </main>
  );
}
