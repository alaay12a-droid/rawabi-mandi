import { Order, MenuItem, BranchHours, PrinterDiagnostic, DashboardUser } from './types';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function getApiBase(): string {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
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

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });
  const text = await response.text();

  if (!response.ok) {
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
  return fetchApi<Order[]>('/api/orders');
}

export const api = {
  login: (username: string, password: string) => fetchApi<DashboardUser>('/api/dashboard/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }),
  me: () => fetchApi<DashboardUser>('/api/dashboard/auth/me'),
  logout: () => fetchApi<{ ok: boolean }>('/api/dashboard/auth/logout', { method: 'POST' }),
  getOrders: async () => {
    const today = riyadhDateKey(new Date());
    return (await getAllVisibleOrders()).filter((order) => riyadhDateKey(new Date(order.createdAt)) === today);
  },
  updateOrderStatus: (id: string, status: string) => fetchApi<Order>(`/api/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }),
  getPreviousOrders: async () => {
    const today = riyadhDateKey(new Date());
    return (await getAllVisibleOrders()).filter((order) => riyadhDateKey(new Date(order.createdAt)) !== today);
  },
  getMenu: () => fetchApi<MenuItem[]>('/api/menu'),
  updateMenuItem: (id: string, data: Partial<MenuItem>) => fetchApi<MenuItem>(`/api/menu/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  getHours: () => fetchApi<BranchHours>('/api/branch-hours'),
  updateHours: (data: BranchHours) => fetchApi<BranchHours>('/api/branch-hours', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
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
      await fetchApi('/api/health');
      return { status: 'connected', paperStatus: 'ok', message: 'الخادم يعمل بشكل طبيعي' };
    } catch {
      return { status: 'disconnected', paperStatus: 'ok', message: 'لا يمكن الاتصال بالخادم' };
    }
  },
};
