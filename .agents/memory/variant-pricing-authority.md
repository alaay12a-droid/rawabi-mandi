---
name: Variant pricing authority
description: Rules for authoritative product-size prices and menu freshness.
---

Use explicit configured size prices as the only source for selectable variants. Products from the legacy catalog that represent sizes as separate rows must use their own row price and must not synthesize other sizes by multiplying or dividing it.

**Why:** Legacy sibling rows can be edited independently. Deriving “whole” from a half-product row can disagree with the actual whole-product row and produce two accepted prices for the same apparent choice.

**How to apply:** Only show a multi-size selector when the product has structured size entries. Store the selected unit price in the cart line, validate it against the current menu on order creation, and include all variant/option arrays in any menu freshness signature.