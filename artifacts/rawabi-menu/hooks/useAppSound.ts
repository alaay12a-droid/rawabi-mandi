import { useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { SOUND_KEYS, getCustomKey, type SoundOption } from "@/constants/appSounds";

// ── Active sound ref (module-level) — allows stopping from outside ─────────
let _activeSoundObj: import("expo-av").Audio.Sound | null = null;

export async function stopCurrentSound(): Promise<void> {
  try {
    if (_activeSoundObj) {
      const s = _activeSoundObj;
      _activeSoundObj = null;
      await s.stopAsync();
      await s.unloadAsync();
    }
  } catch {}
}

// ── Web Audio synthesis ────────────────────────────────────────────────────
function playSynth(option: SoundOption): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx: AudioContext = new AudioCtx();

  switch (option) {
    case "chime":
      [880, 1108, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        const s = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.4, s + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.38);
        osc.start(s); osc.stop(s + 0.4);
      });
      break;

    case "bell":
      {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 740;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start(); osc.stop(ctx.currentTime + 1.2);
      }
      break;

    case "short":
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square"; osc.frequency.value = freq;
        const s = ctx.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.3, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.11);
        osc.start(s); osc.stop(s + 0.12);
      });
      break;

    default:
      break;
  }
}

async function playWebFile(src: string): Promise<boolean> {
  try {
    const audio = new (window as any).Audio(src);
    audio.volume = 1.0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

// ── Play a URI file natively via expo-av ────────────────────────────────────
export async function playUriSound(uri: string): Promise<void> {
  try {
    await stopCurrentSound();
    const { Audio } = require("expo-av") as typeof import("expo-av");
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri }, { volume: 1 });
    _activeSoundObj = sound;
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        if (_activeSoundObj === sound) _activeSoundObj = null;
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {}
}

// ── Core player ────────────────────────────────────────────────────────────
export async function playAppSound(
  type: "order" | "message" | "delivery",
  defaultAsset: string
): Promise<void> {
  try {
    const soundKey = (() => {
      if (type === "order")    return SOUND_KEYS.order;
      if (type === "delivery") return SOUND_KEYS.delivery;
      return SOUND_KEYS.message;
    })();
    const customKey = getCustomKey(soundKey);

    const [mutedRaw, optionRaw, customUri] = await Promise.all([
      AsyncStorage.getItem(SOUND_KEYS.muted),
      AsyncStorage.getItem(soundKey),
      AsyncStorage.getItem(customKey),
    ]);

    if (mutedRaw === "true") return;

    const option = (optionRaw ?? "default") as SoundOption;
    if (option === "silent") return;

    // Haptics (mobile only, silent on web)
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

    // Custom file from device
    if (option === "custom" && customUri) {
      if (Platform.OS !== "web") {
        await playUriSound(customUri);
      }
      return;
    }

    if (Platform.OS === "web") {
      if (option === "default") {
        const ok = await playWebFile(defaultAsset);
        if (!ok) playSynth("chime");
      } else {
        playSynth(option);
      }
    } else {
      // Native via expo-av
      try {
        await stopCurrentSound();
        const { Audio } = require("expo-av") as typeof import("expo-av");
        const asset = (() => {
          if (type === "order") return require("@/assets/sounds/new_order.mp3");
          if (type === "delivery") return require("@/assets/sounds/order_arrived.m4a");
          return require("@/assets/sounds/notification.wav");
        })();
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 1 });
        _activeSoundObj = sound;
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            if (_activeSoundObj === sound) _activeSoundObj = null;
            sound.unloadAsync().catch(() => {});
          }
        });
      } catch {}
    }
  } catch { /* silent */ }
}

// ── GPS signal sounds ───────────────────────────────────────────────────────
export async function playGpsSound(event: "lost" | "restored"): Promise<void> {
  try {
    if (Platform.OS === "web") {
      playSynth(event === "lost" ? "short" : "chime");
      return;
    }
    await stopCurrentSound();
    const { Audio } = require("expo-av") as typeof import("expo-av");
    const asset =
      event === "lost"
        ? require("@/assets/sounds/notification.wav")
        : require("@/assets/sounds/order_arrived.m4a");
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.7 });
    _activeSoundObj = sound;
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        if (_activeSoundObj === sound) _activeSoundObj = null;
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useAppSound() {
  const playOrder = useCallback(
    () => playAppSound("order",    "/assets/sounds/new_order.mp3"),
    []
  );
  const playMessage = useCallback(
    () => playAppSound("message",  "/assets/sounds/notification.wav"),
    []
  );
  const playDelivery = useCallback(
    () => playAppSound("delivery", "/assets/sounds/order_arrived.m4a"),
    []
  );

  const playGpsLost = useCallback(() => playGpsSound("lost"), []);
  const playGpsRestored = useCallback(() => playGpsSound("restored"), []);

  // Preview: play a specific option without saving it
  const previewSound = useCallback(async (option: SoundOption, customUri?: string) => {
    if (option === "silent") return;
    if (option === "custom" && customUri && Platform.OS !== "web") {
      await playUriSound(customUri);
      return;
    }
    if (Platform.OS === "web") {
      playSynth(option === "default" ? "chime" : option);
    }
  }, []);

  return { playOrder, playMessage, playDelivery, previewSound, playGpsLost, playGpsRestored };
}
