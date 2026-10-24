CREATE TABLE vehicles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make       varchar(100)  NOT NULL,
  model      varchar(100)  NOT NULL,
  category   varchar(50)   NOT NULL,
  price      numeric(12,2) NOT NULL,
  quantity   integer       NOT NULL DEFAULT 0,
  created_at timestamptz   NOT NULL DEFAULT now(),
  updated_at timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_price_check CHECK (price >= 0),
  CONSTRAINT vehicles_quantity_check CHECK (quantity >= 0)
);

CREATE INDEX vehicles_make_idx ON vehicles (lower(make));
CREATE INDEX vehicles_category_idx ON vehicles (category);
CREATE INDEX vehicles_price_idx ON vehicles (price);
