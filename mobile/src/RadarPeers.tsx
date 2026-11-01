import React from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./Icon";
const i18n = require("../../shared/i18n.cjs");

const SIZE = 260,
  CENTER = SIZE / 2,
  RADIUS = CENTER - 18;
const COLORS = { paired: "#2D8DD0", direct: "#2BAA72", relayed: "#D47743" };
const roles: Record<string, string> = {
  citizen: "Citizen",
  volunteer: "Volunteer",
  medical_support: "Medical / support",
  emergency_staff: "Emergency staff",
};
const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const kind = (p: any): keyof typeof COLORS =>
  p.transport === "Paired direct"
    ? "paired"
    : p.route === "relayed"
      ? "relayed"
      : "direct";
/** Rounds the farthest distance up to a readable radar range. */
function range(peers: any[]) {
  const far = Math.max(
    0,
    ...peers.filter((p) => p.polar).map((p) => p.polar.distance),
  );
  return (
    [50, 100, 250, 500, 1000, 2500, 5000].find((r) => far <= r) ||
    Math.ceil(far / 1000) * 1000
  );
}
const meters = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

/**
 * Radar with anonymous dots plus the discovery list. Both render the same filtered peer array
 * (peerView in shared/location.cjs); details appear only in the list, never on the dots.
 */
export function RadarPeers({
  colors,
  peers,
  filter,
  onFilter,
  heading,
  compass,
  ui,
  now,
}: {
  colors: { ink: string; muted: string; line: string; card: string };
  peers: any[];
  filter: string;
  onFilter: (f: "all" | "direct" | "relayed") => void;
  heading: number;
  compass: boolean;
  ui: string;
  now: number;
}) {
  const t = (s: string) => i18n.translate(s, ui);
  const max = range(peers);
  const dots = peers.filter((p) => p.polar);
  return (
    <View style={{ gap: 12 }}>
      <View
        accessible
        accessibilityLabel={`${t("Radar")}: ${dots.length} ${t("people with a fresh location")}`}
        style={{ width: SIZE, height: SIZE, alignSelf: "center" }}
      >
        {[1, 2 / 3, 1 / 3].map((f) => (
          <View
            key={f}
            style={{
              position: "absolute",
              left: CENTER - RADIUS * f,
              top: CENTER - RADIUS * f,
              width: RADIUS * 2 * f,
              height: RADIUS * 2 * f,
              borderRadius: RADIUS * f,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: f === 1 ? colors.card : undefined,
            }}
          />
        ))}
        {[1 / 3, 2 / 3, 1].map((f) => (
          <Text
            key={f}
            style={{
              position: "absolute",
              left: CENTER + 4,
              top: CENTER - RADIUS * f + 2,
              fontSize: 9,
              color: colors.muted,
            }}
          >
            {meters(max * f)}
          </Text>
        ))}
        {["N", "E", "S", "W"].map((name, i) => {
          const angle = ((i * 90 - heading) * Math.PI) / 180;
          return (
            <Text
              key={name}
              style={{
                position: "absolute",
                left: CENTER - 5 + Math.sin(angle) * (RADIUS + 10),
                top: CENTER - 9 - Math.cos(angle) * (RADIUS + 10),
                fontWeight: "800",
                fontSize: 12,
                color: name === "N" ? "#D35D5D" : colors.muted,
              }}
            >
              {name}
            </Text>
          );
        })}
        <View
          style={{
            position: "absolute",
            left: CENTER - 8,
            top: CENTER - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.ink,
            borderWidth: 3,
            borderColor: colors.card,
          }}
        />
        {dots.map((p) => {
          const a = (p.polar.relative * Math.PI) / 180,
            r = Math.min(1, p.polar.distance / max) * RADIUS;
          return (
            <View
              key={p.transport + p.id}
              style={{
                position: "absolute",
                left: CENTER + Math.sin(a) * r - 7,
                top: CENTER - Math.cos(a) * r - 7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: COLORS[kind(p)],
                borderWidth: 2,
                borderColor: "#FFF",
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 14 }}>
        {(["paired", "direct", "relayed"] as const).map((k) => (
          <View
            key={k}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: COLORS[k],
              }}
            />
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {t(
                k === "paired"
                  ? "Paired"
                  : k === "direct"
                    ? "Direct"
                    : "Relayed",
              )}
            </Text>
          </View>
        ))}
      </View>
      {!compass && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="compass-off-outline" size={14} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {t("North-up (compass unavailable or unreliable)")}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
        {(["all", "direct", "relayed"] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === mode }}
            onPress={() => onFilter(mode)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: filter === mode ? "#1769AA" : colors.line,
              backgroundColor: filter === mode ? "#1769AA" : undefined,
            }}
          >
            <Text
              style={{
                color: filter === mode ? "#FFF" : colors.ink,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {t(
                mode === "all"
                  ? "All"
                  : mode === "direct"
                    ? "Direct"
                    : "Relayed",
              )}
            </Text>
          </Pressable>
        ))}
      </View>
      {peers.map((p) => {
        const seen = Number.isFinite(p.lastSeen)
          ? Math.max(0, Math.round((now - p.lastSeen) / 1000))
          : null;
        const route =
          kind(p) === "paired"
            ? t("Paired · direct link")
            : p.hops
              ? `${t("Relayed")} · ${p.hops} ${t(p.hops === 1 ? "hop" : "hops")}`
              : t("Direct mesh link");
        const role = `${t(roles[p.role] || "Unknown role")} · ${t(p.role === "emergency_staff" ? "Unverified emergency staff" : "Self-declared · unverified")}`;
        return (
          <View
            key={p.transport + p.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 9,
              borderTopWidth: 1,
              borderColor: colors.line,
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: COLORS[kind(p)],
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.ink, fontWeight: "700", fontSize: 15 }}
              >
                {p.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{role}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {route}
                {seen !== null
                  ? ` · ${t("Last seen")} ${seen} ${t("seconds ago")}`
                  : ""}
              </Text>
            </View>
            {p.polar ? (
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      transform: [{ rotate: `${p.polar.relative}deg` }],
                    }}
                  >
                    <Icon name="navigation" size={14} color={colors.ink} />
                  </Text>
                  <Text style={{ color: colors.ink, fontWeight: "800" }}>
                    {meters(p.polar.distance)}
                  </Text>
                </View>
                <Text
                  style={{ color: colors.muted, fontSize: 11 }}
                >{`${CARDINALS[Math.round(p.polar.bearing / 45) % 8]} · ±${Math.round(p.uncertainty)} m`}</Text>
              </View>
            ) : (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  maxWidth: 120,
                  textAlign: "right",
                }}
              >
                {t(
                  p.located
                    ? "Location shared · waiting for your GPS"
                    : p.coords
                      ? "Shared location expired"
                      : "Location not shared",
                )}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
