CREATE TABLE watches (
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vehicle_id uuid        NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vehicle_id)
);

-- Back-in-stock fan-out looks watchers up by vehicle.
CREATE INDEX watches_vehicle_idx ON watches (vehicle_id);
