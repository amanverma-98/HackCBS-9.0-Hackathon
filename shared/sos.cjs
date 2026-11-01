// SOS payload shared by the direct link and the mesh. Every SOS is public: relays and nearby
// phones receive it so help can come from anyone. Receivers validate every field; a malformed
// location is dropped rather than shown.
const { position } = require("./core.cjs");

const ROLES = ["citizen", "volunteer", "medical_support", "emergency_staff"];
const MAX_TEXT = 500;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function cleanLocation(loc) {
  if (!loc || typeof loc !== "object") return null;
  const lat = num(loc.lat), lng = num(loc.lng), acc = num(loc.acc), t = num(loc.t);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, acc: acc !== null && acc >= 0 ? acc : null, t };
}

/** Builds the payload an SOS carries; `fix` is this phone's latest location or null. */
function buildSOS({ id, text, template, name, role, device, lang, time, fix, battery, voice }) {
  return {
    v: 1,
    id: str(id, 80),
    text: str(text, MAX_TEXT),
    template: str(template, 40) || undefined,
    name: str(name, 40),
    role: ROLES.includes(role) ? role : "citizen",
    device: str(device, 80),
    lang: str(lang, 5),
    time,
    loc: fix ? cleanLocation({ lat: fix.latitude, lng: fix.longitude, acc: fix.accuracy, t: fix.time }) : null,
    battery: Number.isInteger(battery) && battery >= 0 && battery <= 100 ? battery : null,
    voice: voice === true,
  };
}

/** Parses a received SOS (object or JSON text). Returns null if it is not a usable SOS payload. */
function parseSOS(raw, now = Date.now()) {
  let o = raw;
  if (typeof raw === "string") {
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (!o || typeof o !== "object" || o.v !== 1 || typeof o.id !== "string" || !o.id) return null;
  const time = num(o.time);
  if (time === null || time > now + 300000) return null;
  return {
    v: 1,
    id: str(o.id, 80),
    text: str(o.text, MAX_TEXT),
    template: str(o.template, 40) || undefined,
    name: str(o.name, 40) || "Unknown",
    role: ROLES.includes(o.role) ? o.role : "citizen",
    device: str(o.device, 80),
    lang: str(o.lang, 5),
    time,
    loc: cleanLocation(o.loc),
    battery: Number.isInteger(o.battery) && o.battery >= 0 && o.battery <= 100 ? o.battery : null,
    voice: o.voice === true,
  };
}

/** Distance and bearing from this phone to the SOS location, when both are known. */
function sosDistance(sos, me) {
  if (!sos || !sos.loc || !me || !Number.isFinite(me.latitude)) return null;
  return position({ latitude: me.latitude, longitude: me.longitude }, { latitude: sos.loc.lat, longitude: sos.loc.lng }, 0);
}

module.exports = { buildSOS, parseSOS, sosDistance, MAX_TEXT };
