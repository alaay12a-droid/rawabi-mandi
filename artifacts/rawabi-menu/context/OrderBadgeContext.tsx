import React, { createContext, useContext, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ORDERS_STORAGE_KEY = "@rawabi_my_orders";

interface OrderBadgeContextType {
  activeCount: number;
  refreshBadge: () => Promise<void>;
  incrementBadge: () => void;
}

const OrderBadgeContext = createContext<OrderBadgeContextType>({
  activeCount: 0,
  refreshBadge: async () => {},
  incrementBadge: () => {},
});

export function OrderBadgeProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);

  const refreshBadge = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
      const stored: { id: number }[] = raw ? JSON.parse(raw) : [];
      setActiveCount(stored.length);
    } catch {}
  }, []);

  const incrementBadge = useCallback(() => {
    setActiveCount((prev) => prev + 1);
  }, []);

  return (
    <OrderBadgeContext.Provider value={{ activeCount, refreshBadge, incrementBadge }}>
      {children}
    </OrderBadgeContext.Provider>
  );
}

export function useOrderBadge() {
  return useContext(OrderBadgeContext);
}
