const LANGUAGES = [
  ["hi", "हिन्दी", "Hindi"],
  ["ta", "தமிழ்", "Tamil"],
  ["bn", "বাংলা", "Bengali"],
  ["gu", "ગુજરાતી", "Gujarati"],
  ["mr", "मराठी", "Marathi"],
  ["kn", "ಕನ್ನಡ", "Kannada"],
  ["ml", "മലയാളം", "Malayalam"],
  ["te", "తెలుగు", "Telugu"],
  ["or", "ଓଡ଼ିଆ", "Odia"],
  ["en", "English", "English"],
].map(([code, native, name], i) => ({ code, native, name, wire: i + 1 }));
const TTL = 30 * 24 * 60 * 60 * 1000,
  wrap = (n) => ((n % 360) + 360) % 360;
function position(a, b, heading = 0) {
  const r = Math.PI / 180,
    p = a.latitude * r,
    q = b.latitude * r,
    dl = (b.longitude - a.longitude) * r;

  const h =
    Math.sin((q - p) / 2) ** 2 +
    Math.cos(p) * Math.cos(q) * Math.sin(dl / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  const bearing = wrap(
    Math.atan2(
      Math.sin(dl) * Math.cos(q),
      Math.cos(p) * Math.sin(q) - Math.sin(p) * Math.cos(q) * Math.cos(dl),
    ) / r,
  );
  
  return { distance, bearing, relative: wrap(bearing - heading) };
}
function validMessage(m, now = Date.now()) {
  return (
    m &&
    typeof m.id === "string" &&
    m.id.length <= 80 &&
    ["text", "alert", "voice", "position", "position-off", "ack", "profile", "floor"].includes(m.kind) &&
    Number.isFinite(m.time) &&
    m.time > now - TTL &&
    m.time < now + 300000 &&
    (!["text", "alert", "voice"].includes(m.kind) ||
      (typeof m.text === "string" &&
        m.text.length > 0 &&
        m.text.length <= 2000 &&
        LANGUAGES.some((l) => l.code === m.language)))
  );
}
function prune(items, now = Date.now()) {
  return items.filter((x) => x.time > now - TTL).slice(-500);
}
function translationRoute(source, target) {
  if (source === target) return "identity";
  return [source, target].every((x) => ["hi", "mr"].includes(x))
    ? "onnx"
    : "unavailable";
}
function detectScript(text, installed, current) {
  const scripts = [
    ["ta", 0xb80, 0xbff],
    ["bn", 0x980, 0x9ff],
    ["gu", 0xa80, 0xaff],
    ["kn", 0xc80, 0xcff],
    ["ml", 0xd00, 0xd7f],
    ["te", 0xc00, 0xc7f],
    ["or", 0xb00, 0xb7f],
  ];
  let best = current,
    max = 0;
  for (const [code, lo, hi] of scripts) {
    if (!installed.includes(code)) continue;
    const count = [...text].filter(
      (c) => c.codePointAt(0) >= lo && c.codePointAt(0) <= hi,
    ).length;
    if (count > max && count >= 3) {
      max = count;
      best = code;
    }
  }
  return installed.includes(best)
    ? best
    : installed.includes("hi")
      ? "hi"
      : installed[0] || current;
}
module.exports = {
  LANGUAGES,
  TTL,
  wrap,
  position,
  validMessage,
  prune,
  translationRoute,
  detectScript,
};
