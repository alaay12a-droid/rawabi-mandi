import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings } from './types';

const PRINTED_ORDERS_KEY = '@printed_orders';
const SETTINGS_KEY = '@app_settings';
const DEVICE_ID_KEY = '@device_id';

export const getDeviceId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `sunmi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export const getPrintedOrderIds = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(PRINTED_ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addPrintedOrderId = async (id: string) => {
  const ids = await getPrintedOrderIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await AsyncStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(ids.slice(-1000)));
  }
};

const defaultSettings: Settings = {
  soundEnabled: true,
  autoAssignDrivers: false,
};

export const getSettings = async (): Promise<Settings> => {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    if (data) {
      return { ...defaultSettings, ...JSON.parse(data) };
    }
    return defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
};

export const saveSettings = async (settings: Settings) => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};
