import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

const KEY = "@rawabi_tab_config";

export interface TabConfig {
  height: number;
  paddingBottom: number;
  fontSize: number;
}

export const DEFAULT_TAB_CONFIG: TabConfig = {
  height: 70,
  paddingBottom: 10,
  fontSize: 12,
};

export async function loadTabConfig(): Promise<TabConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_TAB_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_TAB_CONFIG;
}

export async function saveTabConfig(config: TabConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export function useTabConfig() {
  const [config, setConfig] = useState<TabConfig>(DEFAULT_TAB_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTabConfig().then((c) => {
      setConfig(c);
      setLoaded(true);
    });
  }, []);

  const update = async (next: TabConfig) => {
    setConfig(next);
    await saveTabConfig(next);
  };

  return { config, loaded, update };
}
