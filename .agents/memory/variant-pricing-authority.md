---
name: Variant pricing authority
description: Rules for authoritative product-size prices and menu freshness.
---

Use explicit configured size prices as the only source for selectable variants. Products represented as separate rows may be paired only through an explicit, reviewed relationship; selecting a size must switch to that exact row and use its own price and item ID. Never synthesize a sibling or its price by multiplying or dividing.

**Why:** Legacy sibling rows can be edited independently. Deriving “whole” from a half-product row can disagree with the actual whole-product row and produce two accepted prices for the same apparent choice.

**How to apply:** Prefer structured size entries. For reviewed separate-row pairs, show options only when both rows exist and are available, add the selected row itself to the cart, carry its ID and price snapshot, and validate both against that row on order creation. Include variant/option data in menu freshness signatures.