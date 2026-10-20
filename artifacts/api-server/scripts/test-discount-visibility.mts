import assert from "node:assert/strict";
import { isPrivateDiscountCode, visibleDiscountCodes } from "../src/lib/discountVisibility.ts";

const publicCode = { code: "WELCOME", description: "خصم للجميع" };
const vipCode = { code: "VIP-TEST", description: "تحفيز لأفضل عميل" };
const renamedReward = { code: "REWARD", description: "تحفيز لأفضل عميل — خاص" };

assert.equal(isPrivateDiscountCode(vipCode), true);
assert.equal(isPrivateDiscountCode({ code: " vip-test ", description: null }), true);
assert.equal(isPrivateDiscountCode(renamedReward), true);
assert.equal(isPrivateDiscountCode(publicCode), false);
assert.equal(isPrivateDiscountCode({ code: "WELCOME", description: null }), false);

const codes = [publicCode, vipCode, renamedReward];
assert.deepEqual(visibleDiscountCodes(codes, false), [publicCode]);
assert.deepEqual(visibleDiscountCodes(codes, true), codes);
assert.deepEqual(visibleDiscountCodes([vipCode], false), []);
assert.deepEqual(visibleDiscountCodes([], false), []);
assert.equal(codes.length, 3, "Filtering must not delete or modify rewards");

console.log("PASS: customer lists exclude VIP and legacy rewards; staff lists retain them.");
