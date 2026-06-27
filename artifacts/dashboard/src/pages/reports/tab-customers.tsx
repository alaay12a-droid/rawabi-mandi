import { useState } from "react";
import { Order } from "@workspace/api-client-react";
import { sarShort, sar, filterToday } from "./utils";
import { downloadCSV } from "./export-utils";

interface CustomerStat {
  phone:       string;
  name:        string;
  orderCount:  number;
  totalSpent:  number;
  lastOrder:   string;
  avgOrder:    number;
}

function buildCustomerStats(orders: Order[]): CustomerStat[] {
  const map = new Map<string, CustomerStat>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const cur = map.get(o.customerPhone) ?? {
      phone: o.customerPhone, name: o.customerName,
      orderCount: 0, totalSpent: 0, lastOrder: o.createdAt, avgOrder: 0,
    };
    cur.orderCount++;
    cur.totalSpent += o.totalPrice / 100;
    if (new Date(o.createdAt) > new Date(cur.lastOrder)) cur.lastOrder = o.createdAt;
    if (!cur.name && o.customerName) cur.name = o.customerName;
    map.set(o.customerPhone, cur);
  }
  return Array.from(map.values())
    .map(c => ({ ...c, avgOrder: c.totalSpent / c.orderCount }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

// ── Top-customer discount reward ─────────────────────────────────────────────
function TopCustomerReward({ customer }: { customer: CustomerStat }) {
  const [open,    setOpen]    = useState(false);
  const [type,    setType]    = useState<"fixed"|"percentage">("fixed");
  const [value,   setValue]   = useState("20");
  const [minOrder,setMinOrder] = useState("100");
  const [maxUses, setMaxUses] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  function generateCode(): string {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `VIP-${suffix}`;
  }

  async function handleCreate() {
    setLoading(true); setError(null); setResult(null);
    const code = generateCode();
    try {
      const res = await fetch("/api/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          value:    parseInt(value)    || 0,
          minOrder: parseInt(minOrder) || 0,
          maxUses:  parseInt(maxUses)  || 1,
          description: `تحفيز لأفضل عميل — ${customer.phone}`,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "حدث خطأ"); }
      else         { setResult(data.code); }
    } catch { setError("تعذّر الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  function copyCode() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toWhatsAppPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("966")) return digits;
    if (digits.startsWith("0"))   return "966" + digits.slice(1);
    return "966" + digits;
  }

  function openWhatsApp() {
    if (!result) return;
    const phone = toWhatsAppPhone(customer.phone);
    const discountText = type === "fixed"
      ? `خصم ${value} ر.س على طلبك القادم (الحد الأدنى ${minOrder} ر.س)`
      : `خصم ${value}% على طلبك القادم (الحد الأدنى ${minOrder} ر.س)`;
    const msg = encodeURIComponent(
      `🎁 هدية من روابي المندي\n\n` +
      `عزيزنا العميل المميز، شكراً لك على ولائك! 🏆\n` +
      `إليك كود خصم خاص:\n\n` +
      `🎟️ *${result}*\n\n` +
      `${discountText}\n` +
      `يُستخدم مرة واحدة فقط.\n\n` +
      `روابي المندي للمذاق فن وأصول 🍖`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-yellow-50 p-5 print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-amber-400 flex items-center justify-center text-2xl shadow-sm">🏆</div>
          <div>
            <p className="font-bold text-sm text-amber-900">العميل الأكثر شراءً</p>
            <p className="text-xs text-amber-700 font-mono mt-0.5">{customer.phone}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-amber-800">
              <span>{customer.orderCount} طلب</span>
              <span>·</span>
              <span className="font-bold">{sar(customer.totalSpent)}</span>
            </div>
          </div>
        </div>
        {!result && (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            🎟️ {open ? "إلغاء" : "منح كود خصم"}
          </button>
        )}
      </div>

      {/* Form */}
      {open && !result && (
        <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Type */}
            <div>
              <label className="text-[11px] font-medium text-amber-800 block mb-1">نوع الخصم</label>
              <select value={type} onChange={e => setType(e.target.value as "fixed"|"percentage")}
                className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-amber-300">
                <option value="fixed">مبلغ ثابت (ر.س)</option>
                <option value="percentage">نسبة مئوية (%)</option>
              </select>
            </div>
            {/* Value */}
            <div>
              <label className="text-[11px] font-medium text-amber-800 block mb-1">
                {type === "fixed" ? "قيمة الخصم (ر.س)" : "نسبة الخصم (%)"}
              </label>
              <input type="number" min="1" value={value} onChange={e => setValue(e.target.value)}
                className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            {/* Min order */}
            <div>
              <label className="text-[11px] font-medium text-amber-800 block mb-1">الحد الأدنى للطلب (ر.س)</label>
              <input type="number" min="0" value={minOrder} onChange={e => setMinOrder(e.target.value)}
                className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            {/* Max uses */}
            <div>
              <label className="text-[11px] font-medium text-amber-800 block mb-1">عدد مرات الاستخدام</label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
                className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !value}
            className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm px-6 py-2.5 transition-colors"
          >
            {loading ? "جاري الإنشاء…" : "✨ إنشاء الكود"}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
          <p className="text-xs font-medium text-amber-800">✅ تم إنشاء كود الخصم بنجاح!</p>

          {/* Code display */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-white px-5 py-3">
              <span className="font-mono font-bold text-xl tracking-widest text-amber-700">{result}</span>
            </div>
            <button onClick={copyCode}
              className="rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-sm px-4 py-3 transition-colors">
              {copied ? "✅ تم النسخ!" : "📋 نسخ الكود"}
            </button>
          </div>

          <p className="text-[11px] text-amber-600">
            {type === "fixed" ? `خصم ${value} ر.س` : `خصم ${value}%`}
            {` · الحد الأدنى ${minOrder} ر.س · يُستخدم ${maxUses} مرة`}
          </p>

          {/* WhatsApp button */}
          <button
            onClick={openWhatsApp}
            className="flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm px-5 py-3 transition-colors shadow-sm w-full sm:w-auto justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.12 1.523 5.854L.057 23.25a.75.75 0 0 0 .916.919l5.516-1.453A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.52-5.163-1.427l-.37-.22-3.828 1.008 1.028-3.736-.242-.387A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            إرسال عبر واتساب لـ {customer.phone}
          </button>
          <p className="text-[10px] text-amber-500">
            سيفتح واتساب مع رسالة جاهزة تحتوي الكود — أرسلها بضغطة واحدة
          </p>
        </div>
      )}
    </div>
  );
}

interface Props { orders: Order[]; loading: boolean; }

export function TabCustomers({ orders, loading }: Props) {
  const allCustomers  = buildCustomerStats(orders);
  const todayOrders   = filterToday(orders);
  const todayCustomers = buildCustomerStats(todayOrders);

  const topAll    = allCustomers.slice(0, 20);
  const topToday  = todayCustomers.slice(0, 10);
  const returning = allCustomers.filter(c => c.orderCount > 1).length;
  const newCust   = allCustomers.filter(c => c.orderCount === 1).length;

  function exportCustomers() {
    downloadCSV(
      topAll.map((c, idx) => ({
        "الترتيب": idx + 1,
        "الجوال": maskPhone(c.phone),
        "عدد الطلبات": c.orderCount,
        "إجمالي الإنفاق (ر.س)": c.totalSpent.toFixed(2),
        "متوسط الطلب (ر.س)": c.avgOrder.toFixed(2),
      })),
      "أفضل_العملاء.csv",
      true,
    );
  }

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl border bg-muted/30 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "👥", label: "إجمالي العملاء", value: String(allCustomers.length), accent: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
          { icon: "🔄", label: "عملاء متكررون", value: String(returning), accent: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
          { icon: "🆕", label: "عملاء جدد", value: String(newCust), accent: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
          { icon: "📅", label: "عملاء اليوم", value: String(todayCustomers.length), accent: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border ${c.bg} ${c.border} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{c.icon}</span>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Top customer reward */}
      {allCustomers.length > 0 && (
        <TopCustomerReward customer={allCustomers[0]} />
      )}

      {/* Export */}
      <div className="flex justify-end print:hidden">
        <button onClick={exportCustomers}
          className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors font-medium">
          📊 تصدير Excel
        </button>
      </div>

      {/* Today's customers */}
      {topToday.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 print:p-3">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><span>📅</span> عملاء اليوم</h3>
          <CustomerTable customers={topToday} />
        </section>
      )}

      {/* All-time top customers */}
      <section className="rounded-2xl border bg-card p-5 print:p-3">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <span>🏆</span> أفضل 20 عميل (كل الوقت)
        </h3>
        {topAll.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm">لا توجد بيانات</p>
          </div>
        ) : (
          <CustomerTable customers={topAll} showRank />
        )}
      </section>

      {/* Privacy note */}
      <p className="text-[11px] text-muted-foreground text-center print:hidden">
        🔒 أرقام الجوال مُخفية جزئياً للخصوصية
      </p>
    </div>
  );
}

function CustomerTable({ customers, showRank }: { customers: CustomerStat[]; showRank?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-[10px]">
        <thead>
          <tr className="border-b bg-muted/30">
            {showRank && <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">#</th>}
            {["الجوال","الطلبات","إجمالي الإنفاق","متوسط الطلب","آخر طلب"].map(h => (
              <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c, idx) => (
            <tr key={c.phone} className="border-b last:border-0 hover:bg-muted/20">
              {showRank && (
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-gray-300 text-gray-700" : idx === 2 ? "bg-orange-300 text-white" : "bg-muted text-muted-foreground"
                  }`}>{idx+1}</span>
                </td>
              )}
              <td className="py-2.5 px-3 font-mono text-xs">{maskPhone(c.phone)}</td>
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-1">
                  <span className="font-bold text-primary">{c.orderCount}</span>
                  {c.orderCount > 3 && <span className="text-[10px] text-emerald-600 font-semibold">متكرر</span>}
                </span>
              </td>
              <td className="py-2.5 px-3 font-bold text-emerald-700">{sar(c.totalSpent)}</td>
              <td className="py-2.5 px-3 text-xs text-muted-foreground">{sarShort(c.avgOrder)}</td>
              <td className="py-2.5 px-3 text-xs text-muted-foreground">
                {new Date(c.lastOrder).toLocaleDateString("ar-SA", {timeZone:"Asia/Riyadh", month:"short", day:"numeric"})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
