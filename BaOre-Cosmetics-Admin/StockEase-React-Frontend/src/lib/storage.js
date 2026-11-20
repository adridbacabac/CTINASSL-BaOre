export function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem("baore-session") || "null");
  } catch {
    return null;
  }
}
