const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000";

export function apiBaseUrl(env = import.meta.env ?? {}) {
  const configured = typeof env.VITE_API_BASE_URL === "string" ? env.VITE_API_BASE_URL.trim() : "";
  return (configured || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function normalizeUser(user) {
  if (!user || typeof user !== "object") return null;
  if (typeof user.id !== "string" || (user.role !== "admin" && user.role !== "user")) return null;
  return {
    id: user.id,
    name: typeof user.name === "string" ? user.name : "",
    username: typeof user.username === "string" ? user.username : "",
    email: typeof user.email === "string" ? user.email : "",
    role: user.role,
  };
}

function safeMessage(status, payload, fallback) {
  if (status === 0) return "The store server could not be reached. Try again.";
  if (status === 429) return "Too many sign-in attempts. Wait a moment and try again.";
  if (status >= 500) return fallback;
  if (payload && typeof payload.error === "string" && payload.error.length > 0 && payload.error.length <= 160) {
    return payload.error;
  }
  return fallback;
}

export async function requestJson(path, { method = "GET", body } = {}, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const baseUrl = apiBaseUrl(dependencies.env);
  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload,
        error: safeMessage(response.status, payload, "The store server had a problem. Try again."),
      };
    }
    return { ok: true, status: response.status, payload, error: "" };
  } catch {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: "The store server could not be reached. Try again.",
    };
  }
}

export function interpretSession(result) {
  if (result.ok) {
    const user = normalizeUser(result.payload?.user);
    if (!user) {
      return { status: "error", user: null, message: "The store server sent an unexpected response." };
    }
    return { status: "authenticated", user, message: "" };
  }
  if (result.status === 401) return { status: "unauthenticated", user: null, message: "" };
  return { status: "error", user: null, message: result.error };
}

export async function loginRequest(username, password, dependencies) {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: { username, password },
  }, dependencies);
  if (!result.ok) {
    const error = result.status === 401
      ? "Those sign-in details don’t match a store account."
      : result.error;
    return { ok: false, status: result.status, error };
  }
  const user = normalizeUser(result.payload?.user);
  if (!user) return { ok: false, status: result.status, error: "The store server sent an unexpected response." };
  return { ok: true, status: result.status, user };
}

export async function logoutRequest(dependencies) {
  const result = await requestJson("/api/auth/logout", { method: "POST" }, dependencies);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    error: result.status === 0
      ? result.error
      : "The store server could not confirm sign-out. You are still signed in.",
  };
}

export async function currentUserRequest(dependencies) {
  return interpretSession(await requestJson("/api/auth/me", {}, dependencies));
}

let sessionPromise = null;

export function restoreSession(dependencies) {
  if (!sessionPromise) sessionPromise = currentUserRequest(dependencies);
  return sessionPromise;
}

export function retrySession(dependencies) {
  sessionPromise = currentUserRequest(dependencies);
  return sessionPromise;
}

export function rememberSession(status, user = null) {
  sessionPromise = Promise.resolve({ status, user, message: "" });
  return sessionPromise;
}

export function clearSessionCache() {
  sessionPromise = null;
}
