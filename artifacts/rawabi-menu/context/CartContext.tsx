import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { MenuItem } from "@/constants/menu";

export interface CartCustomization {
  size?: string;
  riceType?: string;
  addon?: string;
  extraPrice?: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  customization?: CartCustomization;
}

interface CartActions {
  addItem: (item: MenuItem, qty?: number, customization?: CartCustomization) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

const CartActionsContext = createContext<CartActions | undefined>(undefined);
const CartStateContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: MenuItem, qty: number = 1, customization?: CartCustomization) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { item, quantity: qty, customization }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((c) => c.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((c) => c.item.id !== itemId));
    } else {
      setItems((prev) =>
        prev.map((c) => (c.item.id === itemId ? { ...c, quantity } : c))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const actions = useMemo<CartActions>(
    () => ({ addItem, removeItem, updateQuantity, clearCart }),
    [addItem, removeItem, updateQuantity, clearCart]
  );

  const totalItems = useMemo(() => items.reduce((s, c) => s + c.quantity, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((s, c) => s + (c.item.price + (c.customization?.extraPrice ?? 0)) * c.quantity, 0),
    [items]
  );

  const state = useMemo<CartState>(
    () => ({ items, totalItems, totalPrice }),
    [items, totalItems, totalPrice]
  );

  return (
    <CartActionsContext.Provider value={actions}>
      <CartStateContext.Provider value={state}>
        {children}
      </CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error("useCartActions must be used within CartProvider");
  return ctx;
}

export function useCartState(): CartState {
  const ctx = useContext(CartStateContext);
  if (!ctx) throw new Error("useCartState must be used within CartProvider");
  return ctx;
}

export function useCart(): CartActions & CartState {
  return { ...useCartActions(), ...useCartState() };
}
