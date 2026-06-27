import { useGetRevenue, useListOrders, getGetRevenueQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatEasternNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ListOrdered, Users, UtensilsCrossed, BarChart2, ChevronLeft, ShoppingBag, Banknote, TrendingUp } from "lucide-react";

export default function Home() {
  const { data: revenue, isLoading: isRevenueLoading } = useGetRevenue({
    query: { queryKey: getGetRevenueQueryKey() }
  });
  const ordersParams = { limit: 5, status: "pending" as const };
  const { data: pendingOrders, isLoading: isOrdersLoading } = useListOrders(
    ordersParams,
    { query: { refetchInterval: 15000, queryKey: getListOrdersQueryKey(ordersParams) } }
  );

  const today = revenue?.today;
  const pendingCount = pendingOrders?.length ?? 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", {
    timeZone: "Asia/Riyadh", weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── KPI quick stats ───────────────────────────────────────────────────────
  const kpis = [
    {
      icon: Banknote,
      label: "مبيعات اليوم",
      value: isRevenueLoading
        ? null
        : formatEasternNumber(formatCurrency((today?.totalRevenue ?? 0) * 100)),
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
    },
    {
      icon: ShoppingBag,
      label: "طلبات اليوم",
      value: isRevenueLoading ? null : formatEasternNumber(today?.orderCount ?? 0),
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
    },
    {
      icon: TrendingUp,
      label: "متوسط الطلب",
      value: isRevenueLoading
        ? null
        : today && today.orderCount > 0
          ? formatEasternNumber(formatCurrency((today.totalRevenue / today.orderCount) * 100))
          : "—",
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-100",
    },
  ];

  // ── Navigation cards ──────────────────────────────────────────────────────
  const navCards = [
    {
      href: "/orders",
      icon: ListOrdered,
      title: "الطلبات",
      desc: "عرض وإدارة طلبات العملاء وتتبع حالتها",
      accent: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      iconBg: "bg-blue-500",
      badge: isOrdersLoading ? null : pendingCount > 0 ? `${pendingCount} في الانتظار` : null,
      badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
    },
    {
      href: "/drivers",
      icon: Users,
      title: "المناديب",
      desc: "إدارة فريق التوصيل ومتابعة أدائهم",
      accent: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
      iconBg: "bg-emerald-500",
      badge: null,
      badgeColor: "",
    },
    {
      href: "/menu",
      icon: UtensilsCrossed,
      title: "القائمة",
      desc: "إضافة وتعديل الأصناف وإدارة التوفر",
      accent: "from-amber-500 to-orange-500",
      bg: "bg-amber-50 hover:bg-amber-100 border-amber-200",
      iconBg: "bg-amber-500",
      badge: null,
      badgeColor: "",
    },
    {
      href: "/reports",
      icon: BarChart2,
      title: "تقارير المبيعات",
      desc: "تحليل الإيرادات والعملاء وطباعة الفواتير",
      accent: "from-violet-500 to-purple-600",
      bg: "bg-violet-50 hover:bg-violet-100 border-violet-200",
      iconBg: "bg-violet-500",
      badge: null,
      badgeColor: "",
    },
  ];

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">مرحباً 👋</h1>
        <p className="text-muted-foreground text-sm">{dateStr}</p>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-2xl border ${kpi.bg} p-4 flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            {kpi.value === null ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Navigation cards ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          الأقسام الرئيسية
          <span className="h-px flex-1 bg-border" />
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {navCards.map(card => (
            <Link key={card.href} href={card.href}>
              <div className={`group rounded-2xl border ${card.bg} p-5 cursor-pointer transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md flex flex-col gap-4 h-full`}>
                {/* Icon + badge row */}
                <div className="flex items-start justify-between">
                  <div className={`h-12 w-12 rounded-2xl ${card.iconBg} flex items-center justify-center shadow-sm`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {card.badge && (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    )}
                    <ChevronLeft className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
                  </div>
                </div>
                {/* Text */}
                <div>
                  <p className="font-bold text-base text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
