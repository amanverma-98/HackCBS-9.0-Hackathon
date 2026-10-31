const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  LANGUAGES,
  TTL,
  position,
  prune,
  validMessage,
  translationRoute,
  detectScript,
} = require("../shared/core.cjs");
test("ten unique languages and original wire codes", () => {
  assert.equal(LANGUAGES.length, 10);
  assert.equal(new Set(LANGUAGES.map((l) => l.wire)).size, 10);
  assert.deepEqual(
    LANGUAGES.slice(0, 3).map((x) => x.code),
    ["hi", "ta", "bn"],
  );
});
test("GPS distance, heading-relative bearing and antimeridian", () => {
  let p = position(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.001 },
    90,
  );
  assert.ok(Math.abs(p.distance - 111.195) < 0.01);
  assert.equal(p.bearing, 90);
  assert.equal(p.relative, 0);
  p = position(
    { latitude: 0, longitude: 179.999 },
    { latitude: 0, longitude: -179.999 },
  );
  assert.ok(p.distance < 223);
  assert.equal(p.bearing, 90);
});
test("reject stale, future, oversized, unknown-language packets", () => {
  const m = {
    id: "a",
    kind: "text",
    time: Date.now(),
    text: "नमस्ते",
    language: "hi",
  };
  assert.ok(validMessage(m));
  for (const p of [
    { time: 0 },
    { time: Date.now() + 900000 },
    { text: "x".repeat(2001) },
    { language: "xx" },
    { kind: "eval" },
  ])
    assert.ok(!validMessage({ ...m, ...p }));
});
test("30-day TTL and 500-message capacity", () => {
  const now = Date.now();
  assert.equal(prune([{ time: now - TTL - 1 }, { time: now }], now).length, 1);
  assert.equal(
    prune(
      Array.from({ length: 600 }, () => ({ time: now })),
      now,
    ).length,
    500,
  );
});
test("same-language no-op; unsupported translation fails closed", () => {
  assert.equal(translationRoute("hi", "hi"), "identity");
  assert.equal(translationRoute("hi", "mr"), "onnx");
  assert.equal(translationRoute("hi", "ta"), "unavailable");
  assert.equal(translationRoute("en", "hi"), "unavailable");
});
test("five alert templates cover all ten languages", () => {
  const templates = require("../shared/alerts.json");
  assert.equal(Object.keys(templates).length, 5);
  for (const p of Object.values(templates))
    for (const l of LANGUAGES) assert.ok(p[l.code]);
});
test("script detection only chooses installed languages; Hindi/Marathi ambiguity preserves active", () => {
  assert.equal(detectScript("தமிழ்", ["hi", "ta"], "hi"), "ta");
  assert.equal(detectScript("தமிழ்", ["hi"], "hi"), "hi");
  assert.equal(detectScript("मदत हवी आहे", ["hi", "mr"], "mr"), "mr");
});
