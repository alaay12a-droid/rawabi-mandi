import { Order, MenuItem, BranchHours, PrinterDiagnostic, DashboardUser, Driver, Assignment, Message, Conversation } from './types';
import Constants from 'expo-constants';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function getApiBase(): string {
  const developmentDomain = process.env.EXPO_PUBLIC_DOMAIN;
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL
    || (__DEV__ && developmentDomain ? `https://${developmentDomain}` : '');
  const value = raw.trim().replace(/\/+$/, '');
  if (!value || /example|placeholder|change-me|localhost/i.test(value)) {
    throw new Error('رابط API روابي غير مضبوط في EXPO_PUBLIC_API_BASE_URL');
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('رابط API يجب أن يكون رابط HTTPS صحيحًا');
  }
  return value;
}

export function validateDeviceConfiguration(): void {
  try {
    getApiBase();
    // A merchant session is sufficient. A device key is optional and is never
    // a substitute for logging in before showing management screens.
  } catch (error) {
    throw error instanceof Error ? error : new Error('تعذرت قراءة إعدادات جهاز Sunmi');
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  validateDeviceConfiguration();
  const deviceApiKey = (Constants.expoConfig?.extra?.sunmiDeviceApiKey as string | undefined)?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  let text: string;

  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(deviceApiKey ? { 'X-Device-API-Key': deviceApiKey } : {}),
        ...options?.headers,
      },
    });
    // Fetch resolves at headers. Keep the timeout active until the body arrives:
    // a stalled assignment body must not hold the terminal's print lock.
    text = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة');
    }
    throw new Error(
      `تعذر الاتصال بالخادم: ${error instanceof Error ? error.message : 'خطأ شبكة غير معروف'}`,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/dashboard/auth/')) unauthorizedHandler?.();
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) errorMsg = parsed.error;
      else if (parsed.message) errorMsg = parsed.message;
    } catch (e) {}
    throw new ApiError(errorMsg, response.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error('Failed to parse JSON response');
  }
}

const riyadhDateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

async function getAllVisibleOrders() {
  const rows = await fetchApi<Array<Omit<Order, 'id'> & { id: string | number }>>('/api/orders');
  if (!Array.isArray(rows)) throw new Error('استجابة الطلبات غير صحيحة');
  return rows.map(row => ({ ...row, id: String(row.id) }));
}

const jsonBody = (body: unknown, method = 'POST'): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const normalizeMenu = (item: MenuItem) => ({ ...item, id: String(item.itemId ?? item.id) });
const normalizeDriver = (driver: Driver) => ({ ...driver, id: String(driver.id) });

