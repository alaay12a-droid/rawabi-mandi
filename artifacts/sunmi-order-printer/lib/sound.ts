import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { getSettings } from './storage';

type AudioApi = typeof import('expo-av').Audio;
type AudioSound = InstanceType<AudioApi['Sound']>;

let isAlerting = false;
let vibrationInterval: any = null;
let soundObject: AudioSound | null = null;
let audioPromise: Promise<AudioApi> | null = null;
let revision = 0;

const getAudio = (): Promise<AudioApi> => {
  audioPromise ??= import('expo-av').then(({ Audio }) => Audio);
  return audioPromise;
};

export const startAlert = async ({ force = false }: { force?: boolean } = {}) => {
  if (isAlerting) return;
  const current = ++revision;
  isAlerting = true;
  try {
    if (!force) {
      const settings = await getSettings();
      if (current !== revision) return;
      if (!settings.soundEnabled) { isAlerting = false; return; }
    }
    Vibration.vibrate(300);
    vibrationInterval = setInterval(() => {
      Vibration.vibrate(300);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 1500);

    const Audio = await getAudio();
    if (current !== revision) return;
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    if (current !== revision) return;
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/audio/alert.wav'),
      { isLooping: true, volume: 1, isMuted: false, shouldPlay: false }
    );
    if (current !== revision) {
      await sound.unloadAsync();
      return;
    }
    soundObject = sound;
    await soundObject.playAsync();
  } catch (e) {
    if (current !== revision) return;
    console.warn('Alert start error:', e);
    return 'تعذر تشغيل صوت التنبيه. تحقق من دعم الصوت وصوت الوسائط على جهاز Sunmi؛ الاهتزاز وحده لا يكفي.';
  }
};

export const stopAlert = async () => {
  revision++;
  isAlerting = false;
  
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  Vibration.cancel();
  
  const previousSound = soundObject;
  soundObject = null;
  if (previousSound) {
    try {
      await previousSound.stopAsync();
      await previousSound.unloadAsync();
    } catch (e) {}
  }
};
