-- Reconcile the scan_signals schema.
-- Safe for both:
-- 1. Fresh installations where 002 already created the correct table.
-- 2. Existing installations where the old legacy table was manually renamed.

DO $$
BEGIN
  -- If the correct scan_signals table does not exist but the old
  -- legacy table does, restore the expected table name.
  IF to_regclass('public.scan_signals') IS NULL
     AND to_regclass('public.legacy_scan_signals') IS NOT NULL THEN
    ALTER TABLE legacy_scan_signals RENAME TO scan_signals;
  END IF;
END
$$;

-- Ensure the expected TrustShield table exists.
CREATE TABLE IF NOT EXISTS scan_signals (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  signal_code TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  description TEXT NOT NULL,
  score_contribution INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH'))
);

CREATE INDEX IF NOT EXISTS idx_scan_signals_scan_id
ON scan_signals(scan_id);