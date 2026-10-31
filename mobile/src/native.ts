import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from "react-native";
export const Native = NativeModules.Talk2Native;
export const events = new NativeEventEmitter(Native);
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
