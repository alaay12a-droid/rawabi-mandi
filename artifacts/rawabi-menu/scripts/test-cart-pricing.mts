import assert from "node:assert/strict";
import { addOrMergeCartLine, createCartKey, getCartUnitPrice } from "../utils/cartPricing.ts";
import { getExplicitChickenSizeOptions } from "../utils/chickenSizeVariants.ts";
import { resolveCartItemName, resolveCustomizationParts } from "../utils/cartItemName.ts";

const chicken = { price: 46 };
const half = {
  size: "نصف",
  variantId: "chicken:size:نصف",
  unitPrice: 23,
};
const whole = {
  size: "حبة كاملة",
  variantId: "chicken:size:حبة كاملة",
  unitPrice: 46,
};

assert.equal(getCartUnitPrice(chicken, half, 23), 23);
assert.equal(getCartUnitPrice(chicken, whole, 46), 46);
assert.notEqual(createCartKey("chicken", half), createCartKey("chicken", whole));
assert.equal(getCartUnitPrice(chicken, { extraPrice: -23 }), 23);

const halfLine = addOrMergeCartLine([], { id: "chicken", price: 46 }, 1, half, 23);
const separateVariants = addOrMergeCartLine(
  halfLine,
  { id: "chicken", price: 46 },
  1,
  whole,
  46,
);
assert.equal(separateVariants.length, 2);
assert.deepEqual(separateVariants.map((line) => line.unitPrice), [23, 46]);

for (const [name, price] of [
  ["ربع", 350],
  ["نصف", 700],
  ["كامل", 1400],
] as const) {
  const selection = {
    size: name,
    variantId: `goat:size:${name}`,
    unitPrice: price,
  };
  assert.equal(getCartUnitPrice({ price: 1400 }, selection, price), price);
}

const oldPriceSelection = {
  size: "نصف",
  variantId: "chicken:size:نصف",
  unitPrice: 22,
};
assert.equal(
  getCartUnitPrice(chicken, { ...oldPriceSelection, unitPrice: 23 }, 23),
  23,
  "merging the same variant must use its latest price snapshot",
);

const refreshedHalf = addOrMergeCartLine(
  halfLine,
  { id: "chicken", price: 46 },
  1,
  { ...half, unitPrice: 24 },
  24,
);
assert.equal(refreshedHalf.length, 1);
assert.equal(refreshedHalf[0].quantity, 2);
assert.equal(refreshedHalf[0].unitPrice, 24);

const configuredChickenRows = [
  { id: "c5", name: "نص حبة على الفحم مع الرز", price: 23, category: "chicken", available: true },
  { id: "c6", name: "حبة على الفحم مع الرز", price: 46, category: "chicken", available: true },
];
const explicitSizes = getExplicitChickenSizeOptions("c6", configuredChickenRows);
assert.deepEqual(
  explicitSizes.map((option) => ({
    label: option.label,
    icon: option.icon,
    itemId: option.item.id,
    price: option.item.price,
  })),
  [
    { label: "نصف", icon: "½", itemId: "c5", price: 23 },
    { label: "حبة كاملة", icon: "1", itemId: "c6", price: 46 },
  ],
  "linked size prices must come from the corresponding configured product rows",
);

const selectedHalf = {
  size: "نصف",
  variantId: "c5",
  variantName: "نصف",
  variantPrice: 23,
  unitPrice: 23,
};
const selectedHalfName = resolveCartItemName(configuredChickenRows[0].name, selectedHalf);
assert.equal(selectedHalfName, "نص حبة على الفحم مع الرز");
assert.deepEqual(resolveCustomizationParts(selectedHalf, selectedHalfName), []);

console.log("cart pricing regression tests passed");