import React from "react";
import { Text, View } from "react-native";
const i18n = require("../../shared/i18n.cjs");

const SIZE = 260, CENTER = SIZE / 2, RADIUS = CENTER - 16;
const COLORS = { paired: "#2D8DD0", direct: "#2BAA72", relayed: "#D47743" };
const roles: Record<string, string> = { citizen: "Citizen", volunteer: "Volunteer", medical_support: "Medical / support", emergency_staff: "Emergency staff" };
const kind = (p: any) => (p.transport === "Paired direct" ? "paired" : p.route === "relayed" ? "relayed" : "direct");
/** Rounds the farthest distance up to a readable radar range. */
function range(peers: any[]) {
  const far = Math.max(0, ...peers.filter((p) => p.polar).map((p) => p.polar.distance));
  return [50, 100, 250, 500, 1000, 2500, 5000].find((r) => far <= r) || Math.ceil(far / 1000) * 1000;
}
const meters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function RadarPeers({ colors, peers, heading, compass, ui }: {
  colors: { ink: string; muted: string; line: string; card: string }; peers: any[]; heading: number; compass: boolean; ui: string;
}) {
  const t = (s: string) => i18n.translate(s, ui);
  const max = range(peers);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ width: SIZE, height: SIZE, alignSelf: "center" }}>
        {[1, 2 / 3, 1 / 3].map((f) => (
          <View key={f} style={{ position: "absolute", left: CENTER - RADIUS * f, top: CENTER - RADIUS * f, width: RADIUS * 2 * f, height: RADIUS * 2 * f, borderRadius: RADIUS * f, borderWidth: 1, borderColor: colors.line, backgroundColor: f === 1 ? colors.card : undefined }} />
        ))}
        {[1 / 3, 2 / 3, 1].map((f) => (
          <Text key={f} style={{ position: "absolute", left: CENTER + 4, top: CENTER - RADIUS * f + 2, fontSize: 9, color: colors.muted }}>{meters(max * f)}</Text>
        ))}
        {(() => {
          const angle = (-heading * Math.PI) / 180;
          return <Text style={{ position: "absolute", left: CENTER - 5 + Math.sin(angle) * (RADIUS + 9), top: CENTER - 9 - Math.cos(angle) * (RADIUS + 9), fontWeight: "800", color: "#D35D5D" }}>N</Text>;
        })()}
        <View style={{ position: "absolute", left: CENTER - 7, top: CENTER - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.card }} />
        <Text style={{ position: "absolute", left: CENTER - 20, top: CENTER + 9, width: 40, textAlign: "center", fontSize: 10, color: colors.muted }}>You</Text>
        {peers.filter((p) => p.polar).map((p) => {
          const a = (p.polar.relative * Math.PI) / 180, r = Math.min(1, p.polar.distance / max) * RADIUS;
          const x = CENTER + Math.sin(a) * r, y = CENTER - Math.cos(a) * r;
          return (
            <View key={p.transport + p.id} style={{ position: "absolute", left: x - 40, top: y - 7, width: 80, alignItems: "center" }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS[kind(p)], borderWidth: 2, borderColor: "#FFF" }} />
              <Text numberOfLines={1} style={{ fontSize: 10, color: colors.ink, fontWeight: "700" }}>{p.name}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 14 }}>
        {(["paired", "direct", "relayed"] as const).map((k) => (
          <Text key={k} style={{ fontSize: 12, color: colors.muted }}>
            <Text style={{ color: COLORS[k] }}>● </Text>
            {t(k === "paired" ? "Paired" : k === "direct" ? "Mesh" : "Relayed")}
          </Text>
        ))}
      </View>
      {!compass && <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>{t("North-up (compass unavailable or unreliable)")}</Text>}
      {peers.map((p) => (
        <View key={p.transport + p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.line }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS[kind(p)] }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontWeight: "700", fontSize: 15 }}>{p.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t(roles[p.role] || "Unknown role")} · {t(kind(p) === "paired" ? "Paired" : kind(p) === "relayed" ? "Relayed" : "Mesh")}
            </Text>
          </View>
          <Text style={{ color: p.polar ? colors.ink : colors.muted, fontWeight: "700" }}>
            {p.polar ? `${meters(p.polar.distance)} ±${Math.round(p.uncertainty)}` : t("No location")}
          </Text>
        </View>
      ))}
      {!peers.length && <Text style={{ color: colors.muted, textAlign: "center" }}>{t("No one nearby yet")}</Text>}
    </View>
  );
}
