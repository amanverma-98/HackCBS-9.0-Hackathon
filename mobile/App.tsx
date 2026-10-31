import React, { useEffect, useRef, useState } from "react";
import {
  Alert as NativeAlert,
  Animated,
  AppState,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text as NativeText,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { RadarPeers } from "./src/RadarPeers";
import { TranslatedVoice } from "./src/TranslatedVoice";
import { MeshVoicePanel } from "./src/MeshVoicePanel";
import { Native, Mesh, events, permissions } from "./src/native";
import { DEFAULT_BACKEND_URL, DEFAULT_MANIFEST_URL } from "./src/config";
import { LANGUAGES, position, prune, validMessage } from "../shared/core.cjs";
import alertData from "../shared/alerts.json";
import upstream from "../model-host/upstream-manifest.json";
import { PushToTalk } from "../shared/ptt.cjs";
const onboarding = require("../shared/onboarding.cjs");
const i18n = require("../shared/i18n.cjs");
const locationPolicy = require("../shared/location.cjs");
const packUtils = require("../shared/model-packs.cjs");
let activeUi = "en";
function localized(value: any): any {
  if (typeof value === "string") return i18n.translate(value, activeUi);
  if (Array.isArray(value)) return value.map(localized);
  return value;
}
function Text(props: any) {
  return <NativeText {...props}>{localized(props.children)}</NativeText>;
}
const Alert = {
  alert: (title: string, message?: string, buttons?: any, options?: any) =>
    NativeAlert.alert(
      localized(title),
      localized(message),
      buttons?.map((button: any) => ({
        ...button,
        text: localized(button.text),
      })),
      options,
    ),
};
type Message = {
  id: string;
  kind: string;
  text: string;
  language: string;
  time: number;
  direction: "in" | "out";
  status: string;
  queued?: boolean;
  template?: string;
  name?: string;
  audioUri?: string;
  durationMs?: number;
  mesh?: boolean;
  transcript?: string;
  recipient?: string;
};
type Settings = {
  settingsVersion: number;
  setup: boolean;
  name: string;
  deviceId: string;
  role: string;
  verificationStatus: "unverified";
  sourceSpeech: string;
  targetTranslation: string;
  ttsVoice: string;
  ui: string;
  theme: string;
  manifestUrl: string;
  backend: string;
  shareLocation: boolean;
  sirenEnabled: boolean;
  photo: string;
  haptics: boolean;
  sounds: boolean;
  autoPlay: boolean;
  reviewSpeech: boolean;
  voiceMode: "translated" | "original";
  messages: Message[];
};
type Colors = {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
};


const templates = alertData as Record<string, Record<string, string>>;
const langs = LANGUAGES as { code: string; native: string; name: string }[];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
const initial: Settings = {
  settingsVersion: 2,
  setup: false,
  name: "",
  deviceId: uid(),
  role: "citizen",
  verificationStatus: "unverified",
  sourceSpeech: "hi",
  targetTranslation: "mr",
  ttsVoice: "mr",
  ui: "en",
  theme: "system",
  manifestUrl: DEFAULT_MANIFEST_URL,
  backend: DEFAULT_BACKEND_URL,
  shareLocation: false,
  sirenEnabled: false,
  photo: "",
  haptics: true,
  sounds: true,
  autoPlay: true,
  reviewSpeech: false,
  voiceMode: "translated",
  messages: [],
};


const tabKeys = ["Talk", "Radar", "Alert", "History", "Settings"];
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  c,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        {
          backgroundColor: secondary ? c.bg : "#1769AA",
          borderColor: c.line,
          borderWidth: secondary ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? c.ink : "#FFF",
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  c,
}: any) {
  return (
    <TextInput
      accessibilityLabel={localized(placeholder)}
      placeholder={localized(placeholder)}
      placeholderTextColor={c.muted}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      maxLength={multiline ? 2000 : 500}
      style={[
        s.input,
        { color: c.ink, borderColor: c.line, minHeight: multiline ? 88 : 48 },
      ]}
    />
  );
}

function notifyMessage(setError: (message: string) => void) {
  try {
    if (Native && typeof Native.vibrateForMessage === "function") {
      Native.vibrateForMessage().catch(() => {});
    }
  } catch {
    // Notification feedback must never interrupt receiving or speech playback.
  }
}

