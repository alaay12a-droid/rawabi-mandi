import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MusicTrack { name: string; ytId: string }

interface MusicCtx {
  musicPlaying:          boolean;
  musicIdx:              number;
  musicVolume:           number;
  musicTracks:           MusicTrack[];
  musicAddName:          string;
  musicAddUrl:           string;
  setMusicAddName:       (v: string) => void;
  setMusicAddUrl:        (v: string) => void;
  setMusicPlaying:       (v: boolean) => void;
  handlePlayMusicTrack:  (i: number) => void;
  handleMusicVolume:     (v: number) => void;
  handleAddMusicTrack:   () => void;
  handleDeleteMusicTrack:(i: number) => void;
  resetToPresets:        () => void;
}

// ─── Presets ──────────────────────────────────────────────────────────────────
export const PRESET_MUSIC: MusicTrack[] = [
  { name: "🎵 موسيقى عربية هادئة",   ytId: "ScNNfyq3d_U" },
  { name: "🎸 موسيقى عود كلاسيكية",  ytId: "6ximTDyOKpA" },
  { name: "🌙 موسيقى شرقية استرخاء", ytId: "BGiHupF-hM4" },
  { name: "☕ موسيقى مطعم هادئة",    ytId: "3kMBxg2gU3s" },
  { name: "🎶 موسيقى خلفية رائعة",   ytId: "0w8B0H8Hdps" },
];

function extractYtId(raw: string): string | null {
  const m = raw.match(
    /(?:youtube\.com\/(?:watch\?.*?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : /^[a-zA-Z0-9_-]{11}$/.test(raw.trim()) ? raw.trim() : null;
}

function loadTracks(): MusicTrack[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return PRESET_MUSIC;
  try {
    const s = localStorage.getItem("cashier_music_tracks");
    return s ? JSON.parse(s) : PRESET_MUSIC;
  } catch { return PRESET_MUSIC; }
}

function loadVol(): number {
  if (Platform.OS !== "web" || typeof window === "undefined") return 80;
  return parseInt(localStorage.getItem("cashier_music_vol") ?? "80", 10);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const MusicContext = createContext<MusicCtx | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [musicPlaying, setMusicPlayingState] = useState(false);
  const [musicIdx,    setMusicIdx]    = useState(0);
  const [musicVolume, setMusicVolume] = useState<number>(loadVol);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>(loadTracks);
  const [musicAddName, setMusicAddName] = useState("");
  const [musicAddUrl,  setMusicAddUrl]  = useState("");

  const musicFrameKey = useRef(0);
  const musicFrameRef = useRef<any>(null);

  const persistTracks = useCallback((tracks: MusicTrack[]) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try { localStorage.setItem("cashier_music_tracks", JSON.stringify(tracks)); } catch {}
  }, []);

  const setMusicPlaying = useCallback((v: boolean) => {
    if (v) musicFrameKey.current += 1;
    setMusicPlayingState(v);
  }, []);

  const handlePlayMusicTrack = useCallback((i: number) => {
    musicFrameKey.current += 1;
    setMusicIdx(i);
    setMusicPlayingState(true);
  }, []);

  const handleMusicVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, v));
    setMusicVolume(clamped);
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try { localStorage.setItem("cashier_music_vol", String(clamped)); } catch {}
    try {
      musicFrameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [clamped] }), "*"
      );
    } catch {}
  }, []);

  const handleAddMusicTrack = useCallback(() => {
    const ytId = extractYtId(musicAddUrl.trim());
    if (!ytId) return;
    const newTracks = [
      ...musicTracks,
      { name: musicAddName.trim() || `مقطع ${musicTracks.length + 1}`, ytId },
    ];
    setMusicTracks(newTracks);
    persistTracks(newTracks);
    setMusicAddName(""); setMusicAddUrl("");
  }, [musicAddName, musicAddUrl, musicTracks, persistTracks]);

  const handleDeleteMusicTrack = useCallback((i: number) => {
    if (musicTracks.length <= 1) return;
    const newTracks = musicTracks.filter((_, j) => j !== i);
    setMusicTracks(newTracks);
    persistTracks(newTracks);
    setMusicIdx(prev => (prev >= newTracks.length ? 0 : prev));
  }, [musicTracks, persistTracks]);

  const resetToPresets = useCallback(() => {
    setMusicTracks(PRESET_MUSIC);
    persistTracks(PRESET_MUSIC);
    setMusicIdx(0);
  }, [persistTracks]);

  return (
    <MusicContext.Provider value={{
      musicPlaying, musicIdx, musicVolume, musicTracks,
      musicAddName, musicAddUrl,
      setMusicAddName, setMusicAddUrl,
      setMusicPlaying,
      handlePlayMusicTrack, handleMusicVolume,
      handleAddMusicTrack, handleDeleteMusicTrack, resetToPresets,
    }}>
      {children}

      {/* ── Persistent hidden YouTube iframe (survives navigation) ── */}
      {Platform.OS === "web" && musicPlaying && musicTracks.length > 0 && (
        // @ts-ignore
        <iframe
          key={`yt-music-${musicFrameKey.current}`}
          ref={(el: any) => {
            musicFrameRef.current = el;
            if (el) {
              const tryVol = () => {
                try {
                  el.contentWindow?.postMessage(
                    JSON.stringify({ event: "command", func: "setVolume", args: [musicVolume] }), "*"
                  );
                } catch {}
              };
              setTimeout(tryVol, 2500);
              setTimeout(tryVol, 5000);
            }
          }}
          src={`https://www.youtube-nocookie.com/embed/${musicTracks[musicIdx]?.ytId ?? ""}?autoplay=1&loop=1&playlist=${musicTracks[musicIdx]?.ytId ?? ""}&enablejsapi=1&rel=0&controls=0`}
          allow="autoplay; encrypted-media"
          style={{
            position: "fixed",
            width: 1, height: 1,
            opacity: 0,
            pointerEvents: "none",
            border: "none",
            bottom: 0, left: 0,
          } as any}
          title="bg-music"
        />
      )}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicCtx {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
}
