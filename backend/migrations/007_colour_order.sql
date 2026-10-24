-- Colours list in the order they were added. now() is fixed for a whole transaction, so several colours added
-- together would tie; clock_timestamp() advances within it.
ALTER TABLE vehicle_colours ALTER COLUMN created_at SET DEFAULT clock_timestamp();
