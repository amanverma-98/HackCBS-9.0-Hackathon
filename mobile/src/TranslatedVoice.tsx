import React, { useEffect, useRef, useState } from "react";
import { Button, Text, View } from "react-native";
import { Native } from "./native";
const { languageState } = require("../../shared/language-state.cjs");
const i18n = require("../../shared/i18n.cjs");
export function TranslatedVoice({ transcript, source, target, tts, installed, ui }: {
  transcript: string; source: string; target: string; tts: string; installed: Record<string, boolean>; ui: string;
}) {
  const t = (s: string) => i18n.translate(s, ui);
  const state = languageState(transcript, source, target, tts, installed);
  const [translated, setTranslated] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setTranslated(""); setError(""); }, [transcript, source, target]);
  return <View style={{ gap: 8 }}>
    <Text>{t("Original audio remains available")}</Text>
    <Button title={t("Translate source transcript")} disabled={busy || !!state.translationReason} onPress={async () => {
      setBusy(true); setError(""); const ticket = generation.current; try { const text = state.route === "identity" ? transcript : await Native.translate(transcript, source, target); if (ticket === generation.current) setTranslated(text); }
      catch (e: any) { setError(e.message); } finally { setBusy(false); }
    }} />
    {!!translated && <Text selectable>{translated}</Text>}
    <Button title={t("Play translated speech")} disabled={busy || !translated || !!state.speechReason} onPress={async () => {
      setBusy(true); setError(""); try { await Native.speak(translated, tts); }
      catch (e: any) { setError(e.message); } finally { setBusy(false); }
    }} />
    {!!state.speechReason && <Text>{t(state.speechReason)}</Text>}
    {!!error && <Text accessibilityRole="alert">{t(error)}</Text>}
  </View>;
}
