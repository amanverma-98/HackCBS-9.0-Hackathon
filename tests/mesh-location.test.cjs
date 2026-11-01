const test = require("node:test");
const assert = require("node:assert/strict");
const { LocationPublisher, positionUpdate, positionOff, MIN_INTERVAL_MS, HEARTBEAT_MS } = require("../shared/mesh-location.cjs");
const { mergeLocationPeer, peerView } = require("../shared/location.cjs");
const { createRefresher } = require("../shared/refresh.cjs");

const T0 = 1_800_000_000_000;
const fixAt = (time, latitude = 18.52, longitude = 73.85, accuracy = 12) => ({ latitude, longitude, accuracy, time });
// What B receives: A's body plus the signed sender id and hop count the router attaches.
const received = (body, hops = 0) => ({ ...body, sender: "node-A", hops });
const bFix = (now) => fixAt(now - 1000, 18.521, 73.851, 8);


test("A starts sharing while B is connected: B shows A's location at once", () => {
  const a = new LocationPublisher();
  assert.equal(a.shouldPublish(fixAt(T0), T0, "start"), false, "nothing is sent before sharing is on");
  a.setSharing(true);
  assert.equal(a.shouldPublish(fixAt(T0 - 2000), T0, "start"), true);
  const body = positionUpdate(fixAt(T0 - 2000), T0, { name: "Asha", role: "volunteer" });
  a.markPublished(fixAt(T0 - 2000), T0);
  const store = mergeLocationPeer({}, received(body), T0 + 200);
  assert.ok(store["node-A"].coords, "B stores A's coordinates under A's mesh identity");
  const [peer] = peerView(Object.values(store), "all", bFix(T0 + 200), 0, T0 + 200);
  assert.equal(peer.located, true);
  assert.ok(peer.polar.distance > 50 && peer.polar.distance < 400);
});


test("B connects after A started sharing: A resends on the new neighbour without moving", () => {
  const a = new LocationPublisher();
  a.setSharing(true);
  const fix = fixAt(T0 - 1000);
  a.markPublished(fix, T0);
  assert.equal(a.shouldPublish(fixAt(T0), T0 + 1000, "neighbor"), false, "bounded by the minimum interval");
  const later = T0 + MIN_INTERVAL_MS + 10;
  const sameSpot = fixAt(later - 500);
  assert.equal(a.shouldPublish(sameSpot, later, "fix"), false, "a stationary fix alone is not resent early");
  assert.equal(a.shouldPublish(sameSpot, later, "neighbor"), true, "a new neighbour gets the current fix");
  const store = mergeLocationPeer({}, received(positionUpdate(sameSpot, later)), later + 100);
  assert.ok(store["node-A"].coords);
  assert.equal(a.shouldPublish(fixAt(T0 + HEARTBEAT_MS), T0 + HEARTBEAT_MS, "heartbeat"), true, "heartbeat keeps it alive for late joiners");
});


test("A sends a newer location; out-of-order and duplicate updates are rejected", () => {
  const a = new LocationPublisher();
  a.setSharing(true);
  a.markPublished(fixAt(T0 - 500), T0);
  const moved = fixAt(T0 + 4000, 18.5205, 73.85);
  assert.equal(a.shouldPublish(moved, T0 + 4500, "fix"), true, "about 55 m of movement publishes promptly");
  const first = received(positionUpdate(fixAt(T0 - 500), T0));
  const newer = received(positionUpdate(moved, T0 + 4500));
  let store = mergeLocationPeer({}, first, T0 + 100);
  store = mergeLocationPeer(store, newer, T0 + 4600);
  assert.equal(store["node-A"].coords.latitude, 18.5205);
  assert.equal(mergeLocationPeer(store, first, T0 + 4700), store, "older packet arriving late is ignored");
  assert.equal(mergeLocationPeer(store, newer, T0 + 4800), store, "duplicate is ignored");
});


