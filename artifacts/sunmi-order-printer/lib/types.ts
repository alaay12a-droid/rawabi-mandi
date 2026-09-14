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
}

export interface DashboardUser {
  id: number;
  username: string;
  role: string;
  branchIds?: number[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stock: number | null;
}

export interface BranchHours {
  isOpen: boolean;
  openingTime: string; // HH:mm
  closingTime: string; // HH:mm
}

export interface Settings {
  soundEnabled: boolean;
  autoAssignDrivers: boolean;
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
