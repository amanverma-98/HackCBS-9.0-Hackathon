// Decides when this phone publishes its shared location, and builds the update it sends.
// Pure logic so the send policy can be tested without radios.
const { position } = require("./core.cjs");
const { MAX_AGE, usableLocation } = require("./location.cjs");

// Never publish more often than this, whatever triggers it.
const MIN_INTERVAL_MS = 3000;
// Resend an unchanged fix this often so late joiners and relays see it before it expires.
const HEARTBEAT_MS = 15000;
// Movement that counts as meaningful for an immediate update.
const MOVE_METRES = 15;

class LocationPublisher {
  constructor() { this.sharing = false; this.last = null; }
  setSharing(on) { this.sharing = on === true; this.last = null; }
  /**
   * reason: "fix" (new GPS fix), "start" (sharing or mesh started), "neighbor" (a phone connected),
   * "refresh" (user pulled to refresh) or "heartbeat" (periodic timer).
   */
  shouldPublish(fix, now, reason) {
    if (!this.sharing || !usableLocation(fix, now)) return false;
    if (!this.last) return true;
    const since = now - this.last.sentAt;
    if (since < MIN_INTERVAL_MS) return false;
    if (reason === "start" || reason === "neighbor" || reason === "refresh") return true;
    const moved = position(this.last, fix).distance >= MOVE_METRES;
    const sharper = fix.accuracy < this.last.accuracy / 2;
    return moved || sharper || since >= HEARTBEAT_MS;
  }
  markPublished(fix, now) {
    this.last = { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, sentAt: now };
  }
}

/** Mesh position body: the fix keeps its own timestamp; expiry never exceeds MAX_AGE from either clock. */
function positionUpdate(fix, now, profile = {}) {
  return {
    time: now,
    expires: Math.min(fix.time + MAX_AGE, now + MAX_AGE),
    coords: { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, time: fix.time },
    name: String(profile.name || "").slice(0, 40),
    role: String(profile.role || ""),
  };
}

/** Explicit revocation; receivers clear the dot and reject older updates afterwards. */
function positionOff(now) { return { off: true, time: now, expires: now + MAX_AGE }; }

module.exports = { LocationPublisher, positionUpdate, positionOff, MIN_INTERVAL_MS, HEARTBEAT_MS, MOVE_METRES };
