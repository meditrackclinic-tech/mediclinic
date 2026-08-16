const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "symptom-record-token";
const USER_KEY = "symptom-record-user";
const SESSION_KEY = "symptom-record-session";

function clearLegacyLocalStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getSessionExpiry() {
  const value = sessionStorage.getItem(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value).expiresAt || null;
  } catch {
    return null;
  }
}

function isStoredSessionExpired() {
  const expiresAt = getSessionExpiry();
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

export async function apiRequest(path, options = {}) {
  const token = getSessionToken();
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    console.error("[api-network-error]", {
      path,
      method: options.method || "GET",
      message: error.message
    });
    throw new Error("Could not reach the backend server. Make sure npm.cmd run dev:reset is still running.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || "Request failed.";

    console.error("[api-error]", {
      path,
      method: options.method || "GET",
      status: response.status,
      statusText: response.statusText,
      message,
      response: data
    });

    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(
        new CustomEvent("symptom-record-auth-expired", {
          detail: { message }
        })
      );
    }

    const requestError = new Error(message);
    requestError.status = response.status;
    requestError.response = data;
    throw requestError;
  }

  return data;
}

export function saveSession(session) {
  clearLegacyLocalStorage();
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session.session || {}));
}

export function getSavedUser() {
  clearLegacyLocalStorage();

  if (isStoredSessionExpired()) {
    clearSession();
    return null;
  }

  const value = sessionStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) : null;
}

export function updateSavedUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  clearLegacyLocalStorage();
}

export function logoutSession({ keepalive = false } = {}) {
  const token = getSessionToken();
  clearSession();

  if (!token) {
    return Promise.resolve();
  }

  return fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    keepalive,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).catch((error) => {
    console.warn("[logout-warning]", error.message);
  });
}
