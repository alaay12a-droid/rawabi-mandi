import assert from "node:assert/strict";
import { addOrMergeCartLine, createCartKey, getCartUnitPrice } from "../utils/cartPricing.ts";

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

console.log("cart pricing regression tests passed");