const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSOS, parseSOS, sosDistance } = require("../shared/sos.cjs");

const NOW = 1_800_000_000_000;
const fix = { latitude: 18.5204, longitude: 73.8567, accuracy: 12, time: NOW - 2000 };

test("SOS carries sender, message, location and battery and survives JSON transport", () => {
  const sos = buildSOS({ id: "s1", text: "Trapped on 2nd floor", name: "Asha", role: "volunteer", device: "d1", lang: "hi", time: NOW, fix, battery: 41, voice: true });
  const back = parseSOS(JSON.stringify(sos), NOW + 500);
  assert.equal(back.name, "Asha");
  assert.equal(back.text, "Trapped on 2nd floor");
  assert.deepEqual(back.loc, { lat: 18.5204, lng: 73.8567, acc: 12, t: NOW - 2000 });
  assert.equal(back.battery, 41);
  assert.equal(back.voice, true);
});

test("SOS without location is still valid; location is never invented", () => {
  const back = parseSOS(buildSOS({ id: "s2", text: "Help", name: "B", time: NOW, fix: null }), NOW);
  assert.equal(back.loc, null);
  assert.equal(sosDistance(back, fix), null);
});

test("malformed SOS fields are rejected or dropped", () => {
  assert.equal(parseSOS("not json", NOW), null);
  assert.equal(parseSOS({ v: 2, id: "x", time: NOW }, NOW), null);
  assert.equal(parseSOS({ v: 1, id: "", time: NOW }, NOW), null);
  assert.equal(parseSOS({ v: 1, id: "x", time: NOW + 3_600_000 }, NOW), null, "far-future time");
  const bad = parseSOS({ v: 1, id: "x", time: NOW, loc: { lat: 123, lng: 5 }, battery: 400, role: "admin", name: "y".repeat(90) }, NOW);
  assert.equal(bad.loc, null);
  assert.equal(bad.battery, null);
  assert.equal(bad.role, "citizen", "unknown roles are not trusted");
  assert.equal(bad.name.length, 40);
});

test("receiver distance to the SOS uses Haversine", () => {
  const sos = parseSOS(buildSOS({ id: "s3", text: "Help", name: "C", time: NOW, fix }), NOW);
  const d = sosDistance(sos, { latitude: 18.5224, longitude: 73.8567 });
  assert.ok(d.distance > 215 && d.distance < 230, String(d.distance));
  assert.ok(d.bearing > 175 && d.bearing < 185, "SOS is south of the receiver");
});
