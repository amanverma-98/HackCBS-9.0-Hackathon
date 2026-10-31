const test = require("node:test"), assert = require("node:assert/strict");
const { languageState, recognitionReason } = require("../shared/language-state.cjs");
const manifest = require("../model-host/upstream-manifest.json");
const i18n = require("../shared/i18n.cjs");
test("voice language policy keeps original usable through missing and incompatible models", () => {
  assert.equal(recognitionReason("hi", {}, manifest.packs), "Hindi speech files are absent from this release");
  assert.equal(recognitionReason("mr", {}, manifest.packs), "Source speech pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "hi", {}).translationReason, "Translation pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "hi", {translation:true}).speechReason, "Target speech pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "mr", {translation:true,mr:true}).speechReason, "TTS voice must match translation target");
  const identity=languageState("मदत", "mr", "mr", "mr", {mr:true});assert.equal(identity.route,"identity");assert.equal(identity.speechReason,"");
  assert.equal(languageState("help", "en", "mr", "mr", {mr:true,translation:true}).translationReason,"Translation pair unavailable");
  assert.equal(languageState("", "mr", "mr", "mr", {mr:true}).originalPlayable,true);
});
test("Stage 3 UI strings have Marathi coverage and structured fallback", () => {
  for (const key of Object.keys(require("../shared/stage3-ui.cjs"))) {
    assert.ok(i18n.resources.mr[key]); assert.equal(i18n.translate(key,"ta"), i18n.resources.en[key]);
  }
});
