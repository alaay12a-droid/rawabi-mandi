import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPut } from "@/constants/api";

export type UIDensity = "compact" | "normal" | "spacious";

export interface DensityValues {
  cardMH: number;
  cardMT: number;
  rowPV: number;
  rowPH: number;
  radius: number;
  labelSize: number;
  valueSize: number;
  typePV: number;
  sectionPT: number;
}

const PRESETS: Record<UIDensity, DensityValues> = {
  compact: {
    cardMH: 10, cardMT: 4,
    rowPV: 8,  rowPH: 12,
    radius: 10,
    labelSize: 11, valueSize: 12,
    typePV: 7, sectionPT: 6,
  },
  normal: {
    cardMH: 16, cardMT: 12,
    rowPV: 14,  rowPH: 16,
    radius: 16,
    labelSize: 13, valueSize: 14,
    typePV: 12, sectionPT: 12,
  },
  spacious: {
    cardMH: 16, cardMT: 20,
    rowPV: 20,  rowPH: 20,
    radius: 20,
    labelSize: 15, valueSize: 16,
    typePV: 16, sectionPT: 18,
  },
};

const STORAGE_KEY = "@ui_density";

export function useUIDensity() {
  const [density, setDensityState] = useState<UIDensity>("normal");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((cached) => {
      if (cached && cached in PRESETS) setDensityState(cached as UIDensity);
    });
    apiGet<{ value: string }>("/settings/ui-density")
      .then((r) => {
        const v = (r?.value ?? "normal") as UIDensity;
        if (v in PRESETS) {
          setDensityState(v);
          AsyncStorage.setItem(STORAGE_KEY, v);
        }
      })
      .catch(() => {});
  }, []);

  const saveDensity = useCallback(async (d: UIDensity) => {
    setDensityState(d);
    AsyncStorage.setItem(STORAGE_KEY, d);
    try { await apiPut("/settings/ui-density", { value: d }); } catch {}
  }, []);

  return { density, values: PRESETS[density], saveDensity };
}