test("A stops sharing: B clears the live location and older updates cannot resurrect it", () => {
  const a = new LocationPublisher();
  a.setSharing(true);
  const update = received(positionUpdate(fixAt(T0 - 500), T0));
  let store = mergeLocationPeer({}, update, T0 + 100);
  a.setSharing(false);
  assert.equal(a.shouldPublish(fixAt(T0 + 9000), T0 + 9000, "heartbeat"), false);
  store = mergeLocationPeer(store, received(positionOff(T0 + 9000)), T0 + 9100);
  assert.equal(store["node-A"].coords, null);
  assert.equal(mergeLocationPeer(store, update, T0 + 9200), store);
  const [peer] = peerView(Object.values(store), "all", bFix(T0 + 9200), 0, T0 + 9200);
  assert.equal(peer.located, false);
  assert.equal(peer.polar, null);
});

test("stale, expired and malformed updates never become a live location", () => {
  const ok = received(positionUpdate(fixAt(T0 - 500), T0));
  assert.deepEqual(mergeLocationPeer({}, ok, T0 + 31_000), {}, "expired by receive time");
  const staleFix = received(positionUpdate(fixAt(T0 - 40_000), T0));
  assert.deepEqual(mergeLocationPeer({}, staleFix, T0 + 100), {}, "fix older than the 30 s window");
  for (const coords of [{ latitude: 200, longitude: 0, accuracy: 5 }, { latitude: 1, longitude: 1, accuracy: 500 }, { latitude: NaN, longitude: 1, accuracy: 5 }])
    assert.deepEqual(mergeLocationPeer({}, { ...ok, coords: { ...coords, time: T0 - 500 } }, T0 + 100), {});
  assert.deepEqual(mergeLocationPeer({}, { ...ok, sender: 42 }, T0 + 100), {}, "sender must be a mesh identity");
  assert.deepEqual(mergeLocationPeer({}, { ...ok, expires: T0 + 120_000 }, T0 + 100), {}, "expiry beyond the policy window");
  const a = new LocationPublisher();
  a.setSharing(true);
  assert.equal(a.shouldPublish(fixAt(T0 - 40_000), T0, "start"), false, "A never publishes a stale fix");
  assert.equal(a.shouldPublish({ ...fixAt(T0), accuracy: 250 }, T0, "start"), false, "A never publishes a poor fix");
});

test("relayed update keeps A's identity and marks the route as relayed", () => {
  const store = mergeLocationPeer({}, received(positionUpdate(fixAt(T0 - 500), T0), 2), T0 + 100);
  assert.equal(Object.keys(store).join(), "node-A");
  assert.equal(store["node-A"].route, "relayed");
});

test("radar and list use one filtered collection; peers without coordinates stay listed", () => {
  const now = T0 + 100;
  const located = { id: "a", route: "direct", coords: { ...fixAt(T0 - 500), expires: T0 + 29_000 } };
  const relayed = { id: "b", route: "relayed", coords: null };
  const all = peerView([located, relayed], "all", bFix(now), 0, now);
  assert.deepEqual(all.map((p) => p.id), ["a", "b"]);
  assert.deepEqual(all.filter((p) => p.polar).map((p) => p.id), ["a"], "only located peers become dots");
  assert.deepEqual(peerView([located, relayed], "relayed", bFix(now), 0, now).map((p) => p.id), ["b"]);
  const noGps = peerView([located], "all", null, 0, now)[0];
  assert.equal(noGps.located, true, "A's shared location is known even while B's GPS is acquiring");
  assert.equal(noGps.polar, null, "no invented radar position");
});

test("refresh completes, reports errors, times out and refuses duplicate scans", async () => {
  const refresh = createRefresher(50);
  assert.deepEqual(await refresh(async () => {}), { status: "done" });
  assert.deepEqual(await refresh(async () => { throw new Error("Bluetooth is off"); }), { status: "error", message: "Bluetooth is off" });
  let release;
  const slow = refresh(() => new Promise((r) => { release = r; }));
  assert.deepEqual(await refresh(async () => {}), { status: "busy" }, "no duplicate scan while one is running");
  assert.deepEqual(await slow, { status: "timeout" });
  assert.deepEqual(await refresh(async () => {}), { status: "busy" }, "still busy until the timed-out task ends");
  release();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(await refresh(async () => {}), { status: "done" });
});
