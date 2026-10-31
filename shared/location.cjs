const { position } = require("./core.cjs");
const MAX_AGE = 30000;
function usableLocation(p, now = Date.now()) {
  return !!p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 &&
    Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 100 &&
    Number.isFinite(p.time) && p.time <= now + 5000 && now - p.time < MAX_AGE &&
    (!Object.prototype.hasOwnProperty.call(p, "expires") || (Number.isFinite(p.expires) && p.expires > now && p.expires <= p.time + MAX_AGE));
}
function mergeLocationPeer(store, e, now = Date.now()) {
  if (!e || typeof e.sender !== "string" || e.sender.length > 80 || !e.sender ||
      !Number.isFinite(e.time) || e.time > now + 5000 || now-e.time >= MAX_AGE ||
      !Number.isFinite(e.expires) || e.expires <= now || e.expires > e.time + MAX_AGE) return store;
  const previous = store[e.sender]; if (previous && previous.packetTime >= e.time) return store;
  const coords = e.off ? null : {...e.coords, expires:e.expires};
  if (!e.off && !usableLocation(coords, now)) return store;
  const next = Object.fromEntries(Object.entries(store).filter(([, p]) => now-p.lastSeen < 5*60*1000));
  next[e.sender] = {id:e.sender, name:String(e.name || previous?.name || e.sender.slice(0,8)).slice(0,40),
    role:["citizen","volunteer","medical_support","emergency_staff"].includes(e.role) ? e.role : previous?.role || "unknown",
    verified:false, transport:"BLE mesh", route:e.hops > 0 ? "relayed" : "direct", lastSeen:now, packetTime:e.time, coords};
  return Object.fromEntries(Object.entries(next).slice(-128));
}
function peerView(peers, filter, local, heading, now = Date.now()) {
  return peers.filter(p => filter === "all" || p.route === filter).map(p => ({...p, verified:false,
    polar: usableLocation(local,now) && usableLocation(p.coords,now) ? position(local,p.coords,Number.isFinite(heading)?heading:0) : null,
    uncertainty: usableLocation(local,now) && usableLocation(p.coords,now) ? local.accuracy+p.coords.accuracy : null}));
}
module.exports = { MAX_AGE, usableLocation, mergeLocationPeer, peerView };
