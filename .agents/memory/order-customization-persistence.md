---
name: Order customization persistence
description: Durable contract for carrying selected sizes and options from cart through order displays.
---

Selected size and option choices must be persisted as structured data on each order item. The formatted item name is retained for compatibility, but it is not the authoritative source of customization.

**Why:** Flattening a selected size into the item name allowed some checkout paths to silently discard it, leaving invoices and staff apps unable to reconstruct what the customer selected.

**How to apply:** Any new order-item customization must be added to the cart variant identity, checkout payload, API validation, stored JSON, and downstream display formatter together. Keep price calculations independent from display formatting.