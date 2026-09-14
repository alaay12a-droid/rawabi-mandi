import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { getSettings } from './storage';

let isAlerting = false;
let vibrationInterval: any = null;
let soundObject: Audio.Sound | null = null;

export const startAlert = async () => {
  if (isAlerting) return;
  
  const settings = await getSettings();
  if (!settings.soundEnabled) return;
  
  isAlerting = true;

  try {
    vibrationInterval = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 1500);

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/audio/alert.wav'),
      { isLooping: true }
    );
    soundObject = sound;
    await soundObject.playAsync();
  } catch (e) {
    console.warn('Alert start error:', e);
  }
};

export const stopAlert = async () => {
  isAlerting = false;
  
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  
  if (soundObject) {
    try {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
    } catch (e) {}
  }
};
