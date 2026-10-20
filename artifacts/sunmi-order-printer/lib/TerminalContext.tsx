import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './AuthContext';
import { getLastPrinterError, printOrder } from './printer';
import {
  addPrintedOrderId, getPrintedOrderIds, getSettings, saveSettings,
  getTerminalHistory, saveTerminalHistory, type TerminalHistory,
} from './storage';
import { startAlert, stopAlert } from './sound';
import { needsAcceptance as orderNeedsAcceptance } from './order-actions';
import type { Order, OrderAction, Settings, TerminalEvent } from './types';

interface TerminalValue {
  orders: Order[];
  ordersLoading: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;
  connected: boolean;
  lastSync: string | null;
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
  events: TerminalEvent[];
  actions: OrderAction[];
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  accept: (order: Order, minutes: number) => Promise<void>;
  reject: (order: Order, reason: string) => Promise<void>;
  setStatus: (order: Order, status: Order['status']) => Promise<void>;
  print: (order: Order, reason?: string) => Promise<void>;
  recordDriverAssignment: (order: Order, driverId: string, name: string) => Promise<void>;
  needsAcceptance: (order: Order) => boolean;
}

const TerminalContext = createContext<TerminalValue | null>(null);
const emptyHistory: TerminalHistory = { events: [], actions: [] };
type AwakeModule = { activate: (tag: string) => Promise<void>; deactivate: (tag: string) => Promise<void> };
function awakeModule() {
  return requireOptionalNativeModule<AwakeModule>('ExpoKeepAwake');
}

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [settings, setSettings] = useState<Settings | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const settingsSaveTail = useRef<Promise<void>>(Promise.resolve());
  const [history, setHistory] = useState<TerminalHistory>(emptyHistory);
  const [historyReady, setHistoryReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const historyRef = useRef(emptyHistory);
  const saveTail = useRef<Promise<void>>(Promise.resolve());
  const printedLock = useRef(false);
  const failedPrints = useRef(new Set<string>());
  const alive = useRef(true);

  const ordersQuery = useQuery({
    queryKey: ['orders', user?.id], queryFn: api.getOrders, enabled: !!user,
    refetchInterval: 5000, refetchIntervalInBackground: true, retry: 1,
  });
  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id], queryFn: api.getConversations, enabled: !!user,
    refetchInterval: 5000, refetchIntervalInBackground: true, retry: 1,
  });

  useEffect(() => {
    alive.current = true;
    if (!user) return;
    setLocalError(null);
    let cancelled = false;
    void Promise.all([getSettings(), getTerminalHistory(user.id)]).then(([savedSettings, savedHistory]) => {
      if (cancelled) return;
      setSettings(savedSettings);
      settingsRef.current = savedSettings;
      historyRef.current = savedHistory;
      setHistory(savedHistory);
      setHistoryReady(true);
    }).catch(error => {
      if (!cancelled) setLocalError(error instanceof Error ? error.message : 'تعذر تحميل إعدادات الجهاز');
    });
    return () => {
      cancelled = true;
      alive.current = false;
      void stopAlert();
    };
  }, [user?.id, loadAttempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      focusManager.setFocused(state === 'active');
      if (state === 'active') {
        void client.invalidateQueries({ queryKey: ['orders'] });
        void client.invalidateQueries({ queryKey: ['conversations'] });
      }
    });
    return () => subscription.remove();
  }, [client]);

  const persist = useCallback((next: TerminalHistory) => {
    if (!user) return Promise.reject(new Error('انتهت جلسة التاجر'));
    historyRef.current = next;
    setHistory(next);
    // Serialize snapshots so a slower earlier write cannot overwrite a newer one.
    const task = saveTail.current.catch(() => {}).then(() => saveTerminalHistory(user.id, next));
    saveTail.current = task;
    return task;
  }, [user?.id]);

  const addEvents = useCallback(async (incoming: TerminalEvent[]) => {
    const current = historyRef.current;
    const existing = new Set(current.events.map(event => event.id));
    const fresh = incoming.filter(event => !existing.has(event.id));
    if (!fresh.length) return;
    await persist({ ...current, events: [...fresh, ...current.events].slice(0, 300) });
  }, [persist]);

  useEffect(() => {
    if (!historyReady || !ordersQuery.data) return;
    const events: TerminalEvent[] = ordersQuery.data.flatMap(order => {
      if (!['pending', 'cancelled'].includes(order.status)) return [];
      return [{
        id: `order-${order.id}-${order.status}`,
        type: order.status === 'cancelled' ? 'cancellation' as const : 'order' as const,
        title: order.status === 'cancelled' ? `إلغاء الطلب #${order.dailyNumber}` : `طلب جديد #${order.dailyNumber}`,
        body: `${order.customerName} — ${(order.totalPrice / 100).toFixed(2)} ر.س`,
        orderId: order.id, createdAt: order.createdAt, read: false,
      }];
    });
    void addEvents(events).catch(error => setLocalError(error.message));
  }, [historyReady, ordersQuery.data, addEvents]);

  const messageSeen = useRef(new Map<number, string>());
  useEffect(() => {
    if (!historyReady || !conversationsQuery.data) return;
    const events: TerminalEvent[] = [];
    for (const conversation of conversationsQuery.data) {
      if (conversation.unread > 0 && messageSeen.current.get(conversation.orderId) !== conversation.lastAt) {
        events.push({
          id: `message-${conversation.orderId}-${conversation.lastAt}`, type: 'message',
          title: `رسالة للطلب #${conversation.dailyNumber ?? conversation.orderId}`,
          body: conversation.lastText, orderId: String(conversation.orderId),
          createdAt: conversation.lastAt, read: false,
        });
      }
      messageSeen.current.set(conversation.orderId, conversation.lastAt);
    }
    if (events.length && settings?.soundEnabled) {
      // Message notice is separate from the repeating pending-order alarm.
      void import('expo-haptics').then(haptics => haptics.notificationAsync(haptics.NotificationFeedbackType.Success)).catch(() => {});
    }
    void addEvents(events).catch(error => setLocalError(error.message));
  }, [conversationsQuery.data, historyReady, settings?.soundEnabled, addEvents]);

  const needsAcceptance = (order: Order) => orderNeedsAcceptance(order, history.actions, history.events);
  const hasPending = ordersQuery.data?.some(needsAcceptance) ?? false;
  useEffect(() => {
    if (hasPending && historyReady) void startAlert({ force: true }).then(error => {
      if (error) setLocalError(error);
    });
    else void stopAlert();
    return () => { void stopAlert(); };
  }, [hasPending, historyReady]);

  useEffect(() => {
    if (!settings?.keepAwake) return;
    let native: AwakeModule | null = null;
    try {
      native = awakeModule();
      if (!native) throw new Error('ميزة إبقاء الشاشة تعمل غير متوفرة في هذا البناء');
      void native.activate('rawabi-terminal').catch(error => {
        void addEvents([{
          id: 'keep-awake-unavailable', type: 'system', title: 'إبقاء الشاشة نشطة',
          body: error.message, createdAt: new Date().toISOString(), read: false,
        }]).catch(storageError => setLocalError(storageError.message));
      });
    } catch (error) {
      void addEvents([{
        id: 'keep-awake-unavailable', type: 'system', title: 'إبقاء الشاشة نشطة',
        body: error instanceof Error ? error.message : 'تعذر إبقاء الشاشة نشطة',
        createdAt: new Date().toISOString(), read: false,
      }]).catch(storageError => setLocalError(storageError.message));
    }
    return () => { void native?.deactivate('rawabi-terminal').catch(() => {}); };
  }, [settings?.keepAwake, addEvents]);

  const print = useCallback(async (order: Order, reason?: string) => {
    if (printedLock.current) throw new Error('انتظر انتهاء الطباعة الحالية');
    printedLock.current = true;
    try {
      let enriched = order;
      if (order.orderType === 'delivery') {
        try {
          const assignment = await api.getAssignment(order.id);
          enriched = { ...order, driverName: assignment?.driver?.name ?? undefined };
        } catch {
          // Printing must still be possible offline using the order already loaded.
          enriched = order;
        }
      }
      if (!alive.current) return;
      if (!await printOrder(enriched, reason)) throw new Error(getLastPrinterError() ?? 'تعذرت الطباعة. تحقق من الورق والطابعة');
      await addPrintedOrderId(String(order.id));
      failedPrints.current.delete(order.id);
    } finally {
      printedLock.current = false;
    }
  }, []);

  useEffect(() => {
    if (!settings?.autoPrint || !historyReady || !ordersQuery.data) return;
    let cancelled = false;
    async function drain() {
      const printed = new Set(await getPrintedOrderIds());
      const pending = (ordersQuery.data ?? [])
        .filter(order => order.status === 'preparing' && !printed.has(String(order.id)) && !failedPrints.current.has(order.id))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      for (const order of pending) {
        if (cancelled || !alive.current || printedLock.current) return;
        try {
          await print(order);
        } catch (error) {
          failedPrints.current.add(order.id);
          const detail = error instanceof Error ? error.message : 'فشلت الطباعة';
          await addEvents([{
            id: `print-error-${order.id}-${Date.now()}`, type: 'system',
            title: `تعذرت طباعة الطلب #${order.dailyNumber}`, body: `${detail}. استخدم الطباعة اليدوية بعد الفحص لتجنب تكرار الفاتورة.`,
            orderId: order.id, createdAt: new Date().toISOString(), read: false,
          }]);
        }
      }
    }
    void drain().catch(error => setLocalError(error.message));
    return () => { cancelled = true; };
  }, [ordersQuery.data, settings?.autoPrint, historyReady, print, addEvents]);

  const updateSettings = (changes: Partial<Settings>): Promise<void> => {
    const task = settingsSaveTail.current.catch(() => {}).then(async () => {
      if (!settingsRef.current) throw new Error('لم يتم تحميل الإعدادات');
      const next = { ...settingsRef.current, ...changes };
      if (!Number.isInteger(next.copies) || next.copies < 1 || next.copies > 5) throw new Error('عدد النسخ من 1 إلى 5');
      if (!next.customerCopy && !next.kitchenCopy) throw new Error('يجب تفعيل نسخة العميل أو المطبخ');
      if (changes.keepAwake === true && !awakeModule()) throw new Error('ميزة إبقاء الشاشة نشطة غير متوفرة في هذا البناء');
      await saveSettings(next);
      settingsRef.current = next;
      setSettings(next);
    });
    settingsSaveTail.current = task;
    return task;
  };

  const logAction = async (action: OrderAction) => persist({
    ...historyRef.current, actions: [action, ...historyRef.current.actions].slice(0, 500),
  });
  const setStatus = async (order: Order, status: Order['status']) => {
    if (!['pending', 'preparing', 'ready', 'done', 'cancelled'].includes(status)) throw new Error('حالة غير مدعومة من الخادم');
    await api.updateOrderStatus(order.id, status);
    // Reflect the confirmed mutation even if the subsequent refresh goes offline.
    client.setQueriesData<Order[]>({ queryKey: ['orders'] }, previous =>
      previous?.map(item => item.id === order.id ? { ...item, status } : item));
    await Promise.all([
      client.invalidateQueries({ queryKey: ['orders'] }),
      client.invalidateQueries({ queryKey: ['previous-orders'] }),
    ]);
  };
  const accept = async (order: Order, minutes: number) => {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error('مدة التحضير من 1 إلى 180 دقيقة');
    await setStatus(order, 'preparing');
    await logAction({ orderId: order.id, kind: 'accepted', detail: `مدة التحضير ${minutes} دقيقة (سجل الجهاز فقط)`, createdAt: new Date().toISOString() });
  };
  const reject = async (order: Order, reason: string) => {
    if (!reason.trim()) throw new Error('أدخل سبب الرفض');
    await setStatus(order, 'cancelled');
    await logAction({ orderId: order.id, kind: 'rejected', detail: reason.trim(), createdAt: new Date().toISOString() });
  };
  const recordDriverAssignment = async (order: Order, driverId: string, name: string) => {
    await api.assignDriver(order.id, driverId);
    await logAction({ orderId: order.id, kind: 'driver', detail: `تعيين المندوب: ${name}`, createdAt: new Date().toISOString() });
    await client.invalidateQueries({ queryKey: ['assignment', order.id] });
  };
  const markRead = async (id: string) => persist({
    ...historyRef.current, events: historyRef.current.events.map(event => event.id === id ? { ...event, read: true } : event),
  });
  const markAllRead = async () => persist({
    ...historyRef.current, events: historyRef.current.events.map(event => ({ ...event, read: true })),
  });

  // Children need concrete settings; loading failures remain explicit and retryable.
  if (!settings || !historyReady) {
    return <TerminalStartupError message={localError} retry={() => setLoadAttempt(value => value + 1)} />;
  }

  return <TerminalContext.Provider value={{
    orders: ordersQuery.data ?? [], ordersLoading: ordersQuery.isLoading,
    ordersError: ordersQuery.error?.message ?? localError,
    refreshOrders: async () => { await ordersQuery.refetch({ throwOnError: true }); },
    connected: ordersQuery.isSuccess && !ordersQuery.isError,
    lastSync: ordersQuery.dataUpdatedAt ? new Date(ordersQuery.dataUpdatedAt).toISOString() : null,
    settings, updateSettings, events: history.events, actions: history.actions,
    markRead, markAllRead, accept, reject, setStatus, print, recordDriverAssignment, needsAcceptance,
  }}>{children}</TerminalContext.Provider>;
}

// Kept minimal so the data provider does not pull native printer/UI at startup.
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
function TerminalStartupError({ message, retry }: { message: string | null; retry: () => void }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
    {message ? <><Text style={{ textAlign: 'center' }}>{message}</Text><Pressable onPress={retry}><Text>إعادة المحاولة</Text></Pressable></> : <ActivityIndicator />}
  </View>;
}

export function useTerminal() {
  const value = useContext(TerminalContext);
  if (!value) throw new Error('TerminalProvider غير متاح');
  return value;
}
