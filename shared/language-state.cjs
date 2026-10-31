const { translationRoute } = require("./core.cjs");
function recognitionReason(source, installed, available) {
  if (!available[source]) return source === "hi" ? "Hindi speech files are absent from this release" : "Source speech pack missing";
  return installed[source] ? "" : "Source speech pack missing";
}
function languageState(transcript, source, target, tts, installed) {
  const route = translationRoute(source, target);
  const translationReason = !transcript?.trim() ? "Source transcript unavailable"
    : route === "unavailable" ? "Translation pair unavailable"
    : route === "onnx" && !installed.translation ? "Translation pack missing" : "";
  const speechReason = translationReason || (tts !== target ? "TTS voice must match translation target"
    : !installed[tts] ? "Target speech pack missing" : "");
  return { route, translationReason, speechReason, originalPlayable: true };
}
module.exports = { recognitionReason, languageState };
