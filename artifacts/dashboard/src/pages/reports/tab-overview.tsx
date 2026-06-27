import { RevenueAggregate } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DailyBreakdown } from "@workspace/api-client-react";
import { sarShort, sar } from "./utils";

interface LiveData {
  lastHour:            RevenueAggregate;
  last30min:           RevenueAggregate;
  uniqueCustomerCount: number;
  totalItemsSold:      number;
  totalDiscounts:      number;
}

interface Props {
  today:   RevenueAggregate | undefined;
  live:    LiveData | undefined;
  daily:   DailyBreakdown[];
  loading: boolean;
}

interface KpiProps {
  icon: string; label: string; value: string; sub: string;
  accent: string; bg: string; border: string;
}

function KpiCard({ icon, label, value, sub, accent, bg, border }: KpiProps) {
  return (
    <div className={`rounded-2xl border ${bg} ${border} p-5 space-y-3 hover:shadow-md transition-shadow print:p-3 print:rounded-lg`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl print:text-xl">{icon}</span>
        <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${accent} leading-none print:text-lg`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function TabOverview({ today, live, daily, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-muted/30 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const avgOrder = today && today.orderCount > 0 ? today.totalRevenue / today.orderCount : 0;

  const kpis: KpiProps[] = [
    {
      icon: "💰", label: "إجمالي مبيعات اليوم",
      value: today ? sarShort(today.totalRevenue) : "٠",
      sub: `صافي بعد الضريبة: ${today ? sarShort(today.netRevenue) : "٠"}`,
      accent: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",
    },
    {
      icon: "⏱️", label: "مبيعات آخر ساعة",
      value: live ? sarShort(live.lastHour.totalRevenue) : "٠",
      sub: `${live?.lastHour.orderCount ?? 0} فاتورة`,
      accent: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200",
    },
    {
      icon: "🔴", label: "مبيعات آخر 30 دقيقة",
      value: live ? sarShort(live.last30min.totalRevenue) : "٠",
      sub: `${live?.last30min.orderCount ?? 0} فاتورة`,
      accent: "text-red-700", bg: "bg-red-50", border: "border-red-200",
    },
    {
      icon: "🧾", label: "عدد الفواتير اليوم",
      value: String(today?.orderCount ?? 0),
      sub: `متوسط: ${sarShort(avgOrder)} / فاتورة`,
      accent: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200",
    },
    {
      icon: "📈", label: "صافي الإيرادات*",
      value: today ? sarShort(today.netRevenue) : "٠",
      sub: `ضريبة 15%: ${today ? sarShort(today.taxAmount) : "٠"}`,
      accent: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200",
    },
    {
      icon: "👥", label: "عدد العملاء",
      value: String(live?.uniqueCustomerCount ?? "—"),
      sub: "عملاء فريدون اليوم",
      accent: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200",
    },
    {
      icon: "📦", label: "عدد القطع المباعة",
      value: String(live?.totalItemsSold ?? "—"),
      sub: "قطعة من الأصناف",
      accent: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200",
    },
    {
      icon: "🎟️", label: "إجمالي الخصومات",
      value: live ? sarShort(live.totalDiscounts) : "٠",
      sub: today && today.cancelledCount > 0 ? `${today.cancelledCount} طلب ملغي` : "لا طلبات ملغاة",
      accent: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200",
    },
  ];

  // Payment breakdown
  const cashPct   = today ? (today.cashRevenue   / (today.totalRevenue || 1)) * 100 : 0;
  const onlinePct = today ? (today.onlineRevenue / (today.totalRevenue || 1)) * 100 : 0;
  const payPie = [
    { name: "نقدي",      value: today?.cashRevenue   ?? 0, color: "#0c48ab" },
    { name: "إلكتروني", value: today?.onlineRevenue ?? 0, color: "#E8920C" },
  ].filter(p => p.value > 0);

  // Hourly chart (last 14 days)
  const hasChartData = daily.some(d => d.total > 0);

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div>
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          بيانات حية · يتجدد كل 30 ثانية
          <span className="mr-2 text-amber-600">* صافي الإيرادات بعد خصم ضريبة القيمة المضافة 15% (لا يشمل التكاليف)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3">
          {kpis.map(k => <KpiCard key={k.label} {...k} />)}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Daily sales chart */}
        <div className="md:col-span-2 rounded-2xl border bg-card p-5 print:p-3">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <span>📈</span> المبيعات اليومية (آخر 30 يوم)
          </h3>
          {!hasChartData ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily} margin={{top:5, right:10, left:0, bottom:5}}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0c48ab" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0c48ab" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.07} />
                <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false}
                  tickFormatter={v => v > 999 ? (v/1000).toFixed(1)+"K" : v} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString("ar-SA")} ر.س`]}
                  contentStyle={{borderRadius:10, fontSize:11}} />
                <Area type="monotone" dataKey="total" stroke="#0c48ab" strokeWidth={2}
                  fill="url(#gTotal)" dot={false} name="المبيعات" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment pie */}
        <div className="rounded-2xl border bg-card p-5 print:p-3">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <span>💳</span> طرق الدفع
          </h3>
          {payPie.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <span className="text-3xl">💳</span>
              <p>لا توجد بيانات</p>
            </div>
          ) : (
            <div>
              <PieChart width={160} height={160}>
                <Pie data={payPie} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                  {payPie.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [sarShort(v)]} contentStyle={{borderRadius:10, fontSize:11}} />
              </PieChart>
              <div className="mt-3 space-y-2">
                {payPie.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{background: p.color}} />
                      <span>{p.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xs">{sarShort(p.value)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {i === 0 ? cashPct.toFixed(0) : onlinePct.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Not available notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden">
        <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <span>⚠️</span> بيانات غير متوفرة في قاعدة البيانات الحالية
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-amber-700">
          {[
            { icon: "💸", label: "إجمالي المصروفات", reason: "لا يوجد جدول expenses" },
            { icon: "📊", label: "صافي الربح الحقيقي", reason: "يتطلب تكلفة كل صنف (COGS)" },
            { icon: "👨‍💼", label: "أفضل الموظفين", reason: "لا يوجد employeeId في الطلبات" },
            { icon: "🏪", label: "المبيعات حسب الفرع", reason: "نظام فرع واحد (لا branch field)" },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <span>{item.icon}</span>
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="text-amber-600">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
