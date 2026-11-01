import React, { useEffect, useRef, useState } from "react";
import { AppState, Alert, Button, Text, View } from "react-native";
import { Native, permissions } from "./native";
const i18n = require("../../shared/i18n.cjs");

export function MeshVoicePanel({
  color,
  active,
  source,
  ui,
  installed,
  available,
  onSent,
}: {
  color: string;
  active: boolean;
  source: string;
  ui: string;
  installed: Record<string, boolean>;
  available: Record<string, any>;
  onSent: (
    id: string,
    uri: string,
    language: string,
    transcript: string,
  ) => Promise<void>;
}) {
  const t = (s: string) => i18n.translate(s, ui);
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(""),
    [language, setLanguage] = useState(source);
  const [transcript, setTranscript] = useState(""),
    [error, setError] = useState("");
  const owns = useRef(false),
    generation = useRef(0),
    timer = useRef<any>(null);
  const stop = async () => {
    if (!owns.current) return;
    owns.current = false;
    clearTimeout(timer.current);
    setRecording(false);
    setBusy(true);
    try {
      setDraft(await Native.finishVoice());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const cancel = () => {
      generation.current++;
      clearTimeout(timer.current);
      if (owns.current) {
        owns.current = false;
        Native.cancelRecording();
        setRecording(false);
      }
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
    });
    return () => {
      sub.remove();
      cancel();
    };
  }, []);
  const record = async () => {
    const ticket = ++generation.current;
    setError("");
    setBusy(true);
    try {
      await permissions("mic");
      if (ticket !== generation.current) return;
      await Native.startMeshRecording();
      if (ticket !== generation.current) {
        await Native.cancelRecording();
        return;
      }
      owns.current = true;
      setRecording(true);
      setDraft("");
      setTranscript("");
      setLanguage(source);
      timer.current = setTimeout(stop, 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
<<<<<<< HEAD
  return (
    <View style={{ gap: 10, paddingVertical: 12 }}>
      <Text style={{ color }}>
        {t("Public mesh voice · maximum 3 seconds")}
      </Text>
      <Text style={{ color }}>
        {t(
          "Audio and transcripts are public. Every receiving phone and relay can read them. Use paired direct mode for private voice.",
        )}
      </Text>
      <Button
        title={t(recording ? "Finish public recording" : "Record public note")}
        disabled={busy || !active}
        onPress={recording ? stop : record}
      />
      {!!draft && (
        <>
          <Button
            title={t("Play original draft")}
            onPress={() =>
              Native.playVoice(draft).catch((e: any) => setError(e.message))
            }
          />
          <Button
            title={t("Add source transcript (optional)")}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                const reason =
                  require("../../shared/language-state.cjs").recognitionReason(
                    language,
                    installed,
                    available,
                  );
                if (reason) throw new Error(t(reason));
                const text = await Native.transcribeVoice(draft, language);
                if (text.length > 256)
                  throw new Error(
                    t(
                      "Transcript exceeds 256 characters. Original audio is still available.",
                    ),
                  );
                setTranscript(text);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Text style={{ color }}>
            {language}
            {transcript ? `: ${transcript}` : ""}
          </Text>
          <Button
            title={t("Broadcast public voice")}
            disabled={busy || !active}
            onPress={() =>
              Alert.alert(
                t("Broadcast public voice?"),
                t(
                  "Nearby phones and relays can listen. This audio is not private.",
                ),
                [
                  { text: t("Cancel"), style: "cancel" },
                  {
                    text: t("Broadcast public voice"),
                    onPress: async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const id = await Native.sendMeshVoice(
                          draft,
                          language,
                          transcript,
                        );
                        await onSent(id, draft, language, transcript);
                        setDraft("");
                        setTranscript("");
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    },
                  },
                ],
              )
            }
          />
        </>
      )}
      {!!error && (
        <Text style={{ color }} accessibilityRole="alert">
          {t(error)}
        </Text>
      )}
    </View>
  );
=======
  return <View style={{ gap: 10, paddingVertical: 12 }}>
    <Text style={{color}}>{t("Public mesh voice · maximum 3 seconds")}</Text>
    <Text style={{color}}>{t("Audio and transcripts are public. Every receiving phone and relay can read them. Use paired direct mode for private voice.")}</Text>
    <Button title={t(recording ? "Finish public recording" : "Record public note")} disabled={busy || !active} onPress={recording ? stop : record} />
    {!!draft && <>
      <Button title={t("Play original draft")} onPress={() => Native.playVoice(draft, 0).catch((e: any) => setError(e.message))} />
      <Button title={t("Add source transcript (optional)")} disabled={busy} onPress={async () => {
        setBusy(true); setError(""); try { const reason = require("../../shared/language-state.cjs").recognitionReason(language, installed, available); if (reason) throw new Error(t(reason)); const text = await Native.transcribeVoice(draft, language);
          if (text.length > 256) throw new Error(t("Transcript exceeds 256 characters. Original audio is still available."));
          setTranscript(text);
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }} />
      <Text style={{color}}>{language}{transcript ? `: ${transcript}` : ""}</Text>
      <Button title={t("Broadcast public voice")} disabled={busy || !active} onPress={() => Alert.alert(
        t("Broadcast public voice?"), t("Nearby phones and relays can listen. This audio is not private."), [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Broadcast public voice"), onPress: async () => {
            setBusy(true); setError(""); try { const id = await Native.sendMeshVoice(draft, language, transcript);
              await onSent(id, draft, language, transcript); setDraft(""); setTranscript("");
            } catch (e: any) { setError(e.message); } finally { setBusy(false); }
          } },
        ],
      )} />
    </>}
    {!!error && <Text style={{color}} accessibilityRole="alert">{t(error)}</Text>}
  </View>;
>>>>>>> ca0b81cf6bd8af384207257cab5f07e47bfe9ed7
}
