import { useEffect, useState } from "react";
import {
  clearSession,
  getSavedUser,
  getSessionExpiry,
  getSessionToken,
  logoutSession
} from "./api.js";
import { AdminDashboard } from "./pages/admin/AdminDashboard.jsx";
import { ChangePasswordPage } from "./pages/auth/ChangePasswordPage.jsx";
import { DoctorDashboard } from "./pages/doctor/DoctorDashboard.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { NurseDashboard } from "./pages/nurse/NurseDashboard.jsx";
import { HomePage } from "./pages/public/HomePage.jsx";
import { ReceptionistDashboard } from "./pages/receptionist/ReceptionistDashboard.jsx";

const dashboardByRole = {
  admin: AdminDashboard,
  receptionist: ReceptionistDashboard,
  doctor: DoctorDashboard,
  clinician: DoctorDashboard,
  nurse: NurseDashboard,
  staff: NurseDashboard
};

const IDLE_SESSION_LIMIT_MS = 15 * 60 * 1000;

export function App() {
  const [user, setUser] = useState(() => {
    const savedUser = getSavedUser();
    if (savedUser && dashboardByRole[savedUser.role]) {
      return savedUser;
    }
    clearSession();
    return null;
  });
  const [screen, setScreen] = useState(user ? "dashboard" : "home");

  function endLocalSession(nextScreen = "login") {
    setUser(null);
    setScreen(nextScreen);
  }

  function handleLogout() {
    logoutSession();
    endLocalSession("home");
  }

  useEffect(() => {
    function handleAuthExpired(event) {
      console.warn("[auth-expired]", event.detail?.message || "Session expired.");
      clearSession();
      setUser(null);
      setScreen("login");
    }

    window.addEventListener("symptom-record-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("symptom-record-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const expiresAt = getSessionExpiry();

    if (!expiresAt) {
      logoutSession();
      endLocalSession("login");
      return undefined;
    }

    const expiresIn = new Date(expiresAt).getTime() - Date.now();

    if (expiresIn <= 0) {
      logoutSession();
      endLocalSession("login");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      logoutSession();
      endLocalSession("login");
    }, expiresIn);

    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let idleTimer;

    function endIdleSession() {
      logoutSession();
      endLocalSession("login");
    }

    function resetIdleTimer() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(endIdleSession, IDLE_SESSION_LIMIT_MS);
    }

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetIdleTimer, { passive: true })
    );
    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetIdleTimer)
      );
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    function handlePageExit() {
      logoutSession({ keepalive: true });
    }

    window.addEventListener("pagehide", handlePageExit);
    return () => window.removeEventListener("pagehide", handlePageExit);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    function verifySessionStillExists() {
      if (!getSessionToken()) {
        endLocalSession("login");
      }
    }

    window.addEventListener("pageshow", verifySessionStillExists);
    window.addEventListener("focus", verifySessionStillExists);

    return () => {
      window.removeEventListener("pageshow", verifySessionStillExists);
      window.removeEventListener("focus", verifySessionStillExists);
    };
  }, [user]);

  if (!user) {
    if (screen === "login") {
      return <LoginPage onLogin={setUser} onBack={() => setScreen("home")} />;
    }

    return <HomePage onLoginClick={() => setScreen("login")} />;
  }

  if (user.mustChangePassword) {
    return (
      <ChangePasswordPage
        user={user}
        onLogout={handleLogout}
        onPasswordChanged={(updatedUser) => setUser(updatedUser)}
      />
    );
  }

  const Dashboard = dashboardByRole[user.role] || NurseDashboard;

  return <Dashboard user={user} onLogout={handleLogout} onUserUpdated={setUser} />;
}
