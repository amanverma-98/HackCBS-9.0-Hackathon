import { createReadStream } from "node:fs";
import { stat, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const [dir, base, out = "model-host/manifest.json"] = process.argv.slice(2);
if (!dir || !base?.startsWith("https://"))
  throw new Error(
    "Usage: node scripts/make-manifest.mjs ASSET_DIR HTTPS_RELEASE_BASE [OUTPUT]",
  );
const packs = {},
  available = await readdir(dir);
async function asset(name) {
  const p = path.join(dir, name),
    s = await stat(p);
  if (!s.isFile() || !s.size) throw new Error("Empty file: " + name);
  const hash = createHash("sha256");
  for await (const data of createReadStream(p)) hash.update(data);
  return {
    name,
    bytes: s.size,
    sha256: hash.digest("hex"),
    url: base.replace(/\/$/, "") + "/" + name,
  };
}
for (const code of [
  "hi",
  "ta",
  "bn",
  "gu",
  "mr",
  "kn",
  "ml",
  "te",
  "or",
  "en",
]) {
  const names = [
    `indicwav2vec-${code}-int8.onnx`,
    `indicwav2vec-${code}-vocab.json`,
    `vits-${code}-int8.onnx`,
    `vits-${code}-vocab.json`,
  ];
  if (names.every((n) => available.includes(n)))
    packs[code] = { files: await Promise.all(names.map(asset)) };
  else console.warn("Not included (incomplete): " + code);
}
const translation = [
  "indictrans2-encoder-int8.onnx",
  "indictrans2-decoder-int8.onnx",
  "indictrans2-vocab.json",
];
if (translation.every((n) => available.includes(n)))
  packs.translation = { files: await Promise.all(translation.map(asset)) };
if (!Object.keys(packs).length) throw new Error("No complete packs");
await writeFile(
  out,
  JSON.stringify({ schema: 1, version: "model-pack-v1", packs }, null, 2),
);
console.log("Written " + out);
