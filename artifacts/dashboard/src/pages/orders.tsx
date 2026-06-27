import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatEasternNumber, formatDateTime } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { OrderDrawer } from "@/components/order-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Search, Bell, Phone, MapPin, Printer, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStatus = "pending" | "preparing" | "ready" | "done" | "cancelled";

interface OrderItem { id: string; name: string; price: number; quantity: number; }
interface Order {
  id: number; dailyNumber: number | null; customerName: string; customerPhone: string;
  customerAddress: string | null; items: OrderItem[]; totalPrice: number; deliveryFee: number;
  discountCode: string | null; discountAmount: number | null; status: OrderStatus;
  paymentMethod: string; notes: string | null; createdAt: string;
}

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; tab: string }> = {
  pending:   { label: "جديد",         color: "text-red-600",    bg: "bg-red-500/10 border-red-500/20",    tab: "bg-red-500" },
  preparing: { label: "يُحضَّر",       color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", tab: "bg-orange-500" },
  ready:     { label: "جاهز",         color: "text-green-600",  bg: "bg-green-500/10 border-green-500/20", tab: "bg-green-500" },
  done:      { label: "مكتمل",        color: "text-gray-500",   bg: "bg-gray-500/10 border-gray-500/20",  tab: "bg-gray-400" },
  cancelled: { label: "ملغي",         color: "text-zinc-400",   bg: "bg-zinc-500/10 border-zinc-500/20",  tab: "bg-zinc-400" },
};

type FilterKey = OrderStatus | "active" | "all";

export default function Orders() {
  const queryClient = useQueryClient();
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetching, setFetching]       = useState(false);
  const [filter, setFilter]           = useState<FilterKey>("active");
  const [search, setSearch]           = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const knownIds                       = useRef<Set<number>>(new Set());
  const pollRef                        = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirst                        = useRef(true);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setFetching(true);
    try {
      const data = await apiGet<Order[]>("/orders");
      if (!isFirst.current) {
        const newPending = data.filter(o => o.status === "pending" && !knownIds.current.has(o.id));
        if (newPending.length > 0) {
          setHasNewOrder(true);
          setTimeout(() => setHasNewOrder(false), 5000);
          document.title = `(${data.filter(o => o.status === "pending").length}) طلب جديد 🔔 | الطلبات`;
        }
      } else {
        const pendingCount = data.filter(o => o.status === "pending").length;
        if (pendingCount > 0) document.title = `(${pendingCount}) طلب جديد 🔔 | الطلبات`;
      }
      data.forEach(o => knownIds.current.add(o.id));
      isFirst.current = false;
      setOrders(data);
      queryClient.setQueryData(getListOrdersQueryKey(), data);
    } catch { /* silent */ }
    finally { setLoading(false); setFetching(false); }
  }, [queryClient]);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(() => fetchOrders(true), 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.title = "روابي المندي";
    };
  }, [fetchOrders]);

  const counts = {
    pending:   orders.filter(o => o.status === "pending").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    ready:     orders.filter(o => o.status === "ready").length,
    done:      orders.filter(o => o.status === "done").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
    active:    orders.filter(o => !["done","cancelled"].includes(o.status)).length,
    all:       orders.length,
  };

  const filtered = orders.filter(o => {
    const matchFilter =
      filter === "all"    ? true :
      filter === "active" ? !["done","cancelled"].includes(o.status) :
      o.status === filter;
    if (!matchFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(o.dailyNumber ?? "").includes(q) ||
      (o.customerName ?? "").toLowerCase().includes(q) ||
      (o.customerPhone ?? "").includes(q)
    );
  });

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "active",    label: "النشطة",    count: counts.active },
    { key: "pending",   label: "جديد",       count: counts.pending },
    { key: "preparing", label: "يُحضَّر",    count: counts.preparing },
    { key: "ready",     label: "جاهز",       count: counts.ready },
    { key: "done",      label: "مكتمل",      count: counts.done },
    { key: "cancelled", label: "ملغي",       count: counts.cancelled },
    { key: "all",       label: "الكل",       count: counts.all },
  ];

  const handleOrderUpdated = useCallback((updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelectedOrder(updated);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              إدارة الطلبات
              {counts.pending > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold px-2 py-0.5 min-w-[22px] animate-pulse">
                  {counts.pending}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              تحديث تلقائي كل ١٠ ثوانٍ
              <span className={cn("inline-block w-2 h-2 rounded-full mr-2 align-middle", fetching ? "bg-yellow-400 animate-ping" : "bg-green-500")} />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasNewOrder && (
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full animate-bounce">
              <Bell className="w-4 h-4" />
              طلب جديد وصل!
            </div>
          )}
          <Button variant="outline" size="icon" onClick={() => fetchOrders()} disabled={fetching}>
            <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث باسم العميل، رقم الجوال، أو رقم الطلب..."
          className="pr-9 bg-card"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
              filter === tab.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center rounded-full text-xs font-bold px-1.5 min-w-[18px] h-[18px]",
                filter === tab.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : tab.key === "pending" ? "bg-red-100 text-red-700"
                  : tab.key === "preparing" ? "bg-orange-100 text-orange-700"
                  : tab.key === "ready" ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold text-base">لا توجد طلبات</p>
            <p className="text-sm mt-1">{search ? "جرّب البحث بكلمة أخرى" : "لا توجد طلبات في هذه الفئة"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground w-16">#</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">العميل</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground hidden md:table-cell">الأصناف</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground hidden lg:table-cell">الدفع</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الإجمالي</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground hidden md:table-cell">الوقت</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground w-20">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, idx) => {
                  const meta = STATUS_META[order.status];
                  const isActive = !["done","cancelled"].includes(order.status);
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b border-border/50 cursor-pointer transition-colors",
                        isActive ? "hover:bg-primary/5" : "hover:bg-muted/30 opacity-70",
                        idx % 2 === 0 ? "" : "bg-muted/20"
                      )}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-base text-primary">
                          #{formatEasternNumber(order.dailyNumber ?? order.id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold leading-tight">{order.customerName || "عميل"}</div>
                        {order.customerPhone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5" dir="ltr">
                            <Phone className="w-3 h-3" />
                            {order.customerPhone}
                          </div>
                        )}
                        {order.customerAddress && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{order.customerAddress}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="max-w-[200px] space-y-0.5">
                          {order.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="text-xs text-muted-foreground truncate">
                              {formatEasternNumber(item.quantity)}× {item.name}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-xs text-primary font-medium">
                              +{formatEasternNumber(order.items.length - 2)} أصناف أخرى
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          order.paymentMethod === "cash"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {order.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-primary text-sm">
                          {formatCurrency(order.totalPrice)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs font-semibold whitespace-nowrap", meta.bg, meta.color)}>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-xs hover:bg-primary hover:text-primary-foreground"
                          onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}
                        >
                          فتح
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        يعرض {formatEasternNumber(filtered.length)} طلب
        {filter !== "all" && ` من إجمالي ${formatEasternNumber(counts.all)}`}
      </p>

      <OrderDrawer
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={open => !open && setSelectedOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
