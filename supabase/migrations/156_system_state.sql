-- Simple key-value table for system state (cron dedup, feature flags, etc.)
CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_system_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_state_updated
  BEFORE UPDATE ON system_state
  FOR EACH ROW EXECUTE FUNCTION update_system_state_timestamp();
