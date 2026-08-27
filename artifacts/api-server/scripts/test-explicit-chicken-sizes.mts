import assert from "node:assert/strict";
import { isValidExplicitChickenSizeSelection } from "../src/lib/explicitChickenSizes.ts";

assert.equal(
  isValidExplicitChickenSizeSelection({
    itemId: "c5",
    priceInHalalas: 2300,
    size: "نصف",
    variantId: "c5",
    variantPrice: 23,
  }),
  true,
);

assert.equal(
  isValidExplicitChickenSizeSelection({
    itemId: "c6",
    priceInHalalas: 4600,
    size: "حبة كاملة",
    variantId: "c6",
    variantPrice: 46,
  }),
  true,
);

assert.equal(
  isValidExplicitChickenSizeSelection({
    itemId: "c6",
    priceInHalalas: 4600,
    size: "نصف",
    variantId: "c6",
    variantPrice: 23,
  }),
  false,
  "a half label and derived half price must not be accepted for the whole row",
);

assert.equal(
  isValidExplicitChickenSizeSelection({
    itemId: "c5",
    priceInHalalas: 2400,
    size: "نصف",
    variantId: "c5",
    variantPrice: 23,
  }),
  false,
  "a stale cart snapshot must not match a changed database price",
);

console.log("explicit chicken size validation tests passed");