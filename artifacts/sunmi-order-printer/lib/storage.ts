import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, TerminalEvent, OrderAction } from './types';

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
    const ids: unknown = data ? JSON.parse(data) : [];
    if (!Array.isArray(ids)) throw new Error('Invalid print history');
    return ids.map(String);
  } catch {
    throw new Error('تعذرت قراءة سجل الطباعة؛ أوقفت الطباعة التلقائية لمنع تكرار الفواتير');
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
  autoPrint: true,
  paperWidth: 58,
  copies: 1,
  kitchenCopy: true,
  customerCopy: true,
  keepAwake: true,
  language: 'ar',
  storeName: 'روابي المندي',
  supportPhone: '',
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
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export interface TerminalHistory {
  events: TerminalEvent[];
  actions: OrderAction[];
}

export async function getTerminalHistory(userId: number): Promise<TerminalHistory> {
  const raw = await AsyncStorage.getItem(`@sunmi_history_${userId}`);
  if (!raw) return { events: [], actions: [] };
  const parsed = JSON.parse(raw) as TerminalHistory;
  if (!Array.isArray(parsed.events) || !Array.isArray(parsed.actions)) {
    throw new Error('سجل الجهاز غير صالح');
  }
  return parsed;
}

export async function saveTerminalHistory(userId: number, history: TerminalHistory): Promise<void> {
  await AsyncStorage.setItem(`@sunmi_history_${userId}`, JSON.stringify({
    events: history.events.slice(0, 300),
    actions: history.actions.slice(0, 500),
  }));
}
