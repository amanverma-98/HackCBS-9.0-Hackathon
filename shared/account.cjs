// Optional online account (backend/): helpers shared by the app and its tests. Everything
// offline (mesh, SOS, translation) works without an account or internet.
const AVAILABILITY = ["anytime", "weekdays", "weekends", "on_call"];
const AVAILABILITY_LABELS = { anytime: "Anytime", weekdays: "Weekdays", weekends: "Weekends", on_call: "On call" };
const RESPONDER_ROLES = ["volunteer", "medical_support", "emergency_staff"];

/** Server address the app calls: HTTPS (plain HTTP only for a computer on the local network). */
function normalizeBase(url) {
  const value = String(url || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");
  if (/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(value)) return value;
  if (/^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(value)) return value;
  return "";
}

/** "first aid, driving,  " -> ["first aid", "driving"] */
function parseList(text) {
  return [...new Set(String(text || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
}

/** A stored account is kept only if it still has the shape the app relies on. */
function validAccount(a) {
  if (!a || typeof a !== "object" || typeof a.token !== "string" || !a.token) return null;
  const u = a.user;
  if (!u || typeof u !== "object" || typeof u.email !== "string") return null;
  return { token: a.token, user: u };
}

/** Plain-language error for a failed request. */
function friendlyError({ status = 0, error = "", timedOut = false, offline = false } = {}) {
  if (timedOut) return "The server did not answer. A free Render server sleeps when idle and takes up to a minute to wake; try again.";
  if (offline) return "No internet connection. Your account needs internet; messages, mesh and SOS work without it.";
  // Session problems (not a wrong password, whose message is shown as is).
  if (status === 401 && /token|signed in|no longer exists/i.test(error)) return "You were signed out. Log in again.";
  if (error) return error;
  if (status >= 500) return "The server had a problem. Try again in a moment.";
  if (status === 404) return "The Talk2 server is not reachable at the moment. Try again later.";
  return `Request failed (HTTP ${status || "?"})`;
}

module.exports = { AVAILABILITY, AVAILABILITY_LABELS, RESPONDER_ROLES, normalizeBase, parseList, validAccount, friendlyError };
