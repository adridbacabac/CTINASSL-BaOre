const ADMIN_ONLY = new Set(["/activity", "/team"]);
const KNOWN_PAGES = new Set(["/dashboard", "/inventory", "/activity", "/team"]);

export function isSessionPending(status) {
  return status === "loading" || status === "error";
}

export function landingPath(status) {
  return status === "authenticated" ? "/dashboard" : "/login";
}

export function protectPath(status, role, path) {
  if (isSessionPending(status)) return "wait";
  if (status !== "authenticated") return path === "/login" ? "show-login" : "redirect-login";
  if (path === "/login" || path === "/") return "redirect-dashboard";
  if (!KNOWN_PAGES.has(path)) return "redirect-dashboard";
  if (ADMIN_ONLY.has(path) && role !== "admin") return "redirect-dashboard";
  return "allow";
}
