import { Order } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { aggregateItems, filterToday, sarShort, sar } from "./utils";
import { downloadCSV } from "./export-utils";

interface Props { orders: Order[]; loading: boolean; }

export function TabProducts({ orders, loading }: Props) {
  const allDoneOrders = orders.filter(o => o.status === "done");
  const todayOrders   = filterToday(orders);
  const todayItems    = aggregateItems(todayOrders);
  const allTimeItems  = aggregateItems(allDoneOrders);

  const top10   = allTimeItems.slice(0, 10);
  const worst10 = [...allTimeItems].sort((a, b) => a.qty - b.qty).slice(0, 10);
  const totalRev = allTimeItems.reduce((a, i) => a + i.total, 0);

  function exportProducts() {
    downloadCSV(
      allTimeItems.map((item, idx) => ({
        "الترتيب": idx + 1,
        "اسم الصنف": item.name,
        "الكمية المباعة": item.qty,
        "إجمالي الإيرادات (ر.س)": item.total,
        "سعر الوحدة (ر.س)": item.unitPrice,
      })),
      "أصناف_المبيعات.csv",
      true,
    );
  }

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl border bg-muted/30 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Export */}
      <div className="flex justify-end gap-2 print:hidden">
        <button onClick={exportProducts}
          className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors font-medium">
          📊 تصدير Excel
        </button>
      </div>

      {/* Today's items */}
      {todayItems.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 print:p-3">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <span>📅</span> أصناف اليوم
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm print:text-[10px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["#","الصنف","الكمية","الإجمالي"].map(h => (
                    <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayItems.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-2 px-3 text-muted-foreground text-xs">{idx+1}</td>
                    <td className="py-2 px-3 font-medium">{item.name}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center justify-center h-5 min-w-[22px] rounded-full bg-amber-100 text-amber-800 font-bold text-xs">{item.qty}</span>
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-700">{sar(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Top 10 - chart + table */}
      <section className="rounded-2xl border bg-card p-5 print:p-3">
        <h3 className="font-bold text-sm mb-5 flex items-center gap-2">
          <span>🏆</span> أكثر 10 أصناف مبيعاً (كل الوقت)
        </h3>
        {top10.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <span className="text-4xl">📭</span>
            <p className="text-sm">لا توجد بيانات مبيعات</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top10} layout="vertical" margin={{right:12, left:0}}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} horizontal={false} />
                <XAxis type="number" tick={{fontSize:10}} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{fontSize:10}} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number, name: string) => [v, name === "qty" ? "قطعة" : "ر.س"]}
                  contentStyle={{borderRadius:10, fontSize:11}} />
                <Bar dataKey="qty" name="qty" radius={[0,6,6,0]} maxBarSize={20}>
                  {top10.map((_, i) => <Cell key={i} fill={`hsl(${220+i*7},70%,${56-i*2}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["#","الصنف","الكمية","الإيرادات","النسبة"].map(h => (
                      <th key={h} className="py-2 px-2 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top10.map((item, idx) => {
                    const pct = totalRev > 0 ? (item.total/totalRev*100).toFixed(1) : "0";
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 px-2 font-bold text-primary text-xs">#{idx+1}</td>
                        <td className="py-2 px-2 font-medium text-xs max-w-[110px] truncate">{item.name}</td>
                        <td className="py-2 px-2 font-bold text-amber-700 text-xs">{item.qty}</td>
                        <td className="py-2 px-2 font-bold text-emerald-700 text-xs">{sarShort(item.total)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Worst 10 */}
      <section className="rounded-2xl border bg-card p-5 print:p-3">
        <h3 className="font-bold text-sm mb-5 flex items-center gap-2">
          <span>📉</span> أقل 10 أصناف مبيعاً (كل الوقت)
        </h3>
        {worst10.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <p className="text-sm">لا توجد بيانات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["#","الصنف","الكمية","الإيرادات","ملاحظة"].map(h => (
                    <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {worst10.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-2 px-3 text-muted-foreground text-xs">{idx+1}</td>
                    <td className="py-2 px-3 font-medium">{item.name}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center justify-center h-5 min-w-[22px] rounded-full font-bold text-xs ${item.qty === 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                        {item.qty}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm">{sar(item.total)}</td>
                    <td className="py-2 px-3">
                      {item.qty === 0 && (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">لم يُباع</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
