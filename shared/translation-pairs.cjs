// Offline translation coverage. Mirrors TranslationEngine.ENABLED / ENGLISH (Java); both come
// from scripts/validate-translation.ps1. Indian languages translate to each other with the
// "translation" pack; English translates to and from every listed Indian language with the
// optional "translation-en" pack.
const OFFLINE_TRANSLATION = ["hi", "mr", "bn", "gu", "or", "ta", "te", "kn", "ml"];
const ENGLISH_TRANSLATION = ["hi", "mr", "bn", "gu", "or", "ta", "te", "kn", "ml"];

function canTranslate(source, target) {
  if (source === target) return true;
  if (source === "en") return ENGLISH_TRANSLATION.includes(target);
  if (target === "en") return ENGLISH_TRANSLATION.includes(source);
  return OFFLINE_TRANSLATION.includes(source) && OFFLINE_TRANSLATION.includes(target);
}

/** Which downloadable pack a pair needs. */
function packFor(source, target) {
  return source === "en" || target === "en" ? "translation-en" : "translation";
}

/** What the receiver can do with a message in `source` when reading in `target`. */
function translationPlan(source, target) {
  if (!source || source === "und") return "unknown";
  if (source === target) return "same";
  return canTranslate(source, target) ? "translate" : "unsupported";
}

module.exports = { OFFLINE_TRANSLATION, ENGLISH_TRANSLATION, canTranslate, packFor, translationPlan };
