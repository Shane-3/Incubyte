CREATE TABLE purchases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid          NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  user_id    uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  quantity   integer       NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  created_at timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT purchases_quantity_check CHECK (quantity > 0),
  CONSTRAINT purchases_unit_price_check CHECK (unit_price >= 0)
);

-- Serves the forecast's "units sold per vehicle in the last N days" aggregate.
CREATE INDEX purchases_vehicle_created_idx ON purchases (vehicle_id, created_at);
