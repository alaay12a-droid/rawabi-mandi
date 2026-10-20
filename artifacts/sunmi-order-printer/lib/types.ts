export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  customization?: {
    size?: string;
    riceType?: string;
    addon?: string;
    variantId?: string;
    variantName?: string;
    variantPrice?: number;
    unitPrice?: number;
    selectedOptions?: Array<{ groupName: string; choice: string }>;
  };
}

export interface Order {
  id: string;
  dailyNumber: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  items: OrderItem[];
  totalPrice: number;
  deliveryFee: number;
  discountAmount: number;
  status: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'done' | 'cancelled';
  orderType: 'delivery' | 'pickup';
  paymentMethod: string;
  notes: string;
  createdAt: string;
  branchId?: string | null;
  branchName?: string | null;
  taxAmount?: number | null;
  driverName?: string | null;
}

export interface DashboardUser {
  id: number;
  username: string;
  role: string;
  branchIds?: number[];
}

export interface MenuItem {
  id: string;
  itemId?: string;
  name: string;
  price: number;
  available: boolean;
  stock: number | null;
  category?: string;
  imageUrl?: string | null;
  sortOrder?: number;
  sizes?: unknown[];
  options?: unknown[];
}

export interface BranchHours {
  enabled: boolean;
  days: Array<{ enabled: boolean; open: string; close: string }>;
}

export interface Settings {
  soundEnabled: boolean;
  autoAssignDrivers: boolean;
  autoPrint: boolean;
  paperWidth: 58 | 80;
  copies: number;
  kitchenCopy: boolean;
  customerCopy: boolean;
  keepAwake: boolean;
  language: 'ar' | 'en';
  storeName: string;
  supportPhone: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  isOnline: boolean;
  lastLat: number | null;
  lastLng: number | null;
  locationAt: string | null;
}

export interface PrinterDiagnostic {
  status: 'connected' | 'disconnected' | 'error';
  paperStatus: 'ok' | 'low' | 'out';
  message: string;
}

export interface Conversation {
  orderId: number;
  lastText: string;
  lastAt: string;
  unread: number;
  customerName?: string;
  dailyNumber?: number;
}

export interface Message {
  id: number;
  orderId: number;
  text: string;
  fromCashier: boolean;
  createdAt: string;
  driverId?: number | null;
  readAt?: string | null;
}

export interface Assignment {
  assignment: { driverId: number; status: string; assignedAt: string };
  driver: Driver | null;
}

export interface TerminalEvent {
  id: string;
  type: 'order' | 'message' | 'cancellation' | 'system';
  title: string;
  body: string;
  orderId?: string;
  createdAt: string;
  read: boolean;
}

export interface OrderAction {
  orderId: string;
  kind: 'accepted' | 'rejected' | 'driver';
  detail: string;
  createdAt: string;
}
