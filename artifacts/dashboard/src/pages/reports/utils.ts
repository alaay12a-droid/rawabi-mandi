import { Order } from "@workspace/api-client-react";

/** Saudi Arabia = UTC+3. Returns [todayStart, todayEnd) in UTC */
export function getTodayRange(): { start: Date; end: Date } {
  const offsetMs = 3 * 60 * 60 * 1000;
  const nowLocal = new Date(Date.now() + offsetMs);
  const start = new Date(
    Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - offsetMs
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function filterToday(orders: Order[]): Order[] {
  const { start, end } = getTodayRange();
  return orders.filter(o => {
    const d = new Date(o.createdAt);
    return d >= start && d < end;
  });
}

export interface ItemStat {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

/** Aggregate items from a list of orders (skips cancelled) */
export function aggregateItems(orders: Order[]): ItemStat[] {
  const map = new Map<string, ItemStat>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      const cur = map.get(item.id) ?? { id: item.id, name: item.name, qty: 0, unitPrice: item.price, total: 0 };
      cur.qty    += item.quantity;
      cur.total  += item.price * item.quantity;
      map.set(item.id, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
}

export function sar(v: number): string {
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

export function sarShort(v: number): string {
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

export const STATUS_AR: Record<string, string> = {
  done: "مكتمل", pending: "قيد الانتظار", preparing: "يُحضَّر", ready: "جاهز", cancelled: "ملغي",
};
export const STATUS_COLOR: Record<string, string> = {
  done: "text-emerald-700 bg-emerald-50 border-emerald-200",
  pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
  preparing: "text-blue-700 bg-blue-50 border-blue-200",
  ready: "text-green-700 bg-green-50 border-green-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
};
