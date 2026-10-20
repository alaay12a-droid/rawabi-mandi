interface DiscountVisibilityInput {
  code: string;
  description?: string | null;
}

// VIP- is reserved by the top-customer reward generator. Match the legacy
// description too, so existing rewards stay private if their code was renamed.
export function isPrivateDiscountCode(discount: DiscountVisibilityInput): boolean {
  return /^VIP-/i.test(discount.code.trim())
    || /^تحفيز\s+لأفضل\s+عميل/.test(discount.description?.trim() ?? "");
}

export function visibleDiscountCodes<T extends DiscountVisibilityInput>(
  codes: T[],
  isStaff: boolean,
): T[] {
  return isStaff ? codes : codes.filter((code) => !isPrivateDiscountCode(code));
}
