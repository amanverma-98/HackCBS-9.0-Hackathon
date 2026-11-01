// Checks model-host/upstream-manifest.json against the live GitHub release, so every in-app
// download succeeds: each file exists on the release with the same size and SHA-256, and its URL
// answers through GitHub's HTTPS redirect with resumable (Range) downloads.
// Usage: node scripts/check-release.mjs   (run after uploading or replacing release assets)
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../model-host/upstream-manifest.json", import.meta.url), "utf8"));
const release = await (await fetch("https://api.github.com/repos/Somu9450/Talk2/releases/tags/model-pack-v1", { headers: { Accept: "application/vnd.github+json" } })).json();
if (!Array.isArray(release.assets)) throw new Error("Could not read the release: " + (release.message || "unknown error"));
const assets = Object.fromEntries(release.assets.map((a) => [a.name, a]));
const files = Object.entries(manifest.packs).flatMap(([pack, s]) => s.files.map((f) => ({ pack, ...f })));

const problems = (await Promise.all(files.map(async (f) => {
  const a = assets[f.name], issues = [];
  if (!a) return `${f.pack}/${f.name}: missing from the release`;
  if (a.size !== f.bytes) issues.push(`size ${a.size}, manifest ${f.bytes}`);
  if (a.digest && a.digest !== "sha256:" + f.sha256) issues.push(`sha256 ${a.digest.slice(7, 19)}…, manifest ${f.sha256.slice(0, 12)}…`);
  try {
    const res = await fetch(f.url, { headers: { Range: "bytes=0-0", "Accept-Encoding": "identity" } });
    await res.arrayBuffer();
    if (res.status !== 206 || !res.url.startsWith("https://")) issues.push(`download answered ${res.status}`);
  } catch (e) {
    issues.push("download failed: " + e.message);
  }
  return issues.length ? `${f.pack}/${f.name}: ${issues.join("; ")}` : null;
}))).filter(Boolean);

console.log(problems.length ? problems.join("\n") : `OK: all ${files.length} files in ${Object.keys(manifest.packs).length} packs match the release and download.`);
process.exit(problems.length ? 1 : 0);
