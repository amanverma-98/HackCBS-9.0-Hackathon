const test = require("node:test");
const assert = require("node:assert/strict");
const { OFFLINE_TRANSLATION, ENGLISH_TRANSLATION, canTranslate, packFor, translationPlan } = require("../shared/translation-pairs.cjs");

test("verified Indian-language pairs translate offline", () => {
  for (const pair of [["mr", "hi"], ["gu", "hi"], ["hi", "ta"], ["bn", "mr"], ["te", "kn"], ["ml", "gu"]])
    assert.equal(translationPlan(pair[0], pair[1]), "translate", pair.join("->"));
});

test("English translates to and from every verified Indian language", () => {
  for (const lang of ["hi", "mr", "gu", "or", "ta"]) {
    assert.equal(translationPlan("en", lang), "translate", "en->" + lang);
    assert.equal(translationPlan(lang, "en"), "translate", lang + "->en");
  }
});

test("Odia translates with the exact tokenizer; unknown languages keep the original", () => {
  assert.equal(translationPlan("or", "hi"), "translate");
  assert.equal(translationPlan("hi", "or"), "translate");
  assert.equal(translationPlan("pa", "hi"), "unsupported", "Punjabi is not in the packs");
  assert.equal(canTranslate("ur", "en"), false);
});

test("each pair names the pack it needs", () => {
  assert.equal(packFor("en", "hi"), "translation-en");
  assert.equal(packFor("ta", "en"), "translation-en");
  assert.equal(packFor("gu", "hi"), "translation");
});

test("same language and unknown language need no translation", () => {
  assert.equal(translationPlan("hi", "hi"), "same");
  assert.equal(translationPlan("en", "en"), "same");
  assert.equal(translationPlan("und", "hi"), "unknown");
  assert.equal(translationPlan("", "hi"), "unknown");
});

test("the JS lists match the Java engine's enabled languages", () => {
  const java = require("fs").readFileSync(require("path").join(__dirname, "../mobile/android/app/src/main/java/com/talk2/TranslationEngine.java"), "utf8");
  const list = (name) => java.match(new RegExp(name + "=new HashSet<>\\(Arrays\\.asList\\(([^)]*)\\)\\)"))[1].match(/"([a-z]+)"/g).map((s) => s.slice(1, -1)).sort();
  assert.deepEqual(list("ENABLED"), [...OFFLINE_TRANSLATION].sort());
  assert.deepEqual(list("ENGLISH"), [...ENGLISH_TRANSLATION].sort());
});