export const api = {
  login: (username: string, password: string) =>
    fetchApi<DashboardUser>('/api/dashboard/auth/login', jsonBody({ username, password })),
  me: () => fetchApi<DashboardUser>('/api/dashboard/auth/me'),
  logout: () => fetchApi<{ ok: boolean }>('/api/dashboard/auth/logout', jsonBody({})),
  getAllOrders: getAllVisibleOrders,
  getOrder: async (id: string) => {
    const row = await fetchApi<Order>(`/api/orders/${encodeURIComponent(id)}`);
    return { ...row, id: String(row.id) };
  },
  getOrders: async () => {
    const today = riyadhDateKey(new Date());
    return (await getAllVisibleOrders()).filter((order) => riyadhDateKey(new Date(order.createdAt)) === today);
  },
  updateOrderStatus: (id: string, status: string) => fetchApi<Order>(`/api/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }),
  getPreviousOrders: async () => {
    const today = riyadhDateKey(new Date());
    return (await getAllVisibleOrders()).filter((order) =>
      riyadhDateKey(new Date(order.createdAt)) !== today || order.status === 'done' || order.status === 'cancelled');
  },
  getMenu: async () => (await fetchApi<MenuItem[]>('/api/menu')).map(normalizeMenu),
  createMenuItem: async (data: Record<string, unknown>) => {
    const created = normalizeMenu(await fetchApi<MenuItem>('/api/menu', jsonBody(data)));
    // The existing create endpoint does not accept "available"; apply it via PUT.
    if (data.available === false) {
      try {
        return normalizeMenu(await fetchApi<MenuItem>(`/api/menu/${encodeURIComponent(created.id)}`, jsonBody({ available: false }, 'PUT')));
      } catch {
        throw new Error('تم إنشاء الصنف، لكن تعذر إيقافه. حدّث القائمة وأوقفه قبل محاولة الإضافة مجددًا');
      }
    }
    return created;
  },
  deleteMenuItem: (id: string) => fetchApi<{ ok: boolean }>(`/api/menu/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getCategories: () => fetchApi<Array<{ id: string; name: string }>>('/api/menu-categories'),
  reorderMenu: (itemIds: string[]) => fetchApi<{ ok: boolean }>('/api/menu/reorder', jsonBody({ itemIds }, 'PUT')),
  updateMenuItem: async (id: string, data: Partial<MenuItem>) => normalizeMenu(await fetchApi<MenuItem>(`/api/menu/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })),
  getHours: () => fetchApi<BranchHours>('/api/branch-hours'),
  updateHours: (data: BranchHours) => fetchApi<{ ok: boolean }>('/api/branch-hours', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  getBranchStatus: () => fetchApi<{ isOpen: boolean; message: string | null }>('/api/branch-status'),
  getDrivers: async () => (await fetchApi<Driver[]>('/api/drivers')).map(normalizeDriver),
  createDriver: async (data: { name: string; phone: string }) =>
    normalizeDriver(await fetchApi<Driver>('/api/drivers', jsonBody(data))),
  updateDriver: async (id: string, data: Partial<Driver>) =>
    normalizeDriver(await fetchApi<Driver>(`/api/drivers/${encodeURIComponent(id)}`, jsonBody(data, 'PUT'))),
  assignDriver: (orderId: string, driverId: string) => {
    const numericDriverId = Number(driverId);
    if (!Number.isSafeInteger(numericDriverId) || numericDriverId <= 0) {
      return Promise.reject(new Error('معرّف السائق غير صالح'));
    }
    return fetchApi<unknown>(`/api/orders/${encodeURIComponent(orderId)}/assign-driver`, jsonBody({ driverId: numericDriverId }));
  },
  getAssignment: (orderId: string) =>
    fetchApi<Assignment | null>(`/api/orders/${encodeURIComponent(orderId)}/assignment`),
  getConversations: async (): Promise<Conversation[]> => {
    const rows = await fetchApi<Array<Conversation & { order?: { dailyNumber: number; customerName: string } | null }>>('/api/messages/conversations');
    return rows.map(row => ({
      ...row, dailyNumber: row.order?.dailyNumber, customerName: row.order?.customerName,
    }));
  },
  getMessages: async (orderId: string) =>
    (await fetchApi<Message[]>(`/api/messages/order/${encodeURIComponent(orderId)}`))
      .filter(message => message.driverId == null),
  sendMessage: (orderId: string, text: string) =>
    fetchApi<Message>(`/api/messages/order/${encodeURIComponent(orderId)}`, jsonBody({ text, fromCashier: true })),
  markMessagesRead: (orderId: string) =>
    fetchApi<{ ok: boolean }>(`/api/messages/order/${encodeURIComponent(orderId)}/read`, jsonBody({ fromCashier: true }, 'PATCH')),
  // Settings
  getSoundSettings: () => fetchApi<{ enabled: boolean; volume: number }>('/api/settings/sounds'),
  updateSoundSettings: (enabled: boolean) => fetchApi<{ enabled: boolean }>('/api/settings/sounds', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, volume: 1 }),
  }),
  
  getAutoAssignSettings: () => fetchApi<{ enabled: boolean }>('/api/settings/drivers-auto-assign'),
  updateAutoAssignSettings: (enabled: boolean) => fetchApi<{ enabled: boolean }>('/api/settings/drivers-auto-assign', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  }),

  getDiagnostics: async (): Promise<PrinterDiagnostic> => {
    try {
      await fetchApi('/api/healthz');
      return { status: 'connected', paperStatus: 'ok', message: 'الخادم يعمل بشكل طبيعي' };
    } catch {
      return { status: 'disconnected', paperStatus: 'ok', message: 'لا يمكن الاتصال بالخادم' };
    }
  },
};

export async function runStartupCheck(): Promise<Order[]> {
  try {
    validateDeviceConfiguration();
    return await api.getOrders();
  } catch (error) {
    throw error instanceof Error ? error : new Error('حدث خطأ غير معروف أثناء تشغيل التطبيق');
  }
}
