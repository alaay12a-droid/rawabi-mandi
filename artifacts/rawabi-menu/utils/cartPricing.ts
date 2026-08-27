export interface CartPricingCustomization {
  size?: string;
  riceType?: string;
  addon?: string;
  extraPrice?: number;
  variantId?: string;
  unitPrice?: number;
  selectedOptions?: { groupName: string; choice: string }[];
}

export function createCartKey(
  itemId: string,
  customization?: CartPricingCustomization,
): string {
  const normalized = {
    variantId: customization?.variantId ?? "",
    size: customization?.size ?? "",
    riceType: customization?.riceType ?? "",
    addon: customization?.addon ?? "",
    selectedOptions: customization?.selectedOptions ?? [],
  };
  const hasCustomization =
    normalized.variantId !== "" ||
    normalized.size !== "" ||
    normalized.riceType !== "" ||
    normalized.addon !== "" ||
    normalized.selectedOptions.length > 0;

  return hasCustomization ? `${itemId}::${JSON.stringify(normalized)}` : itemId;
}

export function getCartUnitPrice(
  item: { price: number },
  customization?: CartPricingCustomization,
  storedUnitPrice?: number,
): number {
  if (Number.isFinite(storedUnitPrice)) return storedUnitPrice as number;
  if (Number.isFinite(customization?.unitPrice)) return customization!.unitPrice as number;
  return item.price + (customization?.extraPrice ?? 0);
}

export interface PricedCartLine<
  TItem extends { id: string; price: number },
  TCustomization extends CartPricingCustomization,
> {
  cartKey: string;
  item: TItem;
  quantity: number;
  unitPrice: number;
  customization?: TCustomization;
}

export function addOrMergeCartLine<
  TItem extends { id: string; price: number },
  TCustomization extends CartPricingCustomization,
>(
  lines: PricedCartLine<TItem, TCustomization>[],
  item: TItem,
  quantity: number,
  customization?: TCustomization,
  unitPrice?: number,
): PricedCartLine<TItem, TCustomization>[] {
  const cartKey = createCartKey(item.id, customization);
  const resolvedUnitPrice = getCartUnitPrice(item, customization, unitPrice);
  const existing = lines.some((line) => line.cartKey === cartKey);

  if (!existing) {
    return [...lines, { cartKey, item, quantity, unitPrice: resolvedUnitPrice, customization }];
  }

  return lines.map((line) =>
    line.cartKey === cartKey
      ? {
          ...line,
          item,
          customization,
          unitPrice: resolvedUnitPrice,
          quantity: line.quantity + quantity,
        }
      : line,
  );
}