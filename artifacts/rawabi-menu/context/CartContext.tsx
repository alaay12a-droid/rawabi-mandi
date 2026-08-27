import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { MenuItem } from "@/constants/menu";

export interface CartCustomization {
  size?: string;
  riceType?: string;
  addon?: string;
  extraPrice?: number;
  selectedOptions?: { groupName: string; choice: string }[];
}

export interface CartItem {
  cartKey: string;
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

export function createCartKey(itemId: string, customization?: CartCustomization): string {
  const normalized = {
    size: customization?.size ?? "",
    riceType: customization?.riceType ?? "",
    addon: customization?.addon ?? "",
    selectedOptions: customization?.selectedOptions ?? [],
  };
  const hasCustomization =
    normalized.size !== "" ||
    normalized.riceType !== "" ||
    normalized.addon !== "" ||
    normalized.selectedOptions.length > 0;

  return hasCustomization ? `${itemId}::${JSON.stringify(normalized)}` : itemId;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: MenuItem, qty: number = 1, customization?: CartCustomization) => {
    setItems((prev) => {
      const cartKey = createCartKey(item.id, customization);
      const existing = prev.find((c) => c.cartKey === cartKey);
      if (existing) {
        return prev.map((c) =>
          c.cartKey === cartKey ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { cartKey, item, quantity: qty, customization }];
    });
  }, []);

  const removeItem = useCallback((cartKey: string) => {
    setItems((prev) => {
      const exactMatch = prev.some((c) => c.cartKey === cartKey);
      if (exactMatch) return prev.filter((c) => c.cartKey !== cartKey);

      const matchingItems = prev.filter((c) => c.item.id === cartKey);
      if (matchingItems.length === 1) {
        return prev.filter((c) => c.cartKey !== matchingItems[0].cartKey);
      }
      return prev;
    });
  }, []);

  const updateQuantity = useCallback((cartKey: string, quantity: number) => {
    setItems((prev) => {
      const exactMatch = prev.find((c) => c.cartKey === cartKey);
      const matchingItems = exactMatch ? [] : prev.filter((c) => c.item.id === cartKey);
      const targetKey = exactMatch?.cartKey ?? (matchingItems.length === 1 ? matchingItems[0].cartKey : null);
      if (!targetKey) return prev;

      if (quantity <= 0) return prev.filter((c) => c.cartKey !== targetKey);
      return prev.map((c) => (c.cartKey === targetKey ? { ...c, quantity } : c));
    });
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
