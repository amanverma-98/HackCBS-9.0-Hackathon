const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const manifest = require("../model-host/upstream-manifest.json");

const BASE = "https://github.com/Somu9450/Talk2/releases/download/model-pack-v1/";
const java = (name) => fs.readFileSync(path.join(__dirname, "../mobile/android/app/src/main/java/com/talk2", name), "utf8");

/** The file names ModelStore.validateSpec requires for each pack. */
function required(pack) {
  if (pack === "translation") return ["indictrans2-encoder-int8.onnx", "indictrans2-decoder-int8.onnx", "indictrans2-vocab.json"];
  if (pack === "translation-en")
    return ["en-indic", "indic-en"].flatMap((d) => [`indictrans2-${d}-encoder-int8.onnx`, `indictrans2-${d}-decoder-int8.onnx`, `indictrans2-${d}-vocab.json`]);
  return [`indicwav2vec-${pack}-int8.onnx`, `indicwav2vec-${pack}-vocab.json`, `vits-${pack}-int8.onnx`, `vits-${pack}-vocab.json`];
}

test("every pack has exactly the files the app's downloader requires", () => {
  assert.equal(manifest.schema, 1);
  for (const [pack, spec] of Object.entries(manifest.packs)) {
    const names = spec.files.map((f) => f.name);
    assert.deepEqual([...names].sort(), required(pack).sort(), pack);
    assert.equal(new Set(names).size, names.length, `${pack}: duplicate file`);
  }
});

test("every file has a safe name, release URL, exact size and SHA-256", () => {
  for (const [pack, spec] of Object.entries(manifest.packs))
    for (const f of spec.files) {
      assert.match(f.name, /^[a-zA-Z0-9_.-]+$/, `${pack}: ModelStore.safe() rejects ${f.name}`);
      assert.ok(!f.name.includes(".."));
      assert.equal(f.url, BASE + f.name, `${pack}: URL must be the release asset of the same name`);
      assert.ok(Number.isInteger(f.bytes) && f.bytes > 0, `${pack}: ${f.name} size`);
      assert.match(f.sha256, /^[a-f0-9]{64}$/, `${pack}: ${f.name} checksum`);
    }
});

test("the app knows every pack in the manifest, and voice codes match ModelStore", () => {
  const listed = java("Talk2Module.java").match(/for\(String code:new String\[\]\{([^}]*)\}\)/)[1].match(/"([a-z-]+)"/g).map((s) => s.slice(1, -1));
  for (const pack of Object.keys(manifest.packs)) assert.ok(listed.includes(pack), `Talk2Module.packStatus does not report ${pack}`);
  const voices = java("ModelStore.java").match(/Arrays\.asList\(([^)]*)\)\.contains\(pack\)/)[1].match(/"([a-z]+)"/g).map((s) => s.slice(1, -1));
  for (const pack of Object.keys(manifest.packs).filter((p) => !p.startsWith("translation"))) assert.ok(voices.includes(pack), `ModelStore rejects ${pack}`);
});

test("the bundled Indic tokenizer scores ship with the app", () => {
  const tsv = path.join(__dirname, "../mobile/android/app/src/main/assets/translation/indic-spm-scores.tsv");
  const lines = fs.readFileSync(tsv, "utf8").split("\n").filter(Boolean);
  assert.ok(lines.length > 120000, "Indic SentencePiece has ~128k pieces");
  assert.match(lines[5], /^-?\d+\t\S+$/);
});
