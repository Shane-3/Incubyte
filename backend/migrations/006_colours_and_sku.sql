-- Colour variants with their own stock, and a stable SKU per model (make + model).

-- SKU: same rule as services/sku.ts for existing rows (accents are simply dropped here), with -2, -3 on clashes.
ALTER TABLE vehicles ADD COLUMN sku varchar(40);

UPDATE vehicles v
SET sku = numbered.base || CASE WHEN numbered.n > 1 THEN '-' || numbered.n ELSE '' END
FROM (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY created_at, id) AS n
  FROM (
    SELECT id, created_at,
           COALESCE(NULLIF(left(upper(regexp_replace(make, '[^A-Za-z0-9]', '', 'g')), 3), ''), 'X') || '-' ||
           COALESCE(NULLIF(left(upper(regexp_replace(model, '[^A-Za-z0-9]', '', 'g')), 16), ''), 'X') AS base
    FROM vehicles
  ) bases
) numbered
WHERE v.id = numbered.id;

ALTER TABLE vehicles ALTER COLUMN sku SET NOT NULL;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_sku_key UNIQUE (sku);

-- One row per model: adding the same make + model again adds a colour instead.
CREATE UNIQUE INDEX vehicles_make_model_key ON vehicles (lower(make), lower(model));

CREATE TABLE vehicle_colours (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid        NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  name       varchar(40) NOT NULL,
  hex        char(7)     NOT NULL,
  quantity   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_colours_hex_check CHECK (hex ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT vehicle_colours_quantity_check CHECK (quantity >= 0)
);

CREATE UNIQUE INDEX vehicle_colours_name_key ON vehicle_colours (vehicle_id, lower(name));

-- Existing stock moves into a single Standard colour, so every model keeps its total.
INSERT INTO vehicle_colours (vehicle_id, name, hex, quantity)
SELECT id, 'Standard', '#8a8f98', quantity FROM vehicles;

-- Which colour each sale came from. Kept (as NULL) if a colour is later removed.
ALTER TABLE purchases ADD COLUMN colour_id uuid REFERENCES vehicle_colours (id) ON DELETE SET NULL;
