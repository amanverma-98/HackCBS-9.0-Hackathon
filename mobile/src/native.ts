import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from "react-native";

export const Native = NativeModules.Talk2Native;
export const events = new NativeEventEmitter(Native);
export const Mesh = {
  start: () => Native.startMesh() as Promise<string>,
  stop: () => Native.stopMesh(),
  sendText: (destination: string, text: string) =>
    Native.sendMeshText(destination, text) as Promise<boolean>,
  sendSOS: (text: string) => Native.sendMeshSOS(text) as Promise<boolean>,
  acknowledgeInbox: (id: string) => Native.acknowledgeMeshInbox(id) as Promise<boolean>,
};
/** Runtime permissions every feature can need, grouped the way onboarding shows them. */
export function runtimeGroups(): Record<string, string[]> {
  const api = Number(Platform.Version);
  const groups: Record<string, string[]> = {
    mic: ["RECORD_AUDIO"],
    location: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
  };
  if (api >= 31) groups.nearby = ["BLUETOOTH_SCAN", "BLUETOOTH_CONNECT", "BLUETOOTH_ADVERTISE"];
  if (api >= 33) {
    groups.wifiNearby = ["NEARBY_WIFI_DEVICES"];
    groups.notifications = ["POST_NOTIFICATIONS"];
  }
  return groups;
}
const perm = (name: string) => (PermissionsAndroid.PERMISSIONS as any)[name];
// Permissions Android will no longer prompt for; only app settings can grant them.
const blocked = new Set<string>();
export type GroupState = "granted" | "denied" | "blocked";
export async function permissionStatus(): Promise<Record<string, GroupState>> {
  const result: Record<string, GroupState> = {};
  for (const [group, names] of Object.entries(runtimeGroups())) {
    const granted = (await Promise.all(names.map((n) => PermissionsAndroid.check(perm(n))))).every(Boolean);
    result[group] = granted ? "granted" : names.some((n) => blocked.has(n)) ? "blocked" : "denied";
  }
  return result;
}
/** Asks for every runtime permission in one system flow. */
export async function requestAllPermissions() {
  if (Platform.OS !== "android") return permissionStatus();
  const names = Object.values(runtimeGroups()).flat();
  const result = await PermissionsAndroid.requestMultiple(names.map(perm));
  for (const n of names) {
    if ((result as Record<string, string>)[perm(n)] === "never_ask_again") blocked.add(n);
    else blocked.delete(n);
  }
  return permissionStatus();
}
export async function permissions(kind: "mic" | "radio" | "location") {
  if (Platform.OS !== "android")
    throw new Error("Talk2 device integrations currently target Android");
  const names =
    kind === "mic"
      ? ["RECORD_AUDIO"]
      : ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"];
  if (kind === "radio" && Number(Platform.Version) >= 31)
    names.push("BLUETOOTH_SCAN", "BLUETOOTH_CONNECT", "BLUETOOTH_ADVERTISE");
  if (kind === "radio" && Number(Platform.Version) >= 33)
    names.push("NEARBY_WIFI_DEVICES");
  const result = await PermissionsAndroid.requestMultiple(
    names.map((n) => (PermissionsAndroid.PERMISSIONS as any)[n]),
  );
  if (Object.values(result).some((s) => s !== "granted"))
    throw new Error(
      "Permission required. Enable it in Android Settings, then retry.",
    );
}
