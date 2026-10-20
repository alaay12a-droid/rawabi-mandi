import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { getSettings } from './storage';

type AudioApi = typeof import('expo-audio');
type AudioSound = ReturnType<AudioApi['createAudioPlayer']>;

let isAlerting = false;
let vibrationInterval: any = null;
let soundObject: AudioSound | null = null;
let audioPromise: Promise<AudioApi> | null = null;
let revision = 0;

const getAudio = (): Promise<AudioApi> => {
  audioPromise ??= import('expo-audio');
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
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    });
    if (current !== revision) return;
    const sound = Audio.createAudioPlayer(
      require('../assets/audio/alert.wav'),
      { keepAudioSessionActive: true }
    );
    if (current !== revision) {
      sound.remove();
      return;
    }
    sound.loop = true;
    sound.volume = 1;
    sound.muted = false;
    soundObject = sound;
    sound.setActiveForLockScreen(true, { title: 'طلب جديد بانتظار القبول', artist: 'چڤن' }, {
      showSeekBackward: false, showSeekForward: false,
    });
    sound.play();
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
      previousSound.setActiveForLockScreen(false);
      previousSound.pause();
    } catch (e) {
      console.warn('Alert pause error:', e);
    } finally {
      try { previousSound.remove(); } catch {}
    }
  }
};
