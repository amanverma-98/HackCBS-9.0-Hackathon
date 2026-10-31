const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateSettings, verificationDisplay, SETTINGS_VERSION } = require("../shared/onboarding.cjs");
const i18n = require("../shared/i18n.cjs");
const { packStatus } = require("../shared/model-packs.cjs");

test("settings migration preserves legacy values and separates language roles", () => {
  const old = migrateSettings({
    setup: true, name: "Asha", current: "mr", ui: "en", role: "emergency_staff",
    verificationStatus: "verified", messages: [{ id: "m1", time: Date.now() }],
  });
  assert.equal(old.settingsVersion, SETTINGS_VERSION);
  assert.equal(old.sourceSpeech, "mr");
  assert.equal(old.targetTranslation, "mr");
  assert.equal(old.ttsVoice, "mr");
  assert.equal(old.role, "emergency_staff");
  assert.equal(old.verificationStatus, "unverified");
  assert.equal(old.current, undefined);
  assert.equal(old.messages.length, 1);
  assert.equal(migrateSettings({ current: "script-injection", messages: "bad" }).sourceSpeech, "hi");
  assert.deepEqual(migrateSettings({ messages: "bad" }).messages, []);
});

test("self-selection, OTP claims, and unsigned profile packets never display verification", () => {
  assert.deepEqual(verificationDisplay("citizen", { verified: true, signed: true }), {
    label: "Self-declared role", verified: false,
  });
  assert.deepEqual(verificationDisplay("emergency_staff", { emailOtp: true, verified: true }), {
    label: "Unverified emergency staff", verified: false,
  });
  assert.equal(verificationDisplay("emergency_staff", { signed: true, verified: true }).verified, false);
});

test("localization falls back structurally and reports missing coverage", () => {
  assert.equal(i18n.translate("Talk", "mr"), "बोला");
  assert.equal(i18n.diagnostics("mr").coverage, 1);
  assert.equal(i18n.translate("untranslated-key", "mr"), "untranslated-key");
  const diagnostic = i18n.diagnostics("hi");
  assert.equal(diagnostic.translated, 0);
  assert.equal(diagnostic.missing.length, diagnostic.total);
  assert.ok(diagnostic.coverage < 1);
  assert.match(i18n.coverageText("mr"), /UI भाषांतर व्याप्ती/);
  assert.match(i18n.coverageText("hi"), /Missing strings fall back to English/);
});

test("pack state distinguishes unavailable, ready, partial, downloading, and failed", () => {
  const state = (values) => packStatus({ code: "hi", ...values }).state;
  assert.equal(state({ inManifest: false }), "unavailable");
  assert.equal(state({ inManifest: true }), "available");
  assert.equal(state({ inManifest: true, downloadedBytes: 10, expectedBytes: 20 }), "partial");
  assert.equal(state({ inManifest: true, downloading: true }), "downloading");
  assert.equal(state({ inManifest: true, paused: true, downloadedBytes: 10 }), "paused");
  assert.equal(state({ inManifest: true, failed: true }), "failed");
  assert.equal(state({ inManifest: true, installed: true }), "installed");
});