export default function App() {
  const [data, setData] = useState(initial),
    ref = useRef(data),
    [loaded, setLoaded] = useState(false),
    [step, setStep] = useState(0),
    [tab, setTab] = useState("talk"),
    [route, setRoute] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [text, setText] = useState(""),
    [connected, setConnected] = useState(false),
    paired = useRef(false),
    [peerName, setPeerName] = useState("Peer"),
    peerId = useRef(""),
    peerLabel = useRef("Peer");
  const [showConnect, setShowConnect] = useState(false),
    [peers, setPeers] = useState<any[]>([]),
    [transport, setTransport] = useState("all"),
    [pairCode, setPairCode] = useState(""),
    [radioStatus, setRadioStatus] = useState("Ready to connect"),
    [hostingTransport, setHostingTransport] = useState<
      "wifi" | "bluetooth" | null
    >(null),
    [connectionState, setConnectionState] = useState<
      | "idle"
      | "scanning"
      | "hosting"
      | "joining"
      | "pairing"
      | "connected"
      | "failed"
    >("idle");
  const [peerFilter, setPeerFilter] = useState<"all" | "direct" | "relayed">("all");
  const [packs, setPacks] = useState<Record<string, boolean>>({}),
    packsRef = useRef(packs),
    [packDetails, setPackDetails] = useState<Record<string, any>>({}),
    [manifest, setManifest] = useState<any>(null),
    [downloading, setDownloading] = useState(""),
    [downloadError, setDownloadError] = useState(""),
    [downloadPaused, setDownloadPaused] = useState(""),
    pauseRequested = useRef(""),
    [progress, setProgress] = useState<any>(null);
  const [recording, setRecording] = useState(false),
    [pttState, setPttState] = useState<
      "idle" | "arming" | "recording" | "processing"
    >("idle"),
    recordStart = useRef<Promise<void> | null>(null),
    pttPressed = useRef(false),
    recordingRef = useRef(false),
    pttScale = useRef(new Animated.Value(1)).current,
    requesting = useRef(false),
    localFloor = useRef(false),
    remoteFloor = useRef(false),
    remoteFloorTimer = useRef<any>(null),
    floorPromise = useRef<any>(null);
  const [location, setLocation] = useState<any>(null),
    [peerLocation, setPeerLocation] = useState<any>(null),
    [heading, setHeading] = useState(0),
    [clock, setClock] = useState(Date.now()),
    [metrics, setMetrics] = useState<any>({}),
    [filter, setFilter] = useState("all"),
    [token, setToken] = useState(""),
    [answer, setAnswer] = useState("");
  const [sirenEnabled, setSirenEnabled] = useState(false);
  const [meshActive, setMeshActive] = useState(false),
    [meshNode, setMeshNode] = useState(""),
    [meshPeers, setMeshPeers] = useState<string[]>([]),
    [meshText, setMeshText] = useState("");
  const [meshLinkSeen, setMeshLinkSeen] = useState<Record<string, number>>({});
  const [meshLocations, setMeshLocations] = useState<Record<string, any>>({}),
    [meshSharing, setMeshSharing] = useState(false), [peerRole, setPeerRole] = useState("unknown"),
    [compassMeta, setCompassMeta] = useState<any>(null);
  const meshSharingRef = useRef(false), meshEnabledRef = useRef(false), meshIdRef = useRef(""), lastMeshPosition = useRef(0);
  const [sensorStatus, setSensorStatus] = useState(
    "Waiting for a location fix",
  );
  const [voiceCapable, setVoiceCapable] = useState(false);
  const voicePeer = useRef(false),
    locationRef = useRef<any>(null);
  const ptt = useRef<any>(null),
    maxRecording = useRef<any>(null);
  const clipLanguage = useRef("hi"),
    clipMode = useRef("translated");
  const audioBusy = useRef(0);
  const saveChain = useRef(Promise.resolve()),
    receiveChain = useRef(Promise.resolve());
  const system = useColorScheme(),
    dark =
      data.theme === "dark" || (data.theme === "system" && system === "dark");
  const c: Colors = dark
    ? {
        bg: "#071426",
        card: "#10243D",
        ink: "#F1F7FF",
        muted: "#AFC2D8",
        line: "#2A4566",
      }
    : {
        bg: "#F2F7FC",
        card: "#FFFFFF",
        ink: "#102A43",
        muted: "#607A96",
        line: "#D5E3F1",
      };
  activeUi = data.ui || "en";
  i18n.setLocale(activeUi);
  const tabs = tabKeys.map((key) => i18n.translate(key, activeUi));
  const update = (patch: Partial<Settings>) => {
    const next = { ...ref.current, ...patch };
    ref.current = next;
    setData(next);
    return next;
  };
  const persist = async (next: Settings) => {
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() => Native.saveState(JSON.stringify(next)));
    await saveChain.current;
  };
  const change = (patch: Partial<Settings>) => {
    persist(update(patch)).catch((e: any) => setError(e.message));
  };
  const feedback = (kind = "tap") => {
    if (ref.current.haptics)
      Native.feedback(kind).catch((e: any) => setError(e.message));
  };
  const run = async (fn: () => Promise<any>, label = "") => {
    setError("");
    if (label) setBusy(label);
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      if (label) setBusy("");
    }
  };

  const wire = async (m: any) => Native.send(JSON.stringify(m));
  const sendPosition = async (fix: any) => {
    if (!locationPolicy.usableLocation(fix)) return;
    const now = Date.now();
    if (ref.current.shareLocation && paired.current) await wire({ id: uid(), kind: "position", time: now, expires: fix.time + 30000,
      ageMs: Math.max(0, now - fix.time), coords: { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy } });
    if (meshEnabledRef.current && meshSharingRef.current && now - lastMeshPosition.current >= 10000) {
      lastMeshPosition.current = now;
      await Native.shareMeshPosition(JSON.stringify({ time: now, expires: fix.time + 30000, coords: fix, name: ref.current.name, role: ref.current.role }));
    }
  };
  const control = (op: string, extra: any = {}) =>
    wire({
      id: uid(),
      kind: "floor",
      op,
      time: Date.now(),
      deviceId: ref.current.deviceId,
      ...extra,
    });

  const status = async (source = manifest || upstream) => {
    const p = JSON.parse(await Native.packStatus(JSON.stringify(source)));
    const installed = Object.fromEntries(
      Object.entries(p).map(([code, value]: any) => [
        code,
        value.installed === true,
      ]),
    );
    packsRef.current = installed;
    setPacks(installed);
    setPackDetails(p);
  };

  const add = async (m: Message) =>
    persist(update({ messages: prune([...ref.current.messages, m]) }));
  const phrase = (key: string, language: string) =>
    Object.prototype.hasOwnProperty.call(templates, key)
      ? templates[key][language]
      : undefined;
  async function play(m: Message) {
    if (ptt.current?.active)
      throw new Error("Finish recording before playing a message");
    audioBusy.current++;
    setBusy("Playing speech on this phone…");
    try {
      if (m.kind === "voice" && m.audioUri) {
        await Native.playVoice(m.audioUri);
        return;
      }

      const target = ref.current.targetTranslation;
      if (ref.current.ttsVoice !== target)
        throw new Error(
          "Choose the same language for translation target and TTS voice to play translated text.",
        );
      let spoken = m.template ? phrase(m.template, target) : undefined;
      if (!spoken)
        spoken =
          m.language === ref.current.targetTranslation
            ? m.text
            : await Native.translate(
                m.text,
                m.language,
                ref.current.targetTranslation,
              );
      await Native.speak(spoken, ref.current.ttsVoice);
    } finally {
      audioBusy.current--;
      if (!audioBusy.current) setBusy("");
    }
  }



  async function receive(m: any) {
    if (!validMessage(m)) return;
    if (m.kind === "ack") {
      change({
        messages: ref.current.messages.map((x) =>
          x.direction === "out" && x.id === m.ack
            ? { ...x, status: "delivered" }
            : x,
        ),
      });
      return;
    }


    if (m.kind === "profile") {
      peerLabel.current = String(m.name || "Peer").slice(0, 40);
      setPeerName(peerLabel.current);
      setPeerRole(onboarding.ROLES.includes(m.role) ? m.role : "unknown");
      peerId.current = String(m.deviceId || "");
      voicePeer.current = m.capabilities?.includes("voice-pcm-v1") === true;
      setVoiceCapable(voicePeer.current);
      return;
    }
    if (m.kind === "position-off") {
      setPeerLocation(null);
      return;
    }


    if (m.kind === "position") {
      const fix = { ...m.coords, time: m.time - Math.max(0, Number(m.ageMs) || 0), expires: m.expires || m.time + 30000 };
      if (locationPolicy.usableLocation(fix)) setPeerLocation(fix);
      return;
    }

    
    if (!["text", "alert", "voice"].includes(m.kind)) return;
    if (
      !ref.current.messages.some((x) => x.id === m.id && x.direction === "in")
    ) {
      const incoming: Message = {
        ...m,
        direction: "in",
        status: "received",
        name: peerLabel.current,
      };
      await add(incoming);
      await wire({ id: uid(), kind: "ack", ack: m.id, time: Date.now() });
      feedback("message");
      if (m.kind === "alert")
        Alert.alert(
          "Incoming alert",
          m.template
            ? phrase(m.template, ref.current.targetTranslation) || m.text
            : m.text,
        );
      if (!m.queued && ref.current.autoPlay && !ptt.current?.active)
        await play(incoming);
    } else await wire({ id: uid(), kind: "ack", ack: m.id, time: Date.now() });
  }
  async function receiveMesh(e: any) {
    if (!e?.id || !e?.body) return;
    if (!ref.current.messages.some((m) => m.id === e.id && m.direction === "in")) {
      const incoming: Message = {
        id: e.id,
        kind: e.type === "meshSOS" ? "alert" : "text",
        text: e.body,
        language: "und",
        time: Number(e.created) || Date.now(),
        direction: "in",
        status: "received",
        name: "BLE mesh",
      };
      await add(incoming);
      if (e.type === "meshSOS") Alert.alert("Mesh SOS", e.body);
    }
    await Mesh.acknowledgeInbox(e.id);
  }
  async function onFloor(m: any) {
    if (!validMessage(m) || m.kind !== "floor") return;
    if (m.op === "release") {
      remoteFloor.current = false;
      clearTimeout(remoteFloorTimer.current);
      return;
    }
    if (m.op === "grant" || m.op === "deny") {
      if (floorPromise.current && m.request === floorPromise.current.id) {
        floorPromise.current.resolve(m.op === "grant");
        floorPromise.current = null;
      }
      return;
    }
    if (m.op === "request") {
      const winsTie =
        requesting.current && ref.current.deviceId < String(m.deviceId || "");
      const grant =
        !localFloor.current &&
        !remoteFloor.current &&
        !audioBusy.current &&
        !winsTie;
      if (grant) {
        remoteFloor.current = true;
        clearTimeout(remoteFloorTimer.current);
        remoteFloorTimer.current = setTimeout(() => {
          remoteFloor.current = false;
        }, 60000);
        if (requesting.current && floorPromise.current) {
          floorPromise.current.resolve(false);
          floorPromise.current = null;
        }
      }
      await control(grant ? "grant" : "deny", { request: m.id });
    }
  }
  useEffect(() => {
    Native.loadState()
      .then((raw: string) => {
        const previous = JSON.parse(raw);
        const d = onboarding.migrateSettings(previous, initial);
        const migrated = { ...initial, ...d, messages: prune(d.messages) };
        update(migrated);
        if (previous?.settingsVersion !== 2)
          persist(migrated).catch((e: any) => setError(e.message));
        setSirenEnabled(d.sirenEnabled === true);
        setLoaded(true);
      })
      .catch((e: any) => {
        setError(e.message);
        setLoaded(true);
      });
    status().catch((e: any) => setError(e.message));
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const sub = events.addListener("Talk2Event", (raw: string) => {
      try {
        const e = JSON.parse(raw);
        if (e.type === "error") {
          setError(e.message);
          setConnectionState("failed");
          setRadioStatus(e.message || "Connection failed");
        }
        if (e.type === "voiceError") setError(e.message);
        if (e.type === "meshVoice") receiveChain.current = receiveChain.current.catch(() => {}).then(async () => {
          if (!ref.current.messages.some(m => m.id === e.id && m.direction === "in")) await add({ id: e.id, kind: "voice", text: e.transcript || "Public voice note", transcript: e.transcript, language: e.language, time: e.created, direction: "in", status: "received", mesh: true, audioUri: e.audioUri, durationMs: e.durationMs, name: e.sender.slice(0, 8) });
        }).catch((x: any) => setError(x.message));
        if (e.type === "meshVoiceOutgoing") receiveChain.current = receiveChain.current.catch(() => {}).then(async () => {
          if (!ref.current.messages.some(m => m.id === e.id && m.direction === "out")) await add({ id:e.id, kind:"voice", text:e.transcript || "Public voice note", transcript:e.transcript, language:e.language, time:e.created, direction:"out", status:e.status, mesh:true, audioUri:e.audioUri, recipient:e.recipient });
        }).catch((x:any) => setError(x.message));
        if (e.type === "meshVoiceStatus" && ref.current.messages.some(m => m.id === e.id && m.mesh && (m.status !== e.status || (m.recipient || "") !== (e.recipient || "")))) change({ messages: ref.current.messages.map(m => m.id === e.id && m.mesh ? { ...m, status: e.status, recipient: e.recipient } : m) });
        if (e.type === "meshPosition" && e.sender !== meshIdRef.current) setMeshLocations(old => locationPolicy.mergeLocationPeer(old, e));
        if (e.type === "meshNeighbor") setMeshLinkSeen(old => { const next = { ...old }; if (e.connected) next[e.id] = Date.now(); else delete next[e.id]; return next; });
        if (e.type === "meshVoicePiece") setMeshLinkSeen(old => old[e.neighbor] ? { ...old, [e.neighbor]: Date.now() } : old);
        if (e.type === "meshNeighbor") setMeshPeers((old) => e.connected ? (old.includes(e.id) ? old : [...old, e.id]) : old.filter((id) => id !== e.id));
        if (e.type === "meshError") setError(e.message || "BLE mesh error");
        if (e.type === "meshStopped") { meshEnabledRef.current = false; meshSharingRef.current = false; setMeshSharing(false); setMeshActive(false); setMeshPeers([]); setMeshLinkSeen({}); }
        if (e.type === "meshMessage" || e.type === "meshSOS") receiveMesh(e).catch((x: any) => setError(x.message));
        if (e.type === "meshReceipt") setRadioStatus("Mesh destination receipt received");
        if (e.type === "sensorStatus") setSensorStatus(e.message);
        if (e.type === "status") {
          setRadioStatus(e.state);
          if (e.state === "Waiting for peer") setConnectionState("hosting");
        }
        if (e.type === "peer")
          setPeers((p) =>
            p.some((x) => x.id === e.id && x.transport === e.transport)
              ? p.map(x => x.id === e.id ? { ...x, lastSeen: Date.now() } : x)
              : [...p, { ...e, lastSeen: Date.now() }],
          );
        if (e.type === "pairing") {
          setPairCode(e.code);
          setShowConnect(false);
          setConnectionState("pairing");
          setRadioStatus("Verify the pairing code");
        }
        if (e.type === "connected") {
          paired.current = true;
          setConnected(true);
          setConnectionState("connected");
          setRadioStatus("Connected");
          setPeerLocation(null);
          wire({
            id: uid(),
            kind: "profile",
            time: Date.now(),
            name: ref.current.name,
            role: ref.current.role,
            deviceId: ref.current.deviceId,
            capabilities: ["voice-pcm-v1"],
          }).catch((x: any) => setError(x.message));
          if (ref.current.shareLocation) {
            permissions("location")
              .then(() => Native.startSensors())
              .then(() => sendPosition(locationRef.current))
              .catch((x: any) => setError(x.message));
          }
        }
        if (e.type === "disconnected") {
          paired.current = false;
          setConnected(false);
          setConnectionState("idle");
          setRadioStatus("Disconnected");
          setHostingTransport(null);
          setPeerLocation(null);
          setPairCode("");
          localFloor.current = false;
          remoteFloor.current = false;
          voicePeer.current = false;
          setVoiceCapable(false);
          if (floorPromise.current) {
            floorPromise.current.resolve(false);
            floorPromise.current = null;
          }
          ptt.current?.cancel();
        }
        if (e.type === "message") {
          if (e.kind === "floor")
            onFloor(e).catch((x: any) => setError(x.message));
          else if (
            ["position", "position-off", "profile", "ack"].includes(e.kind)
          )
            receive(e).catch((x: any) => setError(x.message));
          else {
            if (e.kind === "alert" && ref.current.sounds) Native.alertTone();
            receiveChain.current = receiveChain.current
              .then(() => receive(e))
              .catch((x: any) => setError(x.message));
          }
        }
        if (e.type === "heading") { setHeading(e.degrees); setCompassMeta({ ...e, time: Date.now() }); }
        if (e.type === "location") {
          locationRef.current = e;
          setLocation(e);
          setSensorStatus(
            `${e.provider || "GPS"} · ±${Math.round(e.accuracy)} m`,
          );
          sendPosition(e)?.catch((x: any) => setError(x.message));
        }
        if (e.type === "download") setProgress(e);
        if (e.type === "metric") setMetrics((m: any) => ({ ...m, ...e }));
      } catch (e: any) {
        setError(e.message);
      }
    });
    const app = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        ptt.current?.cancel();
        requesting.current = false;
        if (floorPromise.current) {
          floorPromise.current.resolve(false);
          floorPromise.current = null;
        }
        Native.stopSensors();
      } else if (ref.current.shareLocation)
        permissions("location")
          .then(() => Native.startSensors())
          .catch((e: any) => setError(e.message));
    });
    return () => {
      sub.remove();
      app.remove();
      clearInterval(timer);
      clearTimeout(remoteFloorTimer.current);
      Native.stopSensors();
      ptt.current?.cancel();
    };
  }, []);
  async function loadManifest() {
    if (!ref.current.manifestUrl.trim()) {
      setManifest(upstream);
      await status(upstream);
      return upstream;
    }
    if (!ref.current.manifestUrl.startsWith("https://"))
      throw new Error("Use an HTTPS manifest.json URL");
    const response = await fetch(ref.current.manifestUrl, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    const m = await response.json();
    if (m.schema !== 1 || !m.packs) throw new Error("Invalid Talk2 manifest");
    setManifest(m);
    await status(m);
    return m;
  }
  async function install(code: string) {
    if (downloading) return;
    setDownloading(code);
    setDownloadError("");
    setDownloadPaused("");
    pauseRequested.current = "";
    try {
      const m = manifest || (await loadManifest());
      if (!m.packs[code])
        throw new Error(
          code === "hi"
            ? "Hindi weights are absent from the supplied release. Add its four matching files to your own release; see MODEL_HOSTING.md."
            : `${code} is missing from this release.`,
        );
      await Native.installPack(code, JSON.stringify(m));
      await status();
      setProgress(null);
    } catch (e) {
      if (pauseRequested.current === code) setDownloadPaused(code);
      else setDownloadError(code);
      await status().catch(() => {});
      throw e;
    } finally {
      pauseRequested.current = "";
      setDownloading("");
    }
  }
  async function send(
    content: string,
    kind = "text",
    template?: string,
    language = ref.current.sourceSpeech,
  ) {
    const value = content.trim();
    if (!value) return;
    if (kind === "alert" && !paired.current)
      throw new Error(
        "Pair both phones before sending an alert. Alerts are never queued.",
      );
    const m: Message = {
      id: uid(),
      kind,
      text: value,
      language,
      time: Date.now(),
      direction: "out",
      status: paired.current ? "pending" : "queued",
      queued: !paired.current,
      template,
    };
    await add(m);
    if (paired.current) {
      try {
        await wire(m);
      } catch (e) {
        change({
          messages: ref.current.messages.map((x) =>
            x.id === m.id ? { ...x, status: "failed" } : x,
          ),
        });
        throw e;
      }
    }
    feedback();
    setText("");
  }
  async function retry(m: Message) {
    if (!paired.current) throw new Error("Connect first");
    if (m.kind === "voice") {
      if (!voicePeer.current)
        throw new Error(
          "Update Talk2 on both phones for original voice messages",
        );
      await Native.sendVoice(
        m.audioUri,
        JSON.stringify({ ...m, queued: true }),
      );
    } else await wire({ ...m, queued: true });
    change({
      messages: ref.current.messages.map((x) =>
        x.id === m.id ? { ...x, status: "pending" } : x,
      ),
    });
  }
  async function acquireFloor() {
    if (!paired.current) return;
    if (remoteFloor.current) throw new Error("Your peer is speaking");
    requesting.current = true;
    const requestId = uid();
    const result = new Promise<boolean>((resolve) => {
      floorPromise.current = { id: requestId, resolve };
      setTimeout(() => {
        if (floorPromise.current?.id === requestId) {
          floorPromise.current = null;
          resolve(false);
        }
      }, 5000);
    });
    await wire({
      id: requestId,
      kind: "floor",
      op: "request",
      time: Date.now(),
      deviceId: ref.current.deviceId,
    });
    if (!(await result)) {
      await control("release").catch(() => {});
      throw new Error("Channel busy or peer did not respond");
    }
    localFloor.current = true;
  }
  async function sendOriginal(uri: string) {
    const m: Message = {
      id: uid(),
      kind: "voice",
      text: "Voice message",
      audioUri: uri,
      language: clipLanguage.current,
      time: Date.now(),
      direction: "out",
      status: paired.current ? "pending" : "queued",
      queued: !paired.current,
    };
    await add(m);
    if (paired.current) {
      if (!voicePeer.current)
        throw new Error(
          "Update Talk2 on both phones for original voice messages. The clip is saved for retry.",
        );
      try {
        await Native.sendVoice(uri, JSON.stringify(m));
      } catch (e) {
        change({
          messages: ref.current.messages.map((x) =>
            x.id === m.id ? { ...x, status: "failed" } : x,
          ),
        });
        throw e;
      }
    }
    feedback();
  }
  if (!ptt.current)
    ptt.current = new PushToTalk({
      state: (state: any) => {
        setPttState(state);
        setRecording(state === "recording");
        recordingRef.current = state === "recording";
        clearTimeout(maxRecording.current);
        if (state === "recording") {
          feedback();
          maxRecording.current = setTimeout(() => ptt.current.release(), 20000);
        }
        if (state === "processing") setBusy("Processing your voice…");
        if (state === "idle") setBusy("");
      },
      error: (e: any) => {
        setError(e.message || String(e));
        feedback("error");
      },
      prepare: async () => {
        setError("");
        clipLanguage.current = ref.current.sourceSpeech;
        clipMode.current = ref.current.voiceMode;
        if (
          clipMode.current === "translated" &&
          !packsRef.current[clipLanguage.current]
        )
          throw new Error(
            "Download the active speech pack, or choose Original voice in Settings.",
          );
        if (
          clipMode.current === "original" &&
          paired.current &&
          !voicePeer.current
        )
          throw new Error(
            "Original voice requires this Talk2 version on both phones.",
          );
        await permissions("mic");
      },
      acquire: acquireFloor,
      start: () => Native.startRecording(),
      cancel: () => Native.cancelRecording(),
      finish: async () => {
        if (clipMode.current === "original") {
          const uri = await Native.finishVoice();
          await sendOriginal(uri);
          return;
        }
        const recognized = await Native.stopRecording(clipLanguage.current);
        if (!recognized.trim())
          throw new Error(
            "No speech recognized. Try speaking closer to the microphone.",
          );
        if (ref.current.reviewSpeech) setText(recognized);
        else await send(recognized, "text", undefined, clipLanguage.current);
      },
      release: async () => {
        requesting.current = false;
        if (localFloor.current) {
          localFloor.current = false;
          if (paired.current) await control("release");
        }
      },
    });
  const begin = () => {
    if (!busy && !audioBusy.current) ptt.current.press();
  };
  const end = () => {
    ptt.current.release();
  };
  const disconnect = () =>
    run(async () => {
      await Native.disconnect();
      paired.current = false;
      setConnected(false);
      setPeerLocation(null);
      setPairCode("");
      localFloor.current = false;
      remoteFloor.current = false;
    });
  const button = (
    title: string,
    onPress: () => any,
    secondary = false,
    disabled = false,
  ) => <Button {...{ title, onPress, secondary, disabled, c }} />;
  const field = (
    value: string,
    onChangeText: (s: string) => void,
    placeholder: string,
    multiline = false,
    secureTextEntry = false,
  ) => (
    <Field
      {...{ value, onChangeText, placeholder, multiline, secureTextEntry, c }}
    />
  );
  const label = (text: string) => (
    <Text style={[s.label, { color: c.muted }]}>{text}</Text>
  );
  const card = (children: React.ReactNode, key?: string) => (
    <View
      key={key}
      style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}
    >
      {children}
    </View>
  );
  const title = (text: string) => (
    <Text style={[s.subtitle, { color: c.ink }]}>{text}</Text>
  );
  const note = (text: string) => (
    <Text style={{ color: c.muted, lineHeight: 21 }}>{text}</Text>
  );
  const roleLabels: Record<string, string> = {
    citizen: "Citizen",
    volunteer: "Volunteer",
    medical_support: "Medical / support",
    emergency_staff: "Emergency staff",
  };
  const verification = onboarding.verificationDisplay(data.role);
  const option = (
    icon: string,
    name: string,
    detail: string,
    value: boolean,
    onChange: (value: boolean) => void,
  ) => (
    <View style={[s.row, { paddingVertical: 8 }]}>
      <Text style={{ fontSize: 23, color: "#347453", width: 34 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        {title(name)}
        {note(detail)}
      </View>
      <Switch
        accessibilityLabel={name}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.line, true: "#9CD5B2" }}
        thumbColor={value ? "#347453" : "#DDD"}
      />
    </View>
  );
  const profilePhoto = () => (
    <>
      <View style={s.avatar}>
        {data.photo ? (
          <Image
            key={data.photo}
            source={{ uri: data.photo }}
            accessibilityLabel="Your profile photo"
            style={{ width: 88, height: 88, borderRadius: 44 }}
            onError={() =>
              setError("Photo could not be opened. Choose it again.")
            }
          />
        ) : (
          <Text style={{ fontSize: 32, color: "#347453" }}>
            {data.name.slice(0, 1).toUpperCase() || "T"}
          </Text>
        )}
      </View>
      {button(
        "▣ Choose profile photo",
        () =>
          run(async () => {
            const uri = await Native.chooseProfilePhoto();
            if (uri) change({ photo: uri });
          }),
        true,
      )}
      {!!data.photo &&
        button("Remove photo", () => change({ photo: "" }), true)}
      {note(
        "Your photo stays on this phone. Only your name is shared with a paired peer.",
      )}
    </>
  );
  const setLocationSharing = (value: boolean) => {
    change({ shareLocation: value });
    if (value)
      run(async () => {
        await permissions("location");
        await Native.startSensors();
        await sendPosition(locationRef.current);
      });
    else {
      if (!meshSharingRef.current) Native.stopSensors();
      if (paired.current)
        wire({ id: uid(), kind: "position-off", time: Date.now() }).catch(
          (e: any) => setError(e.message),
        );
    }
  };
  const clearHistory = () =>
    Alert.alert(
      "Clear history?",
      "Deletes messages, unsent drafts in history, and saved voice clips on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () =>
            run(async () => {
              if (audioBusy.current || ptt.current.active)
                throw new Error("Wait for recording or playback to finish");
              await persist(update({ messages: [] }));
              await Native.clearVoiceHistory();
            }),
        },
      ],
    );
  function languageList() {
    const knownManifest = manifest || upstream;
    return (
      <>
        {label("SPEECH PACKS · DOWNLOAD OPTIONAL")}
        {langs.map((l) => {
          const details = packDetails[l.code] || {};
          const spec = knownManifest.packs?.[l.code];
          const expectedBytes =
            details.expectedBytes ||
            spec?.files?.reduce((n: number, f: any) => n + f.bytes, 0) ||
            0;
          const downloadedBytes =
            progress?.pack === l.code
              ? progress.done
              : details.partialBytes || 0;
          const pack = packUtils.packStatus({
            code: l.code,
            inManifest: details.available ?? !!spec,
            installed: !!packs[l.code],
            downloading: downloading === l.code,
            paused: downloadPaused === l.code,
            failed: downloadError === l.code,
            downloadedBytes,
            expectedBytes,
          });
          const stateLabel =
            pack.state === "installed"
              ? "Installed · checksum verified"
              : pack.state === "unavailable"
                ? "Not in this release"
                : pack.state === "downloading"
                  ? "Downloading"
                  : pack.state === "paused"
                    ? "Paused · resumable"
                    : pack.state === "partial"
                      ? "Partial download · resumable"
                      : pack.state === "failed"
                        ? "Download failed · retry available"
                        : "Available offline · not installed";
          return card(
            <>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  {title(l.native)}
                  {note(
                    `${l.name}${data.sourceSpeech === l.code ? " · Active" : ""}`,
                  )}
                </View>
                {note(stateLabel)}
              </View>
              {expectedBytes > 0 &&
                note(
                  i18n.packProgressLabel(
                    l.code,
                    downloadedBytes,
                    expectedBytes,
                    data.ui,
                  ),
                )}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  {button(
                    packs[l.code]
                      ? "Use language"
                      : downloading === l.code
                        ? "Downloading…"
                        : downloadError === l.code
                          ? "Retry"
                          : downloadedBytes > 0
                            ? "Resume"
                            : "Download",
                    () =>
                      packs[l.code]
                        ? change({ sourceSpeech: l.code })
                        : run(() => install(l.code)),
                    false,
                    !!downloading || (!packs[l.code] && !pack.downloadable),
                  )}
                </View>
                {packs[l.code] &&
                  button(
                    "Remove",
                    () =>
                      Alert.alert("Remove pack?", l.name, [
                        { text: "Cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () =>
                            run(async () => {
                              await Native.removePack(l.code);
                              await status();
                              const remaining = langs.find(
                                (x) =>
                                  x.code !== l.code && packsRef.current[x.code],
                              );
                              if (data.sourceSpeech === l.code)
                                change({
                                  sourceSpeech: remaining?.code || "mr",
                                });
                            }),
                        },
                      ]),
                    true,
                  )}
                {!packs[l.code] &&
                  downloadedBytes > 0 &&
                  button(
                    "Remove partial files",
                    () =>
                      Alert.alert("Remove partial download?", l.name, [
                        { text: "Cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () =>
                            run(async () => {
                              await Native.removePack(l.code);
                              setDownloadPaused("");
                              setDownloadError("");
                              await status();
                            }),
                        },
                      ]),
                    true,
                    !!downloading,
                  )}
              </View>
            </>,
            l.code,
          );
        })}
        {card(
          <>
            {title("Shared translation")}
            {note(
              "Encoder, decoder and vocabulary. General translation enabled for Hindi ↔ Marathi. Other pairs need validated preprocessing/models.",
            )}
            {note(
              packDetails.translation?.installed
                ? "Installed · checksum verified"
                : downloadPaused === "translation"
                  ? "Paused · resumable"
                  : downloadError === "translation"
                    ? "Download failed · retry available"
                    : "Available offline · not installed",
            )}
            {packDetails.translation?.expectedBytes > 0 &&
              note(
                i18n.packProgressLabel(
                  "translation",
                  progress?.pack === "translation"
                    ? progress.done
                    : packDetails.translation.partialBytes || 0,
                  packDetails.translation.expectedBytes,
                  data.ui,
                ),
              )}
            {button(
              packs.translation
                ? "Installed"
                : downloadError === "translation"
                  ? "Retry translation download"
                  : "Download translation",
              () => run(() => install("translation")),
              false,
              !!downloading ||
                !!packs.translation ||
                !packDetails.translation?.available,
            )}
            {packs.translation &&
              button(
                "Remove",
                () =>
                  Alert.alert("Remove pack?", "Shared translation", [
                    { text: "Cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        run(async () => {
                          await Native.removePack("translation");
                          await status();
                        }),
                    },
                  ]),
                true,
              )}
            {!packs.translation &&
              packDetails.translation?.partialBytes > 0 &&
              button(
                "Remove partial files",
                () =>
                  run(async () => {
                    await Native.removePack("translation");
                    setDownloadPaused("");
                    setDownloadError("");
                    await status();
                  }),
                true,
                !!downloading,
              )}
          </>,
        )}
      </>
    );
  }
  function messages() {
    const items = data.messages.filter(
      (m) => filter === "all" || m.direction === filter || m.status === filter,
    );
    return items.length ? (
      items
        .slice()
        .reverse()
        .map((m) =>
          card(
            <>
              {note(
                `${m.direction === "out" ? "You" : m.name || "Peer"} · ${m.language === "und" ? i18n.translate("Language unknown", activeUi) : m.language.toUpperCase()} · ${new Date(m.time).toLocaleTimeString()} · ${i18n.translate(m.mesh && m.status === "custody" ? "Relay accepted a piece; recipient delivery pending" : m.status, activeUi)}`,
              )}
              <NativeText selectable style={[s.message, { color: c.ink }]}>
                {m.template
                  ? phrase(m.template, data.targetTranslation) || m.text
                  : m.mesh && !m.transcript ? i18n.translate("Public voice note", activeUi) : m.text}
              </NativeText>
              <View style={s.row}>
                {button("▶ Play", () => run(() => play(m), "Speaking…"), true)}
                {m.direction === "out" &&
                  m.status !== "delivered" &&
                  m.kind !== "alert" &&
                  button(
                    "Retry to paired peer",
                    () => run(() => retry(m)),
                    true,
                  )}
              </View>
            </>,
            m.id,
          ),
        )
    ) : (
      <View style={s.empty}>
        <Text style={{ fontSize: 42, color: "#2D8DD0" }}>◌</Text>
        {title("A little closer, in every language.")}
        {note("Connect two phones or save a message for later.")}
      </View>
    );
  }
  useEffect(() => {
    if (pttState === "recording") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pttScale, {
            toValue: 1.06,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pttScale, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    Animated.spring(pttScale, {
      toValue: pttState === "arming" ? 0.96 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 7,
    }).start();
  }, [pttScale, pttState]);
  const mic = (
    <Animated.View style={{ transform: [{ scale: pttScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to record, release to send"
        disabled={!!busy}
        onPressIn={begin}
        onPressOut={end}
        delayLongPress={120}
        style={[
          s.mic,
          {
            backgroundColor:
              pttState === "recording"
                ? "#D47743"
                : pttState === "arming"
                  ? "#2D8DD0"
                  : "#347453",
          },
        ]}
      >
        <Text style={{ color: "#FFF", fontSize: 28 }}>
          {pttState === "recording"
            ? "■"
            : pttState === "processing"
              ? "…"
              : "●"}
        </Text>
        <Text style={{ color: "#FFF", fontWeight: "700" }}>
          {pttState === "recording"
            ? "Release to send · max 20s"
            : pttState === "arming"
              ? "Starting…"
              : pttState === "processing"
                ? "Processing…"
                : "Hold to talk"}
        </Text>
      </Pressable>
    </Animated.View>
  );
  const fresh = locationPolicy.usableLocation(location, clock) && locationPolicy.usableLocation(peerLocation, clock);
  const compassReliable = !!compassMeta && clock - compassMeta.time < 3000 && compassMeta.accuracy >= 2 && compassMeta.trueNorth === true;
  const radarHeading = compassReliable ? heading : 0;
  const polar = fresh ? position(location, peerLocation, radarHeading) : null;
  const radarDistance = polar ? polar.distance : null;
  const discoveredPeers = [
    ...peers.map(peer => ({ ...peer, route: "direct" })),
    ...meshPeers.map(id => ({ id, name: id.slice(0, 8), transport: "BLE mesh", route: "direct", connected: true, lastSeen: meshLinkSeen[id] })),
    ...Object.values(meshLocations).filter((p:any) => clock - p.lastSeen < 300000),
    ...(connected ? [{ id: peerId.current || "paired", name: peerName, role: peerRole, transport: "Paired direct", connected: true, route: "direct", coords: peerLocation, lastSeen: peerLocation?.time }] : []),
  ];
  const visiblePeers = locationPolicy.peerView(discoveredPeers, peerFilter, location, radarHeading, clock);
  useEffect(() => {
    if (
      !connected ||
      !sirenEnabled ||
      radarDistance === null ||
      radarDistance + (location?.accuracy || 100) + (peerLocation?.accuracy || 100) > 20
    )
      return;
    if (ref.current.sounds) Native.sirenTone();
    feedback("message");
  }, [connected, sirenEnabled, radarDistance !== null && radarDistance <= 20]);
  let content: React.ReactNode;
  if (!loaded) content = note("Loading Talk2…");
  else if (!data.setup)
    content = (
      <>
        <View style={s.row}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: i <= step ? "#2D8DD0" : c.line,
              }}
            />
          ))}
        </View>
        {label(`WELCOME TO TALK2 · ${step + 1} OF 3`)}
        <Text style={[s.hero, { color: c.ink }]}>
          {step === 0
            ? "Your voice.\nYour community."
            : step === 1
              ? "Bring your\nlanguage along."
              : "Make yourself\nat home."}
        </Text>
        {step === 0 ? (
          card(
            <>
              {label("YOUR PROFILE")}
              {profilePhoto()}
              {field(
                data.name,
                (x) => change({ name: x.slice(0, 40) }),
                "Your name",
              )}
              {note("Your name is shared only with a paired phone.")}
              {title("Choose your role")}
              {Object.entries(roleLabels).map(([role, roleText]) =>
                button(
                  roleText,
                  () => change({ role }),
                  data.role !== role,
                  false,
                ),
              )}
              {data.role === "emergency_staff" &&
                note(
                  "Unverified emergency staff. Role verification is not available yet. You can skip future email OTP and continue without internet.",
                )}
            </>,
          )
        ) : step === 1 ? (
          <>
            {card(
              <>
                {note(
                  "Download once, then speak and listen offline. Hindi needs your own release because its weights are not in the supplied release. You can continue with text and add packs later.",
                )}
                {button(
                  "Use built-in release manifest",
                  () => run(loadManifest),
                  true,
                )}
              </>,
            )}
            {languageList()}
          </>
        ) : (
          card(
            <>
              {label("MENUS & BUTTONS")}
              {[
                "en",
                "mr",
                ...langs
                  .map((l) => l.code)
                  .filter((code) => code !== "en" && code !== "mr"),
              ].map((code) => (
                <Button
                  key={code}
                  title={langs.find((l) => l.code === code)?.native}
                  c={c}
                  secondary={data.ui !== code}
                  onPress={() => change({ ui: code })}
                />
              ))}
              {note(i18n.coverageText(data.ui))}
              {label("LOOK & FEEL")}
              <View style={s.row}>
                {["system", "light", "dark"].map((x) => (
                  <Button
                    key={x}
                    title={x}
                    c={c}
                    secondary={data.theme !== x}
                    onPress={() => change({ theme: x })}
                  />
                ))}
              </View>
            </>,
          )
        )}
        {button(
          step === 2
            ? "Start using Talk2"
            : step === 1 && !packs[data.sourceSpeech]
              ? "Continue with text only"
              : "Continue",
          () => (step === 2 ? change({ setup: true }) : setStep(step + 1)),
          false,
          step === 0 && !data.name.trim(),
        )}
        {step > 0 && button("Back", () => setStep(step - 1), true)}
      </>
    );
  else if (route === "languages")
    content = (
      <>
        {button("← Settings", () => setRoute(""), true)}
        {languageList()}
      </>
    );
  else if (route === "analysis")
    content = (
      <>
        {button("← Settings", () => setRoute(""), true)}
        {card(
          <>
            {title("Measured on this phone")}
            <Text selectable style={{ color: c.ink, lineHeight: 25 }}>
              {JSON.stringify(metrics, null, 2)}
            </Text>
            {note(
              "STT time includes model load. TTS time includes playback. WER requires a labelled test corpus and is not estimated here.",
            )}
            {button("Refresh memory & storage", () =>
              run(async () =>
                setMetrics({
                  ...metrics,
                  ...JSON.parse(await Native.diagnostics()),
                }),
              ),
            )}
            {button(
              "Share diagnostics",
              () => Share.share({ message: JSON.stringify(metrics, null, 2) }),
              true,
            )}
          </>,
        )}
      </>
    );
  else if (route === "gpt")
    content = (
      <>
        {button("← Settings", () => setRoute(""), true)}
        {card(
          <>
            {title("Ask GPT · online")}
            {note(
              "Only the text submitted here goes to your Node server and OpenAI. Radio messages and GPS are never sent automatically.",
            )}
            {field(token, setToken, "Server access token", false, true)}
            {field(text, setText, "Ask a question", true)}
            {button(
              "Send question online",
              () =>
                run(async () => {
                  if (!data.backend.startsWith("https://"))
                    throw new Error("Set an HTTPS backend URL in Settings");
                  const r = await fetch(
                    data.backend.replace(/\/$/, "") + "/api/assist",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ text }),
                      signal: AbortSignal.timeout(45000),
                    },
                  );
                  const a = await r.json();
                  if (!r.ok) throw new Error(a.error || `HTTP ${r.status}`);
                  setAnswer(a.text);
                }, "Asking GPT…"),
              false,
              !text.trim() || !!busy,
            )}
            <Text selectable style={[s.message, { color: c.ink }]}>
              {answer}
            </Text>
          </>,
        )}
      </>
    );
  else if (tab === "talk")
    content = (
      <>
        {card(
          <>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                {title(connected ? "● Connected" : "○ Ready when you are")}
                {note(
                  connected
                    ? peerName
                    : "Messages stay here until you connect.",
                )}
              </View>
              {button(connected ? "Disconnect" : "Connect", () =>
                connected ? disconnect() : setShowConnect(true),
              )}
            </View>
          </>,
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollPills}
        >
          {Object.entries(templates)
            .slice(0, 3)
            .map(([key, p]) => (
              <Pressable
                key={key}
                onPress={() => setText(p[data.sourceSpeech])}
                style={[s.chip, { borderColor: c.line }]}
              >
                <Text style={{ color: c.ink }}>{p[data.sourceSpeech]}</Text>
              </Pressable>
            ))}
        </ScrollView>
        {messages()}
        {card(
          <>
            {field(text, setText, "Type a message or hold to talk", true)}
            {note(
              data.voiceMode === "original"
                ? "Original voice · release to send · no language model needed"
                : data.reviewSpeech
                  ? "Translated speech · release to review the transcript"
                  : "Translated speech · release to send; your peer hears their selected language",
            )}
            {note(
              `Active: ${langs.find((l) => l.code === data.sourceSpeech)?.name} · ${connected ? (voiceCapable ? "Peer supports original voice" : "Peer uses text/speech protocol") : "Offline clips are saved for retry"}`,
            )}
            {mic}
            {button(
              connected ? "Send message" : "Save for later",
              () => run(() => send(text)),
              false,
              !text.trim() || !!busy,
            )}
          </>,
        )}
      </>
    );
  else if (tab === "radar")
    content = (
      <>
        {card(
          <>
            {title("Find your paired phone")}
            {note("Compass + GPS · hold phone flat · keep the app open")}
            {button("Start compass & GPS", () =>
              run(async () => {
                await permissions("location");
                await Native.startSensors();
              }),
            )}
            <View style={s.row}>
              <Text style={{ color: c.ink, flex: 1 }}>
                Share location with paired peer
              </Text>
              <Switch
                value={data.shareLocation}
                onValueChange={setLocationSharing}
              />
            </View>
            {note(
              "Location is shared only with the paired phone while this switch is on. Enable it before or after pairing.",
            )}
            {note(
              location
                ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · ±${Math.round(location.accuracy)} m`
                : "Waiting for a GPS fix",
            )}
            {note(sensorStatus)}
            {note(
              !connected
                ? "Pair both phones to see peer distance."
                : !peerLocation
                  ? "Ask your peer to enable location sharing."
                  : !fresh
                    ? "Location is stale. Move outdoors or refresh location on both phones."
                    : "Live peer coordinates received over the encrypted radio link.",
            )}
          </>,
        )}
        <RadarPeers color={c.ink} peers={visiblePeers} filter={peerFilter} onFilter={setPeerFilter} heading={radarHeading} compass={compassReliable} ui={activeUi} onJoin={p => run(() => Native.join(p.transport, p.id))} />
        {button(meshSharing ? "Stop public location sharing" : "Share public mesh location", () => {
          if (meshSharing) { meshSharingRef.current = false; setMeshSharing(false); run(() => Native.shareMeshPosition(JSON.stringify({ off: true, time: Date.now(), expires: Date.now() + 30000 }))); return; }
          Alert.alert("Share public mesh location", "Your coordinates, name and self-declared role will be public to nearby phones and relays for 30 seconds per update.", [
            { text: "Cancel", style: "cancel" }, { text: "Share location", onPress: () => run(async () => {
              await permissions("location"); await Native.startSensors(); if (!meshEnabledRef.current) return;
              meshSharingRef.current = true; setMeshSharing(true); lastMeshPosition.current = 0; await sendPosition(locationRef.current);
            }) },
          ]);
        }, true, !meshActive)}
        {!meshSharing && note("Public location sharing is off")}
        {button("Discover nearby phones", () => setShowConnect(true), true)}
        {card(
          <>
            {title("BLE text & SOS mesh")}
            <MeshVoicePanel color={c.ink} installed={packs} available={(manifest || upstream).packs} active={meshActive} source={data.sourceSpeech} ui={activeUi} onSent={async (id, uri, language, transcript) => {
              await add({ id, kind: "voice", text: transcript || "Public voice note", transcript, language, time: Date.now(), direction: "out", status: "queued", mesh: true, audioUri: uri });
            }} />
            {note("Separate from paired chat. Nearby phones can read relayed text; packet signatures identify the sender but do not encrypt its contents. Keep private details out of mesh messages.")}
            {button(meshActive ? "Stop BLE mesh" : "Start BLE mesh", () => run(async () => {
              if (meshActive) { Mesh.stop(); setMeshActive(false); setMeshPeers([]); return; }
              await permissions("radio");
              const id = await Mesh.start(); meshIdRef.current = id; meshEnabledRef.current = true; setMeshNode(id); setMeshActive(true);
            }), true)}
            {note(i18n.translate(meshActive ? "BLE mesh is active" : "BLE mesh is off until you start it.", activeUi))}{meshActive ? note(`${meshPeers.length} ${i18n.translate("Nearby BLE links", activeUi)} · ${meshNode.slice(0, 8)}`) : null}
            <Field value={meshText} onChangeText={setMeshText} placeholder="Public mesh text or SOS details" multiline c={c} />
            <View style={s.row}>
              {button("Send mesh text", () => run(async () => { if (!meshActive) throw new Error("Start BLE mesh first"); await Mesh.sendText("*", meshText); setMeshText(""); }), true, !meshText.trim() || !meshActive)}
              {button("Broadcast SOS", () => Alert.alert("Broadcast SOS?", meshText || "Emergency assistance needed", [
                { text: "Cancel" },
                { text: "Broadcast SOS", style: "destructive", onPress: () => run(async () => { if (!meshActive) throw new Error("Start BLE mesh first"); await Mesh.sendSOS(meshText || "Emergency assistance needed"); setMeshText(""); }) },
              ]), false, !meshActive)}
            </View>
          </>,
        )}
      </>
    );
  else if (tab === "alert")
    content = (
      <>
        {label(
          connected
            ? "SEND TO YOUR PAIRED PHONE"
            : "CONNECT BEFORE SENDING AN ALERT",
        )}
        {Object.entries(templates).map(([key, p]) =>
          card(
            <>
              {title(p[data.sourceSpeech])}
              {note(p.en)}
              {button(
                "Send alert",
                () =>
                  Alert.alert("Send this alert?", p[data.sourceSpeech], [
                    { text: "Cancel" },
                    {
                      text: "Send",
                      onPress: () =>
                        run(() => send(p[data.sourceSpeech], "alert", key)),
                    },
                  ]),
                false,
                !connected,
              )}
            </>,
            key,
          ),
        )}
        {card(
          <>
            {label("CUSTOM ALERT · MAX 200 CHARACTERS")}
            {field(
              text.slice(0, 200),
              (x) => setText(x.slice(0, 200)),
              "Describe what you need",
              true,
            )}
            {mic}
            {button(
              "Send custom alert",
              () =>
                Alert.alert("Send custom alert?", text.slice(0, 200), [
                  { text: "Cancel" },
                  {
                    text: "Send",
                    onPress: () => run(() => send(text.slice(0, 200), "alert")),
                  },
                ]),
              false,
              !connected || !text.trim(),
            )}
          </>,
        )}
      </>
    );
  else if (tab === "history")
    content = (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollPills}
        >
          {["all", "in", "out", "delivered", "queued", "pending"].map((x) => (
            <Button
              key={x}
              title={x}
              c={c}
              secondary={filter !== x}
              onPress={() => setFilter(x)}
            />
          ))}
        </ScrollView>
        {messages()}
        {button("Clear local history", clearHistory, true)}
      </>
    );
  else
    content = (
      <>
        {card(
          <>
            {label("☺ YOUR PROFILE")}
            {profilePhoto()}
            {field(
              data.name,
              (x) => change({ name: x.slice(0, 40) }),
              "Your name",
            )}
            {note("Talk2 · a little closer")}
            {title("Choose your role")}
            {Object.entries(roleLabels).map(([role, roleText]) =>
              button(roleText, () => change({ role }), data.role !== role),
            )}
            {note(verification.label)}
            {data.role === "emergency_staff" &&
              note(
                "Email control or role selection does not verify employment. A signed organization credential is not configured.",
              )}
          </>,
        )}
        {card(
          <>
            {button(
              "◉ Languages & offline downloads",
              () => setRoute("languages"),
              true,
            )}
            {label("UI language")}
            <View style={s.row}>
              {[
                "en",
                "mr",
                ...langs
                  .map((l) => l.code)
                  .filter((code) => code !== "en" && code !== "mr"),
              ].map((code) => (
                <Button
                  key={code}
                  title={langs.find((l) => l.code === code)?.native}
                  c={c}
                  secondary={data.ui !== code}
                  onPress={() => change({ ui: code })}
                />
              ))}
            </View>
            {note(i18n.coverageText(data.ui))}
            {label("☀ APPEARANCE")}
            <View style={s.row}>
              {["system", "light", "dark"].map((x) => (
                <Button
                  key={x}
                  title={x}
                  c={c}
                  secondary={data.theme !== x}
                  onPress={() => change({ theme: x })}
                />
              ))}
            </View>
          </>,
        )}
        {card(
          <>
            {label("Source speech")}
            <ScrollView horizontal>
              {langs.map((l) =>
                button(
                  l.native,
                  () => change({ sourceSpeech: l.code }),
                  data.sourceSpeech !== l.code,
                ),
              )}
            </ScrollView>
            {label("Translation target")}
            <ScrollView horizontal>
              {langs.map((l) =>
                button(
                  l.native,
                  () => change({ targetTranslation: l.code }),
                  data.targetTranslation !== l.code,
                ),
              )}
            </ScrollView>
            {label("TTS voice")}
            <ScrollView horizontal>
              {langs.map((l) =>
                button(
                  l.native,
                  () => change({ ttsVoice: l.code }),
                  data.ttsVoice !== l.code,
                ),
              )}
            </ScrollView>
            {note(
              "Speech recognition and voice synthesis need their matching installed speech packs. Match TTS voice to translation target for playback. General model translation supports Hindi ↔ Marathi only.",
            )}
          </>,
        )}
        {card(
          <>
            {label("◉ VOICE & FEEDBACK")}
            {note("Choose how the microphone sends a message.")}
            <View style={s.row}>
              {button(
                "Translated speech",
                () => change({ voiceMode: "translated" }),
                data.voiceMode !== "translated",
                pttState !== "idle",
              )}
              {button(
                "Original voice",
                () => change({ voiceMode: "original" }),
                data.voiceMode !== "original",
                pttState !== "idle",
              )}
            </View>
            {option(
              "✓",
              "Review transcript",
              "Review recognized words before sending translated speech",
              data.reviewSpeech,
              (v) => change({ reviewSpeech: v }),
            )}
            {option(
              "▶",
              "Play received messages",
              "Automatically play new speech and voice clips",
              data.autoPlay,
              (v) => change({ autoPlay: v }),
            )}
            {option(
              "≈",
              "Vibration",
              "Recording, sending, and incoming-message feedback",
              data.haptics,
              (v) => change({ haptics: v }),
            )}
            {option(
              "♪",
              "Alert sounds",
              "Use the phone's current notification/alarm volume",
              data.sounds,
              (v) => change({ sounds: v }),
            )}
            {button(
              "Test vibration",
              () =>
                run(async () => {
                  const ok = await Native.feedback("message");
                  if (!ok) throw new Error("This device has no vibrator");
                }),
              true,
            )}
            {button("Test alert sound", () => Native.alertTone(), true)}
          </>,
        )}
        {card(
          <>
            {label("⌖ LOCATION & PRIVACY")}
            {option(
              "⌖",
              "Share my location",
              "Only with the paired phone while Talk2 is open",
              data.shareLocation,
              setLocationSharing,
            )}
            {option(
              "♬",
              "Nearby peer cue",
              "One cue when a live GPS distance enters 20 m; GPS is approximate",
              sirenEnabled,
              (v) => {
                setSirenEnabled(v);
                change({ sirenEnabled: v });
              },
            )}
            {button(
              "Open Android permissions",
              () => Linking.openSettings(),
              true,
            )}
            {button("Clear local history & voice files", clearHistory, true)}
          </>,
        )}
        {card(
          <>
            {label("⇩ MODEL DOWNLOADS")}
            {field(
              data.manifestUrl,
              (x) => {
                change({ manifestUrl: x });
                setManifest(null);
              },
              "Blank = built-in release manifest",
            )}
            {button(
              "Check release manifest",
              () => run(loadManifest, "Checking release…"),
              true,
            )}
            {note(
              manifest
                ? `${Object.keys(manifest.packs).length} packs in release`
                : "Nine speech packs + translation are available from the built-in release. Add Hindi using your own manifest.",
            )}
            {label("OPTIONAL NODE BACKEND")}
            {field(
              data.backend,
              (x) => change({ backend: x }),
              "https://your-talk2-server.example",
            )}
            {button("✦ Ask GPT (online)", () => setRoute("gpt"), true)}
            {button(
              "▥ Performance & diagnostics",
              () => setRoute("analysis"),
              true,
            )}
          </>,
        )}
        {card(
          <>
            {title("Talk2 1.1 · Android")}
            {note(
              "React Native interface · Java device engine · optional Node.js service. Keep the app open for communication. Talk2 uses its own protocol and pairs with other Talk2 installations.",
            )}
          </>,
        )}
      </>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={c.bg}
      />
      <View style={s.header}>
        <View>
          <Text style={[s.brand, { color: c.ink }]}>
            Talk<Text style={{ color: "#D47743" }}>2</Text>
          </Text>
          <Text style={{ color: c.muted, fontSize: 11, letterSpacing: 1 }}>
            A LITTLE CLOSER
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (data.setup) {
              setTab("settings");
              setRoute("languages");
            }
          }}
        >
          <Text style={{ color: "#1769AA", fontWeight: "700" }}>
            {langs.find((l) => l.code === data.sourceSpeech)?.native}
          </Text>
        </Pressable>
      </View>
      {!!error && (
        <Pressable onPress={() => setError("")} style={s.error}>
          <Text style={{ color: "#792D1A" }}>{error} ×</Text>
        </Pressable>
      )}
      {!!busy && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ padding: 10, color: c.muted }}
        >
          {busy}
        </Text>
      )}
      {!!downloading && (
        <View style={s.download}>
          <Text style={{ color: c.ink, flex: 1 }}>
            {progress
              ? i18n.packProgressLabel(
                  progress.pack,
                  progress.done,
                  progress.total,
                  data.ui,
                )
              : "Preparing download…"}
          </Text>
          <Pressable
            onPress={() => {
              pauseRequested.current = downloading;
              Native.cancelDownload();
            }}
          >
            <Text style={{ color: "#B84A29" }}>Cancel download</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
      >
        {content}
      </ScrollView>
      {data.setup && (
        <View style={[s.nav, { borderColor: c.line, backgroundColor: c.card }]}>
          {["talk", "radar", "alert", "history", "settings"].map((key, i) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => {
                setTab(key);
                setRoute("");
                setFilter("all");
              }}
              style={[
                s.navItem,
                tab === key && {
                  backgroundColor: dark ? "#173B61" : "#E3F0FB",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 22,
                  color: key === "alert" ? "#BC6339" : c.ink,
                }}
              >
                {["◉", "◎", "△", "◷", "⚙"][i]}
              </Text>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 10,
                  fontWeight: tab === key ? "700" : "400",
                }}
              >
                {tabs[i]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={showConnect}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConnect(false)}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.bg }]}>
            <ScrollView>
              <Text style={[s.hero, { color: c.ink }]}>Connect nearby.</Text>
              <View
                style={[
                  s.connectionBanner,
                  { backgroundColor: c.card, borderColor: c.line },
                ]}
              >
                <View
                  style={[
                    s.stateDot,
                    {
                      backgroundColor:
                        connectionState === "connected"
                          ? "#2BAA72"
                          : connectionState === "failed"
                            ? "#D35D5D"
                            : "#2D8DD0",
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontWeight: "700" }}>
                    {connectionState === "scanning"
                      ? "Scanning for Talk2 devices"
                      : connectionState === "hosting"
                        ? "Waiting for another phone"
                        : connectionState === "joining"
                          ? "Connecting to selected phone"
                          : connectionState === "pairing"
                            ? "Pairing requires confirmation"
                            : connectionState === "connected"
                              ? "Talk2 connection active"
                              : connectionState === "failed"
                                ? "Connection needs attention"
                                : "Ready to connect"}
                  </Text>
                  {note(radioStatus)}
                </View>
              </View>
              {note(
                "Use the same transport on both phones. Compare the pairing code before messages are enabled.",
              )}
              <View style={s.pillRow}>
                {["all", "wifi", "bluetooth"].map((x) => (
                  <Button
                    key={x}
                    title={x === "all" ? "Both" : x}
                    c={c}
                    secondary={transport !== x}
                    onPress={() => setTransport(x)}
                  />
                ))}
              </View>
              {button(
                connectionState === "scanning"
                  ? "Scanning…"
                  : "Scan for phones",
                () =>
                  run(async () => {
                    setConnectionState("scanning");
                    setRadioStatus("Looking for Talk2 devices…");
                    setPeers([]);
                    await permissions("radio");
                    await Native.discover(transport);
                  }),
                false,
                connectionState === "scanning",
              )}
              <View style={s.pillRow}>
                {button(
                  hostingTransport === "wifi" ? "Hosting Wi-Fi…" : "Host Wi-Fi",
                  () =>
                    run(async () => {
                      setConnectionState("hosting");
                      setHostingTransport("wifi");
                      setRadioStatus("Starting Wi-Fi host…");
                      await permissions("radio");
                      await Native.host("wifi");
                    }),
                  true,
                  hostingTransport !== null,
                )}
                {button(
                  hostingTransport === "bluetooth"
                    ? "Hosting Bluetooth…"
                    : "Host Bluetooth",
                  () =>
                    run(async () => {
                      setConnectionState("hosting");
                      setHostingTransport("bluetooth");
                      setRadioStatus("Starting Bluetooth host…");
                      await permissions("radio");
                      await Native.bluetoothDiscoverable();
                      await Native.host("bluetooth");
                    }),
                  true,
                  hostingTransport !== null,
                )}
              </View>
              {note(radioStatus)}
              {peers.map((p) => (
                <Button
                  key={p.transport + p.id}
                  title={`${p.name} · ${p.transport} → Join`}
                  c={c}
                  secondary
                  onPress={() =>
                    run(async () => {
                      setConnectionState("joining");
                      setRadioStatus(
                        `Connecting to ${p.name || "Talk2 phone"}…`,
                      );
                      await Native.join(p.transport, p.id);
                    })
                  }
                />
              ))}
              {button("Close", () => setShowConnect(false), true)}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!pairCode} transparent onRequestClose={disconnect}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.bg }]}>
            {title("Compare this code on both phones")}
            <Text
              style={{
                fontSize: 42,
                letterSpacing: 7,
                color: "#2D8DD0",
                textAlign: "center",
                marginVertical: 20,
              }}
            >
              {pairCode}
            </Text>
            {button("Codes match", () =>
              run(async () => {
                await Native.confirmPairing();
                setPairCode("");
              }),
            )}
            {button("Cancel connection", disconnect, true)}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  hero: { fontSize: 34, fontWeight: "700", lineHeight: 42, marginVertical: 20 },
  subtitle: { fontSize: 19, fontWeight: "700", marginBottom: 6 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginTop: 14,
    marginBottom: 10,
  },
  card: { padding: 18, borderRadius: 24, borderWidth: 1, marginBottom: 14 },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 15,
    marginVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    flexWrap: "wrap",
  },
  scrollPills: { paddingRight: 12, gap: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    fontSize: 16,
    marginVertical: 8,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 8,
  },
  empty: { padding: 25, alignItems: "center", gap: 8 },
  message: { fontSize: 18, lineHeight: 28, marginVertical: 12 },
  mic: {
    alignSelf: "center",
    width: 180,
    height: 100,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
  },
  nav: { flexDirection: "row", borderTopWidth: 1, padding: 8 },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 15,
    gap: 3,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E3F0FB",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    margin: 12,
  },
  radar: {
    position: "relative",
    height: 280,
    width: 280,
    borderRadius: 140,
    borderWidth: 1,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  distanceBadge: {
    minWidth: 64,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "flex-end",
  },
  distanceValue: { fontSize: 15, fontWeight: "800", marginTop: 1 },
  radarDistance: { position: "absolute", top: 4, right: 4, zIndex: 2 },
  sirenPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  overlay: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "85%",
  },
  connectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  error: {
    backgroundColor: "#FFE5D7",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
  },
  download: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
