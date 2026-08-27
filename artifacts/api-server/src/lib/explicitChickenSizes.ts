const EXPLICIT_CHICKEN_SIZE_BY_ITEM_ID: Readonly<Record<string, "نصف" | "حبة كاملة">> = {
  c2: "نصف",
  c1: "حبة كاملة",
  ma2: "نصف",
  ma1: "حبة كاملة",
  ma4: "نصف",
  ma3: "حبة كاملة",
  c5: "نصف",
  c6: "حبة كاملة",
  c7: "نصف",
  c8: "حبة كاملة",
};

interface ExplicitChickenSizeSelection {
  itemId: string;
  priceInHalalas: number;
  size?: string;
  variantId?: string;
  variantPrice?: number;
}

export function isValidExplicitChickenSizeSelection({
  itemId,
  priceInHalalas,
  size,
  variantId,
  variantPrice,
}: ExplicitChickenSizeSelection): boolean {
  const expectedSize = EXPLICIT_CHICKEN_SIZE_BY_ITEM_ID[itemId];
  const configuredBasePrice = priceInHalalas / 100;

  return (
    expectedSize === size &&
    variantId === itemId &&
    variantPrice != null &&
    Math.abs(variantPrice - configuredBasePrice) <= 0.001
  );
}