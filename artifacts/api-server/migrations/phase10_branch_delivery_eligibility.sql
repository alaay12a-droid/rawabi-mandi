ALTER TABLE branches ADD COLUMN IF NOT EXISTS weekly_operating_hours JSONB;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS delivery_capacity INTEGER;
DO $$ BEGIN
  ALTER TABLE branches ADD CONSTRAINT branches_delivery_capacity_positive
    CHECK (delivery_capacity IS NULL OR delivery_capacity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS branch_product_availability (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES menu_items(item_id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL,
  UNIQUE (branch_id, item_id)
);
CREATE INDEX IF NOT EXISTS orders_delivery_capacity_lookup_idx
  ON orders (order_type, status, branch_id);