import { CartCustomization } from "@/context/CartContext";

const MEAT_SIZES = ["ربع", "نصف", "كامل"];

/**
 * Returns a display-friendly name for a cart item, updating the size
 * embedded in the name to match what the customer actually chose.
 *
 * Meat items  — identified by " - " separator in name:
 *   "حنيذ بلدي - كامل"  + نصف  →  "حنيذ بلدي - نصف"
 *
 * Chicken items — two flavours:
 *   1. Mid-name "حبة كاملة" / "نص حبة"  (مندي, مضغوط, مدفون)
 *      "مندي دجاج حبة كاملة مع الرز"  + نصف  →  "مندي دجاج نص حبة مع الرز"
 *      "مندي دجاج نص حبة مع الرز"     + حبة كاملة → "مندي دجاج حبة كاملة مع الرز"
 *   2. Prefix "نص حبة" / bare "حبة"  (على الفحم)
 *      "حبة على الفحم مع الرز"          + نصف  →  "نص حبة على الفحم مع الرز"
 *      "نص حبة على الفحم مع الرز"      + حبة كاملة → "حبة على الفحم مع الرز"
 */
export function resolveCartItemName(
  baseName: string,
  customization?: CartCustomization
): string {
  const size = customization?.size;
  if (!size) return baseName;

  // ── Meat: name contains " - " size suffix ──
  if (MEAT_SIZES.includes(size) && baseName.includes(" - ")) {
    const dashIdx = baseName.lastIndexOf(" - ");
    return baseName.slice(0, dashIdx) + " - " + size;
  }

  // ── Chicken: size = نصف ──
  if (size === "نصف") {
    // "X حبة كاملة Y"  →  "X نص حبة Y"
    if (baseName.includes("حبة كاملة")) return baseName.replace("حبة كاملة", "نص حبة");
    // "حبة على الفحم ..."  →  "نص حبة على الفحم ..."
    if (baseName.startsWith("حبة ")) return "نص " + baseName;
    return baseName; // already نص
  }

  // ── Chicken: size = حبة كاملة ──
  if (size === "حبة كاملة") {
    // "X نص حبة مع Y"  →  "X حبة كاملة مع Y"
    if (baseName.includes("نص حبة مع")) return baseName.replace("نص حبة", "حبة كاملة");
    // "نص حبة على الفحم ..."  →  "حبة على الفحم ..."  (drop the "نص " prefix)
    if (baseName.startsWith("نص حبة ")) return baseName.slice("نص ".length);
    return baseName; // already كاملة or not نص
  }

  return baseName;
}

/**
 * Returns customization parts for the subtitle / order notes,
 * omitting the size when it has already been embedded in the name.
 */
export function resolveCustomizationParts(
  customization?: CartCustomization
): string[] {
  const parts: string[] = [];
  const size = customization?.size;

  // Size is always embedded in the display name — never repeat it in subtitle
  const sizeInName =
    size === "نصف" ||
    size === "حبة كاملة" ||
    (size !== undefined && MEAT_SIZES.includes(size));

  if (size && !sizeInName) parts.push(size);
  if (customization?.riceType) parts.push(customization.riceType);
  if (customization?.addon) parts.push(customization.addon);
  return parts;
}
