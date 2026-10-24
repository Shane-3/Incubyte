CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         varchar(20) NOT NULL,
  vehicle_id   uuid        NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  quantity     integer     NOT NULL,
  read_at      timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'BACK_IN_STOCK'))
);

CREATE INDEX notifications_inbox_idx ON notifications (recipient_id, read_at, created_at DESC);

-- At most one open admin alert per recipient, vehicle and type, even under concurrent purchases.
CREATE UNIQUE INDEX notifications_open_alert_key ON notifications (recipient_id, vehicle_id, type)
  WHERE resolved_at IS NULL AND type IN ('LOW_STOCK', 'OUT_OF_STOCK');
