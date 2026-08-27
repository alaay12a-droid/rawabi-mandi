import type { MenuItem } from "@/constants/menu";

type AvailableMenuItem = MenuItem & { available?: boolean };

export interface ExplicitChickenSizeOption {
  label: "نصف" | "حبة كاملة";
  icon: "½" | "1";
  item: AvailableMenuItem;
}

interface ChickenSizeGroup {
  halfId: string;
  wholeId: string;
}

// These products are separate database rows with independently editable prices.
// Keep the relationship explicit: never infer a sibling or derive its price.
const CHICKEN_SIZE_GROUPS: readonly ChickenSizeGroup[] = [
  { halfId: "c2", wholeId: "c1" },
  { halfId: "ma2", wholeId: "ma1" },
  { halfId: "ma4", wholeId: "ma3" },
  { halfId: "c5", wholeId: "c6" },
  { halfId: "c7", wholeId: "c8" },
];

export function isExplicitChickenSizeProduct(itemId: string): boolean {
  return CHICKEN_SIZE_GROUPS.some(
    (group) => group.halfId === itemId || group.wholeId === itemId,
  );
}

export function getExplicitChickenSizeOptions(
  itemId: string,
  menuItems: readonly AvailableMenuItem[],
): ExplicitChickenSizeOption[] {
  const group = CHICKEN_SIZE_GROUPS.find(
    (candidate) => candidate.halfId === itemId || candidate.wholeId === itemId,
  );
  if (!group) return [];

  const half = menuItems.find((candidate) => candidate.id === group.halfId);
  const whole = menuItems.find((candidate) => candidate.id === group.wholeId);

  // Never invent a missing option, and never expose an unavailable sibling.
  if (!half || !whole || half.available === false || whole.available === false) {
    return [];
  }

  return [
    { label: "نصف", icon: "½", item: half },
    { label: "حبة كاملة", icon: "1", item: whole },
  ];
}