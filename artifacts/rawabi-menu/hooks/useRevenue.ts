import { useState, useCallback } from "react";
import { apiGet } from "@/constants/api";

export interface RevenuePeriod {
  totalRevenue:    number;
  deliveryRevenue: number;
  itemsRevenue:    number;
  orderCount:      number;
  taxAmount:       number;
  netRevenue:      number;
  cancelledCount:  number;
  cancelledValue:  number;
  pendingCount:    number;
  cashCount:       number;
  onlineCount:     number;
  cashRevenue:     number;
  onlineRevenue:   number;
}

export interface BreakdownPoint {
  total:          number;
  delivery:       number;
  items:          number;
  orders:         number;
  tax:            number;
  net:            number;
  cancelledCount: number;
  cancelledValue: number;
  cashCount:      number;
  onlineCount:    number;
}

export interface DailyPoint extends BreakdownPoint { date:  string; }
export interface MonthlyPoint extends BreakdownPoint { month: string; }

export interface TopItem {
  id:      string;
  name:    string;
  qty:     number;
  revenue: number;
}

export interface RevenueData {
  today:            RevenuePeriod;
  week:             RevenuePeriod;
  month:            RevenuePeriod;
  year:             RevenuePeriod;
  dailyBreakdown:   DailyPoint[];
  monthlyBreakdown: MonthlyPoint[];
  topItems:         TopItem[];
}

export function useRevenue() {
  const [data, setData]       = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiGet<RevenueData>("/revenue");
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}
