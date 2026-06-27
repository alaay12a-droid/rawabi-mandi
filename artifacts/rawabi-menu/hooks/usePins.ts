import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPut } from "@/constants/api";

const LOCAL_KEY = "@rawabi_pins_v2";
const MASTER_CODE = "RAWABI@2026";

export interface Pins {
  cashier: string;
  admin: string;
}

const DEFAULTS: Pins = {
  cashier: "Aa@000",
  admin: "Aa@000",
};

export async function loadPins(): Promise<Pins> {
  try {
    // Primary: fetch from server (works across all devices)
    const data = await apiGet<Pins>("/settings/pins");
    const pins = { ...DEFAULTS, ...data };
    // Cache locally for offline fallback
    AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(pins)).catch(() => {});
    return pins;
  } catch {
    // Fallback: use locally cached value
    try {
      const raw = await AsyncStorage.getItem(LOCAL_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULTS };
  }
}

export async function savePins(pins: Pins): Promise<void> {
  // Save to server (primary — syncs all devices)
  await apiPut("/settings/pins", pins);
  // Also cache locally for offline fallback
  AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(pins)).catch(() => {});
}

export function isMasterCode(code: string): boolean {
  return code === MASTER_CODE;
}
