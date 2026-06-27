import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/constants/api";

const STORAGE_KEY = "@rawabi_favorites";

interface FavoritesCtx {
  favorites: string[];
  enabled: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesCtx>({
  favorites: [],
  enabled: true,
  isFavorite: () => false,
  toggleFavorite: () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const [raw, setting] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        apiGet<{ enabled: boolean }>("/settings/favorites-enabled").catch(() => ({ enabled: true })),
      ]);
      setFavorites(raw ? JSON.parse(raw) : []);
      setEnabled(setting.enabled);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const isFavorite = useCallback((id: string) => enabled && favorites.includes(id), [enabled, favorites]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!enabled) return;
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [enabled]);

  return (
    <FavoritesContext.Provider value={{ favorites: enabled ? favorites : [], enabled, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  return useContext(FavoritesContext);
}
