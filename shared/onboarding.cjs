const SETTINGS_VERSION = 2;
const ROLES = ["citizen", "volunteer", "medical_support", "emergency_staff"];
const LANGUAGES = ["hi", "ta", "bn", "gu", "mr", "kn", "ml", "te", "or", "en"];

function migrateSettings(saved = {}, defaults = {}) {
  saved = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const legacy = LANGUAGES.includes(saved.current) ? saved.current : "hi";
  const source = LANGUAGES.includes(saved.sourceSpeech) ? saved.sourceSpeech : legacy;
  const ui = LANGUAGES.includes(saved.ui) ? saved.ui : "en";
  const normalized = {
    setup: saved.setup === true,
    name: typeof saved.name === "string" ? saved.name.slice(0, 40) : "",
    deviceId: typeof saved.deviceId === "string" && saved.deviceId ? saved.deviceId : (defaults.deviceId || ""),
    theme: ["system", "light", "dark"].includes(saved.theme) ? saved.theme : (defaults.theme || "system"),
    manifestUrl: typeof saved.manifestUrl === "string" ? saved.manifestUrl : (defaults.manifestUrl || ""),
    backend: typeof saved.backend === "string" ? saved.backend : (defaults.backend || ""),
    shareLocation: saved.shareLocation === true,
    sirenEnabled: saved.sirenEnabled === true,
    photo: typeof saved.photo === "string" ? saved.photo : "",
    haptics: saved.haptics !== false,
    sounds: saved.sounds !== false,
    autoPlay: saved.autoPlay !== false,
    reviewSpeech: saved.reviewSpeech === true,
    voiceMode: ["original", "translated"].includes(saved.voiceMode) ? saved.voiceMode : (defaults.voiceMode || "translated"),
    messages: Array.isArray(saved.messages) ? saved.messages.filter((message) => message && typeof message === "object" && Number.isFinite(message.time)) : [],
    settingsVersion: SETTINGS_VERSION,
    role: ROLES.includes(saved.role) ? saved.role : "citizen",
    verificationStatus: "unverified",
    sourceSpeech: source,
    targetTranslation: LANGUAGES.includes(saved.targetTranslation) ? saved.targetTranslation : legacy,
    ttsVoice: LANGUAGES.includes(saved.ttsVoice) ? saved.ttsVoice : legacy,
    ui,
  };
  return normalized;
}

function verificationDisplay(role, credential) {
  if (role !== "emergency_staff") return { label: "Self-declared role", verified: false };
  // A packet is data only. Until a configured verifier checks it, staff stays unverified.
  void credential;
  return { label: "Unverified emergency staff", verified: false };
}

module.exports = { SETTINGS_VERSION, ROLES, migrateSettings, verificationDisplay };
