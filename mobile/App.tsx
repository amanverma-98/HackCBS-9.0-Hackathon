import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert as NativeAlert,
  Animated,
  AppState,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
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
import { Native, Mesh, events, permissions, permissionStatus, requestAllPermissions } from "./src/native";
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
  // Receiver-side translation into this phone's "Translate to" language.
  translated?: string;
  translatedLang?: string;
  // Mesh node that sent it, for messages that arrived over the mesh.
  from?: string;
  // Sealed end to end (direct link or sealed mesh); false for public mesh broadcasts.
  private?: boolean;
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
  targetTranslation: "hi",
  ttsVoice: "hi",
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
  // Original voice needs no download, so hold-to-talk works on a fresh install.
  voiceMode: "original",
  messages: [],
};


// Languages with bundled UI translations; others would fall back to English.
const UI_LANGUAGES = ["en", "hi", "gu", "mr"];
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
      | "reconnecting"
    >("idle");
  // Peer whose Connect button is in progress, and the transport of the live link.
  const [joiningId, setJoiningId] = useState(""),
    [linkTransport, setLinkTransport] = useState(""),
    showConnectRef = useRef(false),
    resumeTimer = useRef<any>(null);
  showConnectRef.current = showConnect;
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
  // Language code whose speech pack the user needs before translated speech works.
  const [packPrompt, setPackPrompt] = useState(""),
    [picker, setPicker] = useState<"" | "ui" | "source" | "target" | "tts">(""),
    [pairConfirmed, setPairConfirmed] = useState(false),
    [showAdvanced, setShowAdvanced] = useState(false),
    [showMeshVoice, setShowMeshVoice] = useState(false),
    [permState, setPermState] = useState<Record<string, string>>({}),
    [radios, setRadios] = useState<Record<string, boolean>>({}),
    [permsAsked, setPermsAsked] = useState(false);
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
  // People announced over the mesh, keyed by mesh node id; includes phones several hops away.
  const [meshDir, setMeshDir] = useState<Record<string, any>>({}),
    meshDirRef = useRef<Record<string, any>>({}),
    // Who the Talk screen sends to when it is not the directly paired phone.
    [chatPeer, setChatPeer] = useState<any>(null),
    chatPeerRef = useRef<any>(null),
    peerMeshId = useRef(""),
    meshStarting = useRef(false),
    [meshIssue, setMeshIssue] = useState(""),
    [appActive, setAppActive] = useState(true),
    [peerTalking, setPeerTalking] = useState(false),
    [pttHint, setPttHint] = useState(""),
    recordSince = useRef(0),
    sealKey = useRef("");
  meshDirRef.current = meshDir;
  chatPeerRef.current = chatPeer;
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
        value.installed === true || value.builtInSpeech === true,
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
  /** Speaks a message in this phone's language; original=true plays the recorded voice instead. */
  async function play(m: Message, original = false) {
    if (ptt.current?.active)
      throw new Error("Finish recording before playing a message");
    audioBusy.current++;
    setBusy("Playing speech on this phone…");
    try {
      const target = ref.current.targetTranslation;
      if (m.kind === "voice" && m.audioUri && (original || !(m.translated || m.transcript))) {
        await Native.playVoice(m.audioUri);
        return;
      }
      const source = m.kind === "voice" ? m.transcript || "" : m.text;
      let spoken = m.template ? phrase(m.template, target) : undefined;
      if (!spoken)
        spoken =
          m.translated && m.translatedLang === target
            ? m.translated
            : m.language === target
              ? source
              : await Native.translate(source, m.language, target);
      await Native.speak(spoken, target);
    } finally {
      audioBusy.current--;
      if (!audioBusy.current) setBusy("");
    }
  }

  /** Translates an incoming message into this phone's language and stores the result. */
  async function translateIncoming(m: Message): Promise<Message> {
    const target = ref.current.targetTranslation;
    const source = m.kind === "voice" ? m.transcript || "" : m.text;
    if (!source || m.template || !m.language || m.language === "und" || m.language === target) return m;
    try {
      const translated = await Native.translate(source, m.language, target);
      const next = { ...m, translated, translatedLang: target };
      change({ messages: ref.current.messages.map((x) => (x.id === m.id && x.direction === "in" ? next : x)) });
      return next;
    } catch {
      return m;
    }
  }
  async function deliver(incoming: Message) {
    await add(incoming);
    feedback("message");
    if (incoming.kind === "alert")
      Alert.alert(
        "Incoming alert",
        incoming.template
          ? phrase(incoming.template, ref.current.targetTranslation) || incoming.text
          : incoming.text,
      );
    const ready = await translateIncoming(incoming);
    // Auto-play is best effort; the message's Play button reports why speech failed.
    if (!incoming.queued && ref.current.autoPlay && !ptt.current?.active)
      await play(ready).catch(() => (ready.audioUri ? play(ready, true).catch(() => {}) : undefined));
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
      peerMeshId.current = String(m.meshId || "").slice(0, 80);
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
      await wire({ id: uid(), kind: "ack", ack: m.id, time: Date.now() }).catch(() => {});
      await deliver(incoming);
    } else await wire({ id: uid(), kind: "ack", ack: m.id, time: Date.now() });
  }
  async function receiveMesh(e: any) {
    if (!e?.id || !e?.body) return;
    if (!ref.current.messages.some((m) => m.id === e.id && m.direction === "in")) {
      // Chat over the mesh carries its language so the receiver can translate it.
      let chat: any = null;
      try {
        const parsed = JSON.parse(e.body);
        if (parsed && parsed.k === "chat" && typeof parsed.text === "string") chat = parsed;
      } catch {
        // Plain public text.
      }
      const sender = typeof e.sender === "string" ? e.sender : "";
      const broadcast = e.destination === "*";
      // Private messages must arrive sealed; an unsealed addressed message is not trusted.
      if (!broadcast && !e.private) {
        await Mesh.acknowledgeInbox(e.id);
        return;
      }
      const incoming: Message = {
        id: e.id,
        kind: e.type === "meshSOS" || chat?.alert ? "alert" : "text",
        text: (chat ? chat.text : e.body).slice(0, 1000),
        language: chat && langs.some((l) => l.code === chat.lang) ? chat.lang : "und",
        time: Number(e.created) || Date.now(),
        direction: "in",
        status: "received",
        name: String(chat?.name || meshDirRef.current[sender]?.name || "BLE mesh").slice(0, 40),
        mesh: true,
        from: sender,
        private: !broadcast,
      };
      if (e.type === "meshSOS") {
        await add(incoming);
        Alert.alert("Mesh SOS", incoming.text);
      } else await deliver(incoming);
    }
    await Mesh.acknowledgeInbox(e.id);
  }
  async function onFloor(m: any) {
    if (!validMessage(m) || m.kind !== "floor") return;
    if (m.op === "release") {
      remoteFloor.current = false;
      setPeerTalking(false);
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
        setPeerTalking(true);
        clearTimeout(remoteFloorTimer.current);
        remoteFloorTimer.current = setTimeout(() => {
          remoteFloor.current = false;
          setPeerTalking(false);
        }, 25000);
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
          // Connection problems are shown inside the Connect sheet; the banner is for everything else.
          if (!showConnectRef.current) setError(e.message);
          setConnectionState("failed");
          setHostingTransport(null);
          setJoiningId("");
          setRadioStatus(e.message || "Connection failed");
        }
        if (e.type === "reconnecting") {
          setConnectionState("reconnecting");
          setRadioStatus(`${i18n.translate("Reconnecting…", activeUi)} ${e.attempt}/${e.max}`);
        }
        if (e.type === "voiceError") setError(e.message);
        if (e.type === "meshVoice") receiveChain.current = receiveChain.current.catch(() => {}).then(async () => {
          if (ref.current.messages.some(m => m.id === e.id && m.direction === "in")) return;
          const note: Message = { id: e.id, kind: "voice", text: e.transcript || "Public voice note", transcript: e.transcript, language: e.language, time: e.created, direction: "in", status: "received", mesh: true, audioUri: e.audioUri, durationMs: e.durationMs, name: String(meshDirRef.current[e.sender]?.name || e.sender.slice(0, 8)), from: e.sender };
          await add(note);
          await translateIncoming(note);
        }).catch((x: any) => setError(x.message));
        if (e.type === "meshVoiceOutgoing") receiveChain.current = receiveChain.current.catch(() => {}).then(async () => {
          if (!ref.current.messages.some(m => m.id === e.id && m.direction === "out")) await add({ id:e.id, kind:"voice", text:e.transcript || "Public voice note", transcript:e.transcript, language:e.language, time:e.created, direction:"out", status:e.status, mesh:true, audioUri:e.audioUri, recipient:e.recipient });
        }).catch((x:any) => setError(x.message));
        if (e.type === "meshVoiceStatus" && ref.current.messages.some(m => m.id === e.id && m.mesh && (m.status !== e.status || (m.recipient || "") !== (e.recipient || "")))) change({ messages: ref.current.messages.map(m => m.id === e.id && m.mesh ? { ...m, status: e.status, recipient: e.recipient } : m) });
        if (e.type === "meshPosition" && e.sender !== meshIdRef.current) setMeshLocations(old => locationPolicy.mergeLocationPeer(old, e));
        if (e.type === "meshNeighbor") setMeshLinkSeen(old => { const next = { ...old }; if (e.connected) next[e.id] = Date.now(); else delete next[e.id]; return next; });
        if (e.type === "meshVoicePiece") setMeshLinkSeen(old => old[e.neighbor] ? { ...old, [e.neighbor]: Date.now() } : old);
        if (e.type === "meshNeighbor") setMeshPeers((old) => e.connected ? (old.includes(e.id) ? old : [...old, e.id]) : old.filter((id) => id !== e.id));
        if (e.type === "meshError") setMeshIssue(e.message || "BLE mesh error");
        if (e.type === "meshStopped") { meshEnabledRef.current = false; meshSharingRef.current = false; setMeshSharing(false); setMeshActive(false); setMeshPeers([]); setMeshLinkSeen({}); }
        if (e.type === "meshMessage" || e.type === "meshSOS") receiveMesh(e).catch((x: any) => setError(x.message));
        if (e.type === "meshReceipt" && typeof e.body === "string")
          change({ messages: ref.current.messages.map((m) => (m.id === e.body && m.mesh && m.direction === "out" ? { ...m, status: "delivered" } : m)) });
        if (e.type === "meshStatus" && ref.current.messages.some((m) => m.id === e.id && m.mesh && m.direction === "out" && m.kind !== "voice" && m.status !== "delivered")) {
          const next = e.status === "sent-to-neighbor" ? "sent" : e.status;
          change({ messages: ref.current.messages.map((m) => (m.id === e.id && m.mesh && m.direction === "out" && m.status !== "delivered" ? { ...m, status: next } : m)) });
        }
        if (e.type === "meshPresence" && typeof e.sender === "string" && e.sender !== meshIdRef.current)
          setMeshDir((old) => ({
            ...old,
            [e.sender]: {
              id: e.sender,
              name: String(e.name || e.sender.slice(0, 8)).slice(0, 40),
              role: onboarding.ROLES.includes(e.role) ? e.role : "unknown",
              device: String(e.device || "").slice(0, 80),
              hops: Math.max(0, Number(e.hops) || 0),
              speak: String(e.speak || ""),
              hear: String(e.hear || ""),
              key: typeof e.key === "string" && e.key.length < 400 ? e.key : old[e.sender]?.key || "",
              lastSeen: Date.now(),
            },
          }));
        if (e.type === "sensorStatus") setSensorStatus(e.message);
        if (e.type === "status") {
          setRadioStatus(e.state);
          if (e.state === "Waiting for peer") setConnectionState("hosting");
          if (e.state === "Phone connecting…") setConnectionState("joining");
        }
        if (e.type === "peer")
          setPeers((p) =>
            p.some((x) => x.id === e.id && x.transport === e.transport)
              ? p.map(x => x.id === e.id && x.transport === e.transport ? { ...x, name: e.name || x.name, verified: x.verified || e.verified, lastSeen: Date.now() } : x)
              : [...p, { ...e, lastSeen: Date.now() }],
          );
        if (e.type === "scanFinished")
          setConnectionState((state) => (state === "scanning" ? "idle" : state));
        if (e.type === "pairing") {
          // A new link replaces any older session, so stop treating the peer as paired.
          paired.current = false;
          setConnected(false);
          setPairConfirmed(false);
          setJoiningId("");
          clearTimeout(resumeTimer.current);
          if (e.resuming) {
            // A previously confirmed peer re-confirms itself; only ask for the code if that fails.
            setConnectionState("reconnecting");
            setRadioStatus("Reconnecting securely…");
            resumeTimer.current = setTimeout(() => {
              if (!paired.current) {
                setPairCode(e.code);
                setShowConnect(false);
                setConnectionState("pairing");
              }
            }, 6000);
          } else {
            setPairCode(e.code);
            setShowConnect(false);
            setConnectionState("pairing");
            setRadioStatus("Verify the pairing code");
          }
        }
        if (e.type === "connected") {
          paired.current = true;
          clearTimeout(resumeTimer.current);
          setJoiningId("");
          setLinkTransport(e.transport || "");
          setPairCode("");
          setPairConfirmed(false);
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
            meshId: meshIdRef.current,
            capabilities: ["voice-pcm-v1"],
          }).catch((x: any) => setError(x.message));
          // Deliver text saved while the link was down.
          for (const m of ref.current.messages)
            if (m.direction === "out" && m.kind === "text" && ["queued", "failed"].includes(m.status))
              retry(m).catch(() => {});
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
          setJoiningId("");
          setConnectionState(e.reconnecting ? "reconnecting" : "idle");
          setRadioStatus(e.reconnecting ? "Connection dropped · reconnecting…" : "Disconnected");
          setHostingTransport(null);
          setPeerLocation(null);
          setPairCode("");
          setPairConfirmed(false);
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
    refreshPermissions();
    const app = AppState.addEventListener("change", (s) => {
      setAppActive(s === "active");
      if (s === "active") refreshPermissions();
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
  /**
   * Direct link when it reaches the chosen person; otherwise the mesh node of that person
   * (or of the paired phone while its direct link is down).
   */
  function sendPath(): { kind: "direct" | "mesh" | "none"; target?: string } {
    const peer = chatPeerRef.current;
    if (paired.current && (!peer || (peer.device && peer.device === peerId.current))) return { kind: "direct" };
    const target = peer?.id || (meshDirRef.current[peerMeshId.current] ? peerMeshId.current : "");
    if (target && meshEnabledRef.current) return { kind: "mesh", target };
    return { kind: "none" };
  }
  async function sendMesh(target: string, value: string, kind: string, language: string, template?: string) {
    const key = meshDirRef.current[target]?.key;
    if (!key)
      throw new Error("Setting up encryption with this person. Try again in a few seconds.");
    const body = JSON.stringify({ k: "chat", text: value.slice(0, 900), lang: language, name: ref.current.name, dev: ref.current.deviceId, alert: kind === "alert" || undefined });
    const id = await Native.sendMeshPrivate(target, key, body);
    await add({ id, kind, text: value, language, time: Date.now(), direction: "out", status: "queued", template, mesh: true, recipient: target, private: true });
  }
  async function send(
    content: string,
    kind = "text",
    template?: string,
    language = ref.current.sourceSpeech,
  ) {
    const value = content.trim();
    if (!value) return;
    const path = sendPath();
    if (path.kind === "mesh") {
      await sendMesh(path.target!, value, kind, language, template);
      feedback();
      setText("");
      return;
    }
    if (kind === "alert" && path.kind === "none")
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
        // The direct link failed; reach the same person through the mesh if possible.
        const fallback = meshDirRef.current[peerMeshId.current] && meshEnabledRef.current ? peerMeshId.current : "";
        change({
          messages: fallback
            ? ref.current.messages.filter((x) => x.id !== m.id)
            : ref.current.messages.map((x) => (x.id === m.id ? { ...x, status: "failed" } : x)),
        });
        if (!fallback) throw e;
        await sendMesh(fallback, value, kind, language, template);
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
    // The speaker's own transcript lets the receiver read and hear it in their language.
    const transcript = packsRef.current[clipLanguage.current]
      ? String(await Native.transcribeVoice(uri, clipLanguage.current).catch(() => "")).trim().slice(0, 1000)
      : "";
    const path = sendPath();
    if (path.kind === "mesh") {
      if (!transcript)
        throw new Error("Voice cannot travel privately over the mesh. Use Translated speech or connect directly.");
      await sendMesh(path.target!, transcript, "text", clipLanguage.current);
      feedback();
      return;
    }
    const m: Message = {
      id: uid(),
      kind: "voice",
      text: transcript || "Voice message",
      transcript: transcript || undefined,
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
          recordSince.current = Date.now();
          // Mesh voice notes are capped at 3 seconds; direct clips at 20.
          maxRecording.current = setTimeout(() => ptt.current.release(), 20000);
        }
        if (state === "processing") setBusy("Processing your voice…");
        if (state === "idle") setBusy("");
      },
      error: (e: any) => {
        if (e?.code === "PACK_MISSING") setPackPrompt(e.language);
        else setError(e.message || String(e));
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
          throw Object.assign(
            new Error(
              "Download the active speech pack, or choose Original voice in Settings.",
            ),
            { code: "PACK_MISSING", language: clipLanguage.current },
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
    setPttHint("");
    if (!busy && !audioBusy.current && !remoteFloor.current) ptt.current.press();
  };
  const end = () => {
    // A tap is not a message: cancel quietly instead of sending a clip that is too short.
    if (recordingRef.current && Date.now() - recordSince.current < 500) {
      ptt.current.cancel();
      setPttHint("Keep holding while you speak");
      return;
    }
    ptt.current.release();
  };
  /**
   * One row per phone: Bluetooth and Wi-Fi Direct results with the same name are merged.
   * Bluetooth is preferred because it connects without a system prompt on the other phone.
   */
  function phoneRows() {
    const rank = (p: any) => (p.verified ? 2 : 0) + (p.transport === "bluetooth" ? 1 : 0);
    const byName = new Map<string, any>();
    for (const p of peers) {
      const key = String(p.name || p.id).trim().toLowerCase();
      const seen = byName.get(key);
      const transports = new Set([...(seen?.transports || []), p.transport]);
      byName.set(key, { ...(seen && rank(seen) >= rank(p) ? seen : p), transports: [...transports] });
    }
    return [...byName.values()].sort((a, b) => rank(b) - rank(a));
  }
  const findPhones = () =>
    run(async () => {
      setConnectionState("scanning");
      setJoiningId("");
      setRadioStatus("Looking for Talk2 devices…");
      setPeers([]);
      await permissions("radio");
      await Native.discover(transport);
    });
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
    <View style={[s.row, { paddingVertical: 6, flexWrap: "nowrap" }]}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: "600" }}>{name}</Text>
        {!!detail && <Text style={[s.small, { color: c.muted, marginTop: 0 }]}>{detail}</Text>}
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
  const askPublicLocation = () =>
    Alert.alert(
      "Share public mesh location",
      "Your coordinates, name and self-declared role will be public to nearby phones and relays for 30 seconds per update.",
      [
        { text: "Paired phone only", style: "cancel" },
        {
          text: "Share location",
          onPress: () =>
            run(async () => {
              await permissions("location");
              await Native.startSensors();
              if (!meshEnabledRef.current) return;
              meshSharingRef.current = true;
              setMeshSharing(true);
              lastMeshPosition.current = 0;
              await sendPosition(locationRef.current);
            }),
        },
      ],
    );
  const toggleSharing = (value: boolean) => {
    setLocationSharing(value);
    if (value && meshEnabledRef.current) askPublicLocation();
    if (!value && meshSharingRef.current) {
      meshSharingRef.current = false;
      setMeshSharing(false);
      run(() => Native.shareMeshPosition(JSON.stringify({ off: true, time: Date.now(), expires: Date.now() + 30000 })));
    }
  };
  async function refreshPermissions() {
    try {
      setPermState(await permissionStatus());
      setRadios(JSON.parse(await Native.radioState()));
    } catch {
      // Status is informational; features still request what they need.
    }
  }
  /** Requests every runtime permission at once, then offers Android's Bluetooth switch. */
  const allowAll = () =>
    run(async () => {
      const granted = await requestAllPermissions();
      setPermState(granted);
      setPermsAsked(true);
      const state = JSON.parse(await Native.radioState());
      setRadios(state);
      if (!state.bluetooth && granted.nearby !== "denied" && granted.nearby !== "blocked")
        await Native.enableBluetooth().catch(() => {});
    });
  function permissionCard() {
    const row = (icon: string, name: string, detail: string, ok: boolean | undefined, action: string, fix?: () => any) => (
      <View key={name} style={[s.settingRow, s.permRow, { borderColor: c.line }]}>
        <Text style={s.rowIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: "600" }}>{name}</Text>
          <Text style={[s.small, { color: c.muted, marginTop: 0 }]}>{detail}</Text>
        </View>
        {ok ? (
          <NativeText style={{ color: "#2BAA72", fontSize: 18, fontWeight: "800" }}>✓</NativeText>
        ) : fix ? (
          <Pressable accessibilityRole="button" onPress={() => run(fix)} style={[s.downloadButton, { borderColor: "#1769AA", paddingVertical: 6 }]}>
            <Text style={{ color: "#1769AA", fontWeight: "700", fontSize: 13 }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
    );
    // Denied permissions are asked again; permanently refused ones open this app's settings page.
    const runtime = (group: string, icon: string, name: string, detail: string, settings = "app") =>
      permState[group] === undefined
        ? null
        : row(icon, name, detail, permState[group] === "granted", permState[group] === "blocked" ? "Open settings" : "Allow", () =>
            permState[group] === "blocked" || permsAsked
              ? Native.openSystemSettings(settings)
              : allowAll(),
          );
    const pending =
      Object.values(permState).some((v) => v !== "granted") ||
      radios.bluetooth === false || radios.location === false || radios.wifi === false;
    return card(
      <>
        {label("🔐 PERMISSIONS")}
        <Text style={[s.small, { color: c.muted, marginTop: 0 }]}>
          Allow everything once now so every feature works offline later.
        </Text>
        {runtime("mic", "🎙", "Microphone", "Hold to talk and voice notes")}
        {runtime("location", "📍", "Location", "Radar distance and finding nearby phones")}
        {runtime("nearby", "ᛒ", "Nearby devices", "Find and connect phones over Bluetooth")}
        {runtime("wifiNearby", "📶", "Nearby Wi-Fi devices", "Wi-Fi Direct connections")}
        {runtime("notifications", "🔔", "Notifications", "Incoming alerts and SOS", "notifications")}
        {radios.bluetooth !== undefined &&
          row("ᛒ", "Bluetooth", "Must be on to connect phones", radios.bluetooth, "Turn on", () => Native.enableBluetooth())}
        {radios.location !== undefined &&
          row("🛰", "Location services", "Must be on for scanning and radar", radios.location, "Turn on", () => Native.openSystemSettings("location"))}
        {radios.wifi !== undefined &&
          row("📡", "Wi-Fi", "Must be on for Wi-Fi Direct (no internet needed)", radios.wifi, "Turn on", () => Native.openSystemSettings("wifi"))}
        {row("📳", "Vibration", "Granted automatically at install", true, "")}
        {row("🔘", "Hardware buttons", "Work inside Talk2 without a permission", true, "")}
        {pending &&
          button("✓ Allow all", allowAll)}
      </>,
    );
  }
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
  const langOf = (code: string) => langs.find((l) => l.code === code);
  const removePack = (code: string, name: string) =>
    Alert.alert("Remove pack?", name, [
      { text: "Cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          run(async () => {
            await Native.removePack(code);
            setDownloadPaused("");
            setDownloadError("");
            await status();
          }),
      },
    ]);
  function packInfo(code: string) {
    const details = packDetails[code] || {};
    const spec = (manifest || upstream).packs?.[code];
    const expectedBytes =
      details.expectedBytes ||
      spec?.files?.reduce((n: number, f: any) => n + f.bytes, 0) ||
      0;
    const downloadedBytes =
      progress?.pack === code ? progress.done : details.partialBytes || 0;
    return {
      ...packUtils.packStatus({
        code,
        inManifest: details.available ?? !!spec,
        installed: !!packs[code],
        downloading: downloading === code,
        paused: downloadPaused === code,
        failed: downloadError === code,
        downloadedBytes,
        expectedBytes,
      }),
      builtInVoice: details.builtInVoice === true,
      builtInSpeech: details.builtInSpeech === true,
    };
  }
  /** Download / progress / remove controls for one pack, shown right where it is needed. */
  function packAction(code: string, name: string) {
    const p = packInfo(code);
    if (p.builtInSpeech)
      return (
        <Text style={{ color: "#2BAA72", fontSize: 13 }}>✓ Built-in · works offline</Text>
      );
    if (p.state === "installed")
      return (
        <View style={s.packLine}>
          <Text style={{ color: "#2BAA72", flex: 1, fontSize: 13 }}>
            ✓ Installed · works offline
          </Text>
          <Pressable onPress={() => removePack(code, name)} hitSlop={8}>
            <Text style={{ color: "#B84A29", fontSize: 13 }}>Remove</Text>
          </Pressable>
        </View>
      );
    if (p.state === "unavailable")
      return (
        <Text style={[s.small, { color: c.muted }]}>
          Not available in this release
        </Text>
      );
    if (p.state === "downloading")
      return (
        <View style={{ gap: 6, marginTop: 6 }}>
          <View style={[s.bar, { backgroundColor: c.line }]}>
            <View
              style={[
                s.barFill,
                {
                  width: `${Math.min(100, (p.downloadedBytes / Math.max(1, p.expectedBytes)) * 100)}%`,
                },
              ]}
            />
          </View>
          <View style={s.packLine}>
            <Text style={{ color: c.muted, flex: 1, fontSize: 13 }}>
              {i18n.packProgressLabel(
                name,
                p.downloadedBytes,
                p.expectedBytes,
                data.ui,
              )}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                pauseRequested.current = code;
                Native.cancelDownload();
              }}
            >
              <Text style={{ color: "#B84A29", fontSize: 13 }}>Pause</Text>
            </Pressable>
          </View>
        </View>
      );
    const partial = p.downloadedBytes > 0;
    const verb =
      p.state === "failed" ? "Retry" : partial ? "Resume" : "Download";
    return (
      <View style={{ marginTop: 4 }}>
        <Pressable
          accessibilityRole="button"
          disabled={!!downloading}
          onPress={() => run(() => install(code))}
          style={[
            s.downloadButton,
            { borderColor: "#1769AA", opacity: downloading ? 0.45 : 1 },
          ]}
        >
          <NativeText style={{ color: "#1769AA", fontWeight: "700" }}>
            {`⬇ ${i18n.translate(verb, activeUi)} · ${partial ? `${i18n.mb(p.downloadedBytes)} / ` : ""}${i18n.mb(p.expectedBytes)} MB`}
          </NativeText>
        </Pressable>
        {partial && !downloading && (
          <Pressable onPress={() => removePack(code, name)} hitSlop={8}>
            <Text style={[s.small, { color: c.muted }]}>
              Remove partial files
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
  const settingRow = (
    icon: string,
    name: string,
    value: string,
    onPress: () => void,
    extra?: React.ReactNode,
  ) => (
    <View style={[s.settingRow, { borderColor: c.line }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={s.settingPress}
      >
        <Text style={s.rowIcon}>{icon}</Text>
        <Text style={{ color: c.ink, flex: 1, fontSize: 15, fontWeight: "600" }}>
          {name}
        </Text>
        <NativeText style={{ color: "#1769AA", fontSize: 15, fontWeight: "700" }}>
          {value}
        </NativeText>
        <NativeText style={{ color: c.muted, fontSize: 20 }}> ›</NativeText>
      </Pressable>
      {extra}
    </View>
  );
  /** Language & voice settings, shared by onboarding and Settings. */
  function languageCard() {
    const source = langOf(data.sourceSpeech),
      target = langOf(data.targetTranslation),
      voice = langOf(data.targetTranslation);
    return card(
      <>
        {label("🌐 LANGUAGE & VOICE")}
        {settingRow(
          "🈯",
          "App language",
          langOf(data.ui)?.native || "English",
          () => setPicker("ui"),
        )}
        {settingRow(
          "🎙",
          "I speak",
          source?.native || "",
          () => setPicker("source"),
          data.voiceMode === "translated" && !packs[data.sourceSpeech] ? (
            <View style={s.rowExtra}>
              <Text style={[s.small, { color: c.muted }]}>
                Needed for Translated speech
              </Text>
              {packAction(data.sourceSpeech, source?.name || data.sourceSpeech)}
            </View>
          ) : null,
        )}
        {settingRow(
          "🔁",
          "Translate to",
          target?.native || "",
          () => setPicker("target"),
          <View style={s.rowExtra}>
            <Text style={[s.small, { color: c.muted }]}>
              Messages you receive are shown and spoken in this language.
            </Text>
            {packInfo(data.targetTranslation).builtInVoice ? (
              <Text style={{ color: "#2BAA72", fontSize: 13 }}>
                ✓ Built-in voice · no download
              </Text>
            ) : (
              packAction(data.targetTranslation, voice?.name || data.targetTranslation)
            )}
            {["hi", "mr"].includes(data.targetTranslation) && (
              <>
                <Text style={[s.small, { color: c.muted }]}>
                  Translation pack · Hindi ↔ Marathi
                </Text>
                {packAction("translation", i18n.translate("Shared translation", activeUi))}
              </>
            )}
          </View>,
        )}
        {label("🎤 HOLD-TO-TALK SENDS")}
        <View style={s.segment}>
          {[
            ["original", "Original voice"],
            ["translated", "Translated speech"],
          ].map(([mode, text]) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: data.voiceMode === mode }}
              disabled={pttState !== "idle"}
              onPress={() =>
                change({ voiceMode: mode as Settings["voiceMode"] })
              }
              style={[
                s.segmentItem,
                { borderColor: c.line },
                data.voiceMode === mode && s.segmentActive,
              ]}
            >
              <Text
                style={{
                  color: data.voiceMode === mode ? "#FFF" : c.ink,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {text}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.small, { color: c.muted }]}>
          {data.voiceMode === "original"
            ? "Sends your recorded voice. No download needed."
            : "Turns speech into text on this phone, then sends it. Needs the speech pack."}
        </Text>
      </>,
    );
  }
  /** Bottom-sheet language chooser with per-language availability. */
  function pickerSheet() {
    const key =
      picker === "ui"
        ? "ui"
        : picker === "source"
          ? "sourceSpeech"
          : picker === "target"
            ? "targetTranslation"
            : "ttsVoice";
    const heading =
      picker === "ui"
        ? "App language"
        : picker === "source"
          ? "I speak"
          : picker === "target"
            ? "Translate to"
            : "Voice";
    const options =
      picker === "ui"
        ? langs.filter((l) => UI_LANGUAGES.includes(l.code))
        : langs;
    return (
      <Modal
        visible={!!picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker("")}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.bg }]}>
            {title(heading)}
            <ScrollView>
              {options.map((l) => {
                const p = packInfo(l.code);
                const selected = (data as any)[key] === l.code;
                const ready = p.installed || (picker === "tts" && p.builtInVoice);
                const badge =
                  picker === "ui" || picker === "target"
                    ? ""
                    : picker === "tts" && p.builtInVoice
                      ? i18n.translate("Built-in", activeUi)
                      : p.installed
                        ? i18n.translate("Installed", activeUi)
                        : p.state === "unavailable"
                          ? i18n.translate("Not available", activeUi)
                          : `⬇ ${i18n.mb(p.expectedBytes)} MB`;
                return (
                  <Pressable
                    key={l.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      change(
                        (picker === "target"
                          ? { targetTranslation: l.code, ttsVoice: l.code }
                          : { [key]: l.code }) as Partial<Settings>,
                      );
                      setPicker("");
                    }}
                    style={[
                      s.pickRow,
                      { borderColor: c.line },
                      selected && {
                        backgroundColor: dark ? "#173B61" : "#E3F0FB",
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <NativeText
                        style={{ color: c.ink, fontSize: 17, fontWeight: "700" }}
                      >
                        {l.native}
                      </NativeText>
                      <NativeText style={{ color: c.muted, fontSize: 12 }}>
                        {l.name}
                      </NativeText>
                    </View>
                    {!!badge && (
                      <NativeText
                        style={[
                          s.badge,
                          {
                            color: ready ? "#2BAA72" : c.muted,
                            borderColor: c.line,
                          },
                        ]}
                      >
                        {badge}
                      </NativeText>
                    )}
                    <NativeText
                      style={{
                        color: "#1769AA",
                        fontSize: 18,
                        width: 24,
                        textAlign: "right",
                      }}
                    >
                      {selected ? "✓" : ""}
                    </NativeText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {button("Close", () => setPicker(""), true)}
          </View>
        </View>
      </Modal>
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
                `${m.direction === "out" ? "You" : m.name || "Peer"}${m.mesh ? (m.private ? " · 🔒📡" : " · 📢") : " · 🔒"} · ${m.language === "und" ? i18n.translate("Language unknown", activeUi) : m.language.toUpperCase()} · ${new Date(m.time).toLocaleTimeString()} · ${i18n.translate(m.mesh && m.status === "custody" ? "Relay accepted a piece; recipient delivery pending" : m.status, activeUi)}`,
              )}
              <NativeText selectable style={[s.message, { color: c.ink }]}>
                {m.template
                  ? phrase(m.template, data.targetTranslation) || m.text
                  : m.translated ||
                    (m.kind === "voice"
                      ? m.transcript || i18n.translate(m.mesh ? "Public voice note" : "Voice message", activeUi)
                      : m.text)}
              </NativeText>
              {!!m.translated && (
                <NativeText selectable style={[s.small, { color: c.muted, marginTop: -6, marginBottom: 8 }]}>
                  {`${m.language.toUpperCase()}: ${m.kind === "voice" ? m.transcript : m.text}`}
                </NativeText>
              )}
              <View style={s.row}>
                {(m.kind !== "voice" || !!m.translated || !!m.transcript) &&
                  button(
                    `▶ ${langOf(data.targetTranslation)?.native || "Play"}`,
                    () => run(() => play(m), "Speaking…"),
                    true,
                  )}
                {m.kind === "voice" &&
                  !!m.audioUri &&
                  button("▶ Original voice", () => run(() => play(m, true), "Speaking…"), true)}
                {m.direction === "out" &&
                  !m.mesh &&
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
    if (!data.setup) return;
    if (tab === "radar")
      permissions("location")
        .then(() => Native.startSensors())
        .catch((e: any) => setSensorStatus(e.message));
    else if (!ref.current.shareLocation && !meshSharingRef.current) Native.stopSensors();
  }, [tab, data.setup]);
  // The mesh is always on while Talk2 is open; Android stops it in the background.
  useEffect(() => {
    if (!loaded || !data.setup || !appActive || meshActive || meshStarting.current) return;
    if (Number(Platform.Version) >= 31 && permState.nearby !== "granted") return;
    meshStarting.current = true;
    Mesh.start()
      .then((id) => {
        meshIdRef.current = id;
        meshEnabledRef.current = true;
        setMeshNode(id);
        setMeshActive(true);
        setMeshIssue("");
      })
      .catch((e: any) => setMeshIssue(e.message || String(e)))
      .finally(() => {
        meshStarting.current = false;
      });
  }, [loaded, data.setup, appActive, meshActive, permState.nearby, radios.bluetooth]);
  // Announce this phone so others, even several hops away, can list and message it.
  useEffect(() => {
    if (!meshActive) return;
    const announce = async () => {
      try {
        if (!sealKey.current) sealKey.current = await Native.meshSealKey();
        await Native.announceMesh(
          JSON.stringify({ name: ref.current.name, role: ref.current.role, device: ref.current.deviceId, speak: ref.current.sourceSpeech, hear: ref.current.targetTranslation, key: sealKey.current }),
        );
      } catch {
        // The next announcement retries.
      }
    };
    announce();
    const timer = setInterval(announce, 20000);
    return () => clearInterval(timer);
  }, [meshActive, data.name, data.targetTranslation]);
  // Load translation and the playback voice early so the first message is not delayed.
  useEffect(() => {
    if (loaded && data.setup) Native.warmUp(data.targetTranslation).catch(() => {});
  }, [loaded, data.setup, data.targetTranslation, packs.translation]);
  // Opening Connect while idle starts a scan right away.
  useEffect(() => {
    if (showConnect && !connected && ["idle", "failed"].includes(connectionState)) findPhones();
  }, [showConnect]);
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
  // Green: channel open. Blue: listening. Red: busy (peer speaking, processing or playing).
  const channelBusy = peerTalking || pttState === "processing" || (!!busy && pttState === "idle");
  const listening = pttState === "recording" || pttState === "arming";
  const mic = (
    <Animated.View style={{ transform: [{ scale: pttScale }], alignItems: "center" }}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={localized("Hold to talk")}
        // Keep the touch even if the finger moves, so the scroll view cannot cut a recording short.
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={begin}
        onResponderRelease={end}
        onResponderTerminate={end}
        style={[
          s.mic,
          { backgroundColor: listening ? "#2D8DD0" : channelBusy ? "#D35D5D" : "#2BAA72" },
        ]}
      >
        <NativeText style={{ color: "#FFF", fontSize: 26 }}>
          {listening ? "🎙" : channelBusy ? "⏳" : "●"}
        </NativeText>
        <Text style={{ color: "#FFF", fontWeight: "800", textAlign: "center" }}>
          {pttState === "recording"
            ? "Listening… release to send"
            : pttState === "arming"
              ? "Starting…"
              : peerTalking
                ? "Busy · peer is speaking"
                : channelBusy
                  ? "Busy…"
                  : "Hold to talk"}
        </Text>
      </View>
      {!!pttHint && (
        <Text style={[s.small, { color: c.muted }]}>{pttHint}</Text>
      )}
    </Animated.View>
  );
  const meshPeople = Object.values(meshDir)
    .filter((p: any) => clock - p.lastSeen < 90000 && !(connected && p.device && p.device === peerId.current))
    .sort((a: any, b: any) => a.hops - b.hops);
  const startChat = (p: any) => {
    setChatPeer(p);
    setShowConnect(false);
    setTab("talk");
    setRoute("");
  };
  function peopleList() {
    return (
      <>
        {label("📡 PEOPLE ON THE MESH")}
        {meshPeople.length === 0 ? (
          <Text style={[s.small, { color: c.muted }]}>
            {meshActive ? "Looking for people nearby…" : meshIssue || "Mesh is starting…"}
          </Text>
        ) : (
          meshPeople.map((p: any) => (
            <View key={p.id} style={[s.peerRow, { backgroundColor: c.card, borderColor: c.line }]}>
              <View style={[s.peerIcon, { backgroundColor: p.hops ? "#FBE9DF" : "#E8F3EC" }]}>
                <NativeText style={{ fontSize: 18 }}>{p.hops ? "🔀" : "📡"}</NativeText>
              </View>
              <View style={{ flex: 1 }}>
                <NativeText numberOfLines={1} style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>
                  {p.name}
                </NativeText>
                <NativeText style={[s.small, { color: c.muted, marginTop: 0 }]}>
                  {`${i18n.translate(roleLabels[p.role] || "Unknown role", activeUi)} · ${p.hops ? `${i18n.translate("via", activeUi)} ${p.hops} ${i18n.translate(p.hops === 1 ? "phone" : "phones", activeUi)}` : i18n.translate("Nearby", activeUi)}`}
                </NativeText>
              </View>
              <Pressable accessibilityRole="button" onPress={() => startChat(p)} style={s.joinButton}>
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  {chatPeer?.id === p.id ? "Chatting" : "Message"}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </>
    );
  }
  const fresh = locationPolicy.usableLocation(location, clock) && locationPolicy.usableLocation(peerLocation, clock);
  const compassReliable = !!compassMeta && clock - compassMeta.time < 3000 && compassMeta.accuracy >= 2 && compassMeta.trueNorth === true;
  const radarHeading = compassReliable ? heading : 0;
  const polar = fresh ? position(location, peerLocation, radarHeading) : null;
  const radarDistance = polar ? polar.distance : null;
  const discoveredPeers = [
    ...Object.values({
      ...meshLocations,
      ...Object.fromEntries(meshPeople.map((p: any) => [p.id, { ...meshLocations[p.id], ...p, transport: "BLE mesh", route: p.hops ? "relayed" : "direct", coords: meshLocations[p.id]?.coords }])),
    }).filter((p: any) => clock - p.lastSeen < 300000 && !(connected && p.device && p.device === peerId.current)),
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
  // Header indicator: green when linked to a phone or the mesh, amber while connecting, red when offline.
  const busyLink = ["scanning", "hosting", "joining", "pairing", "reconnecting"].includes(connectionState);
  const network = connected
    ? { color: "#2BAA72", label: "Connected" }
    : connectionState === "reconnecting"
      ? { color: "#E0A030", label: "Reconnecting…" }
      : meshActive && meshPeers.length > 0
        ? { color: "#2BAA72", label: "Mesh" }
        : busyLink
          ? { color: "#E0A030", label: "Connecting…" }
          : { color: "#D35D5D", label: "Offline" };
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
          <>
          {card(
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
              <Text style={[s.small, { color: "#B84A29" }]}>
                🔒 Choose carefully: your role can't be changed later.
              </Text>
            </>,
          )}
          {permissionCard()}
          </>
        ) : step === 1 ? (
          <>
            {note(
              "Original voice and the Hindi and Gujarati voices work right away. Speech-to-text packs are optional downloads.",
            )}
            {languageCard()}
          </>
        ) : (
          card(
            <>
              {label("MENUS & BUTTONS")}
              <View style={s.segment}>
                {UI_LANGUAGES.map((code) => (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityState={{ selected: data.ui === code }}
                    onPress={() => change({ ui: code })}
                    style={[s.segmentItem, { borderColor: c.line }, data.ui === code && s.segmentActive]}
                  >
                    <NativeText style={{ color: data.ui === code ? "#FFF" : c.ink, fontWeight: "700", textAlign: "center" }}>
                      {langOf(code)?.native}
                    </NativeText>
                  </Pressable>
                ))}
              </View>
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
          step === 2 ? "Start using Talk2" : "Continue",
          () =>
            step === 2
              ? change({ setup: true })
              : step === 0 && !permsAsked
                ? allowAll().finally(() => setStep(1))
                : setStep(step + 1),
          false,
          step === 0 && !data.name.trim(),
        )}
        {step > 0 && button("Back", () => setStep(step - 1), true)}
      </>
    );
  else if (route === "permissions")
    content = (
      <>
        {button("← Settings", () => setRoute(""), true)}
        {permissionCard()}
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
                {title(
                  sendPath().kind === "direct"
                    ? `● ${peerName}`
                    : chatPeer
                      ? `● ${chatPeer.name}`
                      : connectionState === "reconnecting"
                        ? "◌ Reconnecting…"
                        : "○ Ready when you are",
                )}
                {note(
                  sendPath().kind === "direct"
                    ? "🔒 Private · direct link"
                    : chatPeer
                      ? `🔒 ${i18n.translate("Private · via mesh", activeUi)}${meshDir[chatPeer.id]?.hops ? ` · ${meshDir[chatPeer.id].hops} ${i18n.translate(meshDir[chatPeer.id].hops === 1 ? "phone" : "phones", activeUi)}` : ""}`
                      : connectionState === "reconnecting"
                        ? meshDir[peerMeshId.current]
                          ? "Messages go through the mesh meanwhile."
                          : peerName
                        : "Messages stay here until you connect.",
                )}
                {!!chatPeer && (
                  <Pressable hitSlop={8} onPress={() => setChatPeer(null)}>
                    <Text style={{ color: "#1769AA", fontSize: 13, fontWeight: "700" }}>✕ End chat</Text>
                  </Pressable>
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
            {data.voiceMode === "translated" && !packs[data.sourceSpeech] && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPackPrompt(data.sourceSpeech)}
                style={[s.hint, { borderColor: "#D47743" }]}
              >
                <Text style={{ color: c.ink, fontSize: 13 }}>
                  ⚠ Speech pack needed for Translated speech · tap to fix
                </Text>
              </Pressable>
            )}
            {mic}
            {button(
              sendPath().kind !== "none" ? "Send message" : "Save for later",
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
            <View style={[s.row, { flexWrap: "nowrap" }]}>
              <Text style={s.rowIcon}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 17, fontWeight: "800" }}>Nearby mesh</Text>
                <NativeText style={[s.small, { color: c.muted, marginTop: 0 }]}>
                  {meshActive
                    ? `${meshPeers.length} ${i18n.translate("phones linked", activeUi)} · ${meshPeople.length} ${i18n.translate("people reachable", activeUi)}`
                    : meshIssue || i18n.translate("Mesh is starting…", activeUi)}
                </NativeText>
              </View>
              <View style={[s.netDot, { backgroundColor: meshActive ? "#2BAA72" : "#E0A030" }]} />
            </View>
            {option(
              "📍",
              "Share my location",
              meshActive ? "Paired phone and nearby mesh phones" : "Only with the paired phone",
              data.shareLocation || meshSharing,
              toggleSharing,
            )}
          </>,
        )}
        {card(
          <RadarPeers
            colors={c}
            peers={visiblePeers}
            heading={radarHeading}
            compass={compassReliable}
            ui={activeUi}
          />,
        )}
        {!location && (
          <Text style={[s.small, { color: c.muted, textAlign: "center", marginBottom: 12 }]}>
            {sensorStatus}
          </Text>
        )}
        {card(
          <>
            {label("📢 PUBLIC MESSAGE TO EVERYONE NEARBY")}
            <Field
              value={meshText}
              onChangeText={setMeshText}
              placeholder="Public mesh text or SOS details"
              multiline
              c={c}
            />
            <View style={s.segment}>
              <Pressable
                accessibilityRole="button"
                disabled={!meshText.trim()}
                onPress={() =>
                  run(async () => {
                    if (!meshActive) throw new Error("Start BLE mesh first");
                    await Mesh.sendText("*", meshText);
                    setMeshText("");
                  })
                }
                style={[s.segmentItem, s.segmentActive, { opacity: meshText.trim() ? 1 : 0.45 }]}
              >
                <Text style={{ color: "#FFF", fontWeight: "800", textAlign: "center" }}>Send</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert("Broadcast SOS?", meshText || "Emergency assistance needed", [
                    { text: "Cancel" },
                    {
                      text: "Broadcast SOS",
                      style: "destructive",
                      onPress: () =>
                        run(async () => {
                          if (!meshActive) throw new Error("Start BLE mesh first");
                          await Mesh.sendSOS(meshText || "Emergency assistance needed");
                          setMeshText("");
                        }),
                    },
                  ])
                }
                style={[s.segmentItem, { backgroundColor: "#C2412D", borderColor: "#C2412D" }]}
              >
                <Text style={{ color: "#FFF", fontWeight: "800", textAlign: "center" }}>🆘 SOS</Text>
              </Pressable>
            </View>
            <Text style={[s.small, { color: c.muted }]}>
              Anyone nearby, including relaying phones, can read this. For a private message, tap Message on a person.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showMeshVoice }}
              onPress={() => setShowMeshVoice(!showMeshVoice)}
              style={s.settingPress}
            >
              <Text style={s.rowIcon}>🎙</Text>
              <Text style={{ color: c.ink, flex: 1, fontSize: 15, fontWeight: "600" }}>
                Public voice note
              </Text>
              <NativeText style={{ color: c.muted }}>{showMeshVoice ? "▲" : "▼"}</NativeText>
            </Pressable>
            {showMeshVoice && (
              <MeshVoicePanel
                color={c.ink}
                installed={packs}
                available={(manifest || upstream).packs}
                active={meshActive}
                source={data.sourceSpeech}
                ui={activeUi}
                onSent={async (id, uri, language, transcript) => {
                  await add({ id, kind: "voice", text: transcript || "Public voice note", transcript, language, time: Date.now(), direction: "out", status: "queued", mesh: true, audioUri: uri });
                }}
              />
            )}
          </>,
        )}
      </>
    );
  else if (tab === "alert")
    content = (
      <>
        {label(
          sendPath().kind !== "none"
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
                sendPath().kind === "none",
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
              sendPath().kind === "none" || !text.trim(),
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
            <View style={s.profileRow}>
              <View style={s.avatarSmall}>
                {data.photo ? (
                  <Image
                    key={data.photo}
                    source={{ uri: data.photo }}
                    accessibilityLabel="Your profile photo"
                    style={{ width: 60, height: 60, borderRadius: 30 }}
                    onError={() =>
                      setError("Photo could not be opened. Choose it again.")
                    }
                  />
                ) : (
                  <NativeText style={{ fontSize: 24, color: "#347453" }}>
                    {data.name.slice(0, 1).toUpperCase() || "T"}
                  </NativeText>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  accessibilityLabel={localized("Your name")}
                  placeholder={localized("Your name")}
                  placeholderTextColor={c.muted}
                  value={data.name}
                  maxLength={40}
                  onChangeText={(x) => change({ name: x.slice(0, 40) })}
                  style={[s.nameInput, { color: c.ink, borderColor: c.line }]}
                />
                <View style={s.packLine}>
                  <Text style={[s.rolePill, { color: c.ink, borderColor: c.line }]}>
                    {`🔒 ${i18n.translate(roleLabels[data.role] || "Citizen", activeUi)}`}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      run(async () => {
                        const uri = await Native.chooseProfilePhoto();
                        if (uri) change({ photo: uri });
                      })
                    }
                  >
                    <Text style={{ color: "#1769AA", fontSize: 13, fontWeight: "700" }}>
                      Change photo
                    </Text>
                  </Pressable>
                  {!!data.photo && (
                    <Pressable hitSlop={8} onPress={() => change({ photo: "" })}>
                      <Text style={{ color: "#B84A29", fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
            <Text style={[s.small, { color: c.muted }]}>
              Your role was set during setup and can't be changed. Roles are self-declared.
            </Text>
          </>,
        )}
        {languageCard()}
        {card(
          <>
            {label("🔔 SOUND & FEEDBACK")}
            {option(
              "▶",
              "Auto-play received messages",
              "",
              data.autoPlay,
              (v) => change({ autoPlay: v }),
            )}
            {data.voiceMode === "translated" &&
              option(
                "✓",
                "Review transcript before sending",
                "",
                data.reviewSpeech,
                (v) => change({ reviewSpeech: v }),
              )}
            {option("📳", "Vibration", "", data.haptics, (v) =>
              change({ haptics: v }),
            )}
            {option("🔔", "Alert sounds", "", data.sounds, (v) =>
              change({ sounds: v }),
            )}
          </>,
        )}
        {card(
          <>
            {label("📍 LOCATION & PRIVACY")}
            {option(
              "📍",
              "Share my location",
              "Only with the paired phone while Talk2 is open",
              data.shareLocation,
              setLocationSharing,
            )}
            {option(
              "📡",
              "Nearby peer cue",
              "One cue when the paired phone is within 20 m",
              sirenEnabled,
              (v) => {
                setSirenEnabled(v);
                change({ sirenEnabled: v });
              },
            )}
            {settingRow("🗑", "Clear history & voice files", "", clearHistory)}
          </>,
        )}
        {card(
          <>
            {label("🎨 APPEARANCE")}
            <View style={s.segment}>
              {["system", "light", "dark"].map((x) => (
                <Pressable
                  key={x}
                  accessibilityRole="button"
                  accessibilityState={{ selected: data.theme === x }}
                  onPress={() => change({ theme: x })}
                  style={[
                    s.segmentItem,
                    { borderColor: c.line },
                    data.theme === x && s.segmentActive,
                  ]}
                >
                  <Text
                    style={{
                      color: data.theme === x ? "#FFF" : c.ink,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {x === "system" ? "Auto" : x === "light" ? "Light" : "Dark"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>,
        )}
        {card(
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showAdvanced }}
              onPress={() => setShowAdvanced(!showAdvanced)}
              style={s.settingPress}
            >
              <Text style={s.rowIcon}>⚙</Text>
              <Text style={{ color: c.ink, flex: 1, fontSize: 15, fontWeight: "600" }}>
                More options
              </Text>
              <NativeText style={{ color: c.muted, fontSize: 16 }}>
                {showAdvanced ? "▲" : "▼"}
              </NativeText>
            </Pressable>
            {showAdvanced && (
              <>
                {settingRow("✦", "Ask GPT (online)", "", () => setRoute("gpt"))}
                {settingRow("▥", "Performance & diagnostics", "", () =>
                  setRoute("analysis"),
                )}
                {settingRow("🔐", "Permissions", "", () => setRoute("permissions"))}
                {settingRow("📳", "Test vibration", "", () =>
                  run(async () => {
                    const ok = await Native.feedback("message");
                    if (!ok) throw new Error("This device has no vibrator");
                  }),
                )}
                {settingRow("🔔", "Test alert sound", "", () => Native.alertTone())}
                {label("OPTIONAL NODE BACKEND")}
                {field(
                  data.backend,
                  (x) => change({ backend: x }),
                  "https://your-talk2-server.example",
                )}
              </>
            )}
          </>,
        )}
        <Text style={[s.small, { color: c.muted, textAlign: "center" }]}>
          Talk2 1.1 · Android
        </Text>
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
          {/* The app name is never translated: NativeText bypasses localization ("Talk" is also a tab label). */}
          <NativeText accessibilityLabel={i18n.BRAND} style={[s.brand, { color: c.ink }]}>
            {i18n.BRAND.slice(0, -1)}
            <NativeText style={{ color: "#D47743" }}>{i18n.BRAND.slice(-1)}</NativeText>
          </NativeText>
          <Text style={{ color: c.muted, fontSize: 11, letterSpacing: 1 }}>
            A LITTLE CLOSER
          </Text>
        </View>
        {data.setup && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${localized(network.label)}. ${localized("Connect")}`}
            onPress={() => setShowConnect(true)}
            style={[s.netPill, { borderColor: c.line }]}
          >
            <View style={[s.netDot, { backgroundColor: network.color }]} />
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: "700" }}>{network.label}</Text>
          </Pressable>
        )}
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
                  langOf(progress.pack)?.name || i18n.translate("Shared translation", activeUi),
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
              <View style={s.sheetHeader}>
                <Text style={[s.sheetTitle, { color: c.ink }]}>Connect nearby.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={localized("Close")}
                  hitSlop={12}
                  onPress={() => setShowConnect(false)}
                >
                  <NativeText style={{ color: c.muted, fontSize: 24 }}>✕</NativeText>
                </Pressable>
              </View>
              <View
                style={[
                  s.connectionBanner,
                  { backgroundColor: c.card, borderColor: c.line },
                ]}
              >
                <View
                  style={[
                    s.statusIcon,
                    {
                      backgroundColor:
                        connected
                          ? "#2BAA72"
                          : busyLink
                            ? "#E0A030"
                            : connectionState === "failed"
                            ? "#D35D5D"
                            : "#2D8DD0",
                    },
                  ]}
                >
                  {busyLink ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                  <NativeText style={{ fontSize: 18 }}>
                    {connected || connectionState === "connected"
                      ? "✅"
                      : connectionState === "failed"
                        ? "⚠️"
                        : connectionState === "scanning"
                          ? "🔍"
                          : connectionState === "hosting"
                            ? "📡"
                            : connectionState === "joining" || connectionState === "pairing"
                              ? "🔗"
                              : "📱"}
                  </NativeText>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontWeight: "700" }}>
                    {connected
                      ? "Talk2 connection active"
                      : connectionState === "reconnecting"
                      ? "Reconnecting…"
                      : connectionState === "scanning"
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
                  <Text style={[s.small, { color: c.muted, marginTop: 2 }]}>
                    {radioStatus}
                  </Text>
                </View>
              </View>
              {connected ? (
                <View style={[s.steps, { backgroundColor: c.card, borderColor: c.line, alignItems: "center", paddingVertical: 20 }]}>
                  <NativeText style={{ fontSize: 34 }}>🤝</NativeText>
                  <NativeText style={{ color: c.ink, fontSize: 20, fontWeight: "800" }}>{peerName}</NativeText>
                  <Text style={{ color: c.muted }}>
                    {linkTransport === "wifi" ? "Talk2 · Wi-Fi Direct" : "Talk2 · Bluetooth"}
                  </Text>
                  <Text style={[s.small, { color: c.muted, textAlign: "center" }]}>
                    If the link drops, Talk2 reconnects automatically.
                  </Text>
                  <Pressable accessibilityRole="button" onPress={disconnect} style={[s.hostButton, { borderColor: "#D35D5D", alignSelf: "stretch" }]}>
                    <Text style={{ color: "#D35D5D", fontWeight: "800" }}>Disconnect</Text>
                  </Pressable>
                </View>
              ) : (
              <>
              {connectionState === "failed" && (
                <Pressable accessibilityRole="button" onPress={findPhones} style={[s.hint, { borderColor: "#D35D5D", marginBottom: 8 }]}>
                  <Text style={{ color: c.ink, fontWeight: "700" }}>↻ Try again</Text>
                </Pressable>
              )}
              <View style={[s.steps, { backgroundColor: c.card, borderColor: c.line }]}>
                {[
                  "Open this screen on both phones",
                  "Tap Find phones on both (or make one visible)",
                  "Tap the other phone's name",
                  "Check the code matches on both screens",
                ].map((step, i) => (
                  <View key={step} style={s.stepRow}>
                    <NativeText style={s.stepNumber}>{i + 1}</NativeText>
                    <Text style={{ color: c.ink, flex: 1, fontSize: 14 }}>{step}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={connectionState === "scanning"}
                onPress={findPhones}
                style={[s.bigAction, { opacity: connectionState === "scanning" ? 0.6 : 1 }]}
              >
                <NativeText style={{ fontSize: 22 }}>🔍</NativeText>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>
                  {connectionState === "scanning" ? "Scanning…" : "Find phones"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={hostingTransport !== null}
                onPress={() =>
                  run(async () => {
                    setConnectionState("hosting");
                    setHostingTransport("bluetooth");
                    setRadioStatus("Starting Bluetooth host…");
                    await permissions("radio");
                    await Native.bluetoothDiscoverable();
                    await Native.host("bluetooth");
                  })
                }
                style={[s.hostButton, { borderColor: c.line }]}
              >
                <NativeText style={{ fontSize: 18 }}>📡</NativeText>
                <Text style={{ color: c.ink, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
                  {hostingTransport ? "Visible · waiting for a phone…" : "Make this phone visible"}
                </Text>
              </Pressable>
              {label("PHONES FOUND")}
              {peers.length === 0 ? (
                <Text style={[s.small, { color: c.muted }]}>
                  {connectionState === "scanning"
                    ? "Searching… keep the other phone's Connect screen open."
                    : "No phones yet. Tap Find phones on both phones."}
                </Text>
              ) : (
                phoneRows()
                  .map((p) => (
                    <View
                      key={p.transport + p.id}
                      style={[s.peerRow, { backgroundColor: c.card, borderColor: c.line }]}
                    >
                      <View style={[s.peerIcon, { backgroundColor: p.transport === "wifi" ? "#E8F3EC" : "#E3F0FB" }]}>
                        <NativeText style={{ fontSize: 18, color: "#1769AA", fontWeight: "800" }}>
                          {p.transport === "wifi" ? "📶" : "ᛒ"}
                        </NativeText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <NativeText style={{ color: c.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                          {p.name}
                        </NativeText>
                        <Text style={[s.small, { color: p.verified ? "#2BAA72" : c.muted, marginTop: 0 }]}>
                          {p.verified
                            ? p.transport === "wifi" ? "Talk2 · Wi-Fi Direct" : "Talk2 · Bluetooth"
                            : "Nearby phone · Bluetooth"}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={!!joiningId}
                        onPress={() =>
                          run(async () => {
                            setJoiningId(p.transport + p.id);
                            setConnectionState("joining");
                            setRadioStatus(`${i18n.translate("Connecting to", activeUi)} ${p.name || "Talk2"}…`);
                            await Native.join(p.transport, p.id);
                          })
                        }
                        style={[s.joinButton, { opacity: joiningId && joiningId !== p.transport + p.id ? 0.4 : 1 }]}
                      >
                        {joiningId === p.transport + p.id ? (
                          <View style={s.packLine}>
                            <ActivityIndicator color="#FFF" size="small" />
                            <Text style={{ color: "#FFF", fontWeight: "700" }}>Connecting…</Text>
                          </View>
                        ) : (
                          <Text style={{ color: "#FFF", fontWeight: "700" }}>Connect</Text>
                        )}
                      </Pressable>
                    </View>
                  ))
              )}
              </>
              )}
              {peopleList()}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!pairCode} transparent onRequestClose={disconnect}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.bg }]}>
            {title("Compare this code on both phones")}
            <NativeText
              style={{
                fontSize: 42,
                letterSpacing: 7,
                color: "#2D8DD0",
                textAlign: "center",
                marginVertical: 20,
              }}
            >
              {pairCode}
            </NativeText>
            {pairConfirmed ? (
              <Text style={{ color: "#2BAA72", textAlign: "center", fontWeight: "700", marginBottom: 10 }}>
                ✓ Confirmed here. Waiting for the other phone to tap Codes match…
              </Text>
            ) : (
              button("Codes match", () =>
                run(async () => {
                  await Native.confirmPairing();
                  setPairConfirmed(true);
                  setRadioStatus("Waiting for the other phone to confirm");
                }),
              )
            )}
            {button("Cancel connection", disconnect, true)}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!packPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setPackPrompt("")}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.bg }]}>
            <NativeText style={{ fontSize: 40, textAlign: "center" }}>🎙</NativeText>
            {title("Speech pack needed")}
            <NativeText style={{ color: c.ink, fontSize: 18, fontWeight: "700" }}>
              {langOf(packPrompt)?.native} · {langOf(packPrompt)?.name}
            </NativeText>
            <Text style={{ color: c.muted, lineHeight: 21, marginVertical: 8 }}>
              Translated speech turns your voice into text on this phone. It needs this language's speech pack, a one-time download that then works offline.
            </Text>
            {!!packPrompt && packAction(packPrompt, langOf(packPrompt)?.name || packPrompt)}
            <Text style={[s.small, { color: c.muted, marginTop: 14 }]}>
              Or skip the download and send your recorded voice:
            </Text>
            {button("🎤 Use Original voice", () => {
              change({ voiceMode: "original" });
              setPackPrompt("");
            })}
            {button("Close", () => setPackPrompt(""), true)}
          </View>
        </View>
      </Modal>
      {pickerSheet()}
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
  netPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  netDot: { width: 10, height: 10, borderRadius: 5 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  small: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  packLine: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: "#2D8DD0" },
  downloadButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  settingRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  settingPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowIcon: { fontSize: 18, width: 28, textAlign: "center" },
  rowExtra: { paddingLeft: 38, paddingBottom: 8 },
  segment: { flexDirection: "row", gap: 6, marginVertical: 6 },
  segmentItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: "#1769AA", borderColor: "#1769AA" },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  badge: {
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarSmall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E3F0FB",
    alignItems: "center",
    justifyContent: "center",
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  rolePill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  hint: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 26, fontWeight: "800" },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2D8DD0",
    color: "#FFF",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 22,
  },
  bigAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1769AA",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 12,
  },
  hostButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    marginTop: 8,
  },
  peerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  peerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  joinButton: {
    backgroundColor: "#2BAA72",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
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
