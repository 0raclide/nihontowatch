-- =============================================================================
-- 121: Create collection_events audit table
-- =============================================================================
-- Self-contained audit log for item lifecycle events.
-- No FKs to listings or collection_items — item_uuid is a soft reference
-- so the audit trail survives item deletion.

CREATE TABLE collection_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid   UUID NOT NULL,
  actor_id    UUID NOT NULL REFERENCES auth.users(id),
  event_type  TEXT NOT NULL,  -- created | updated | promoted | delisted | sold | deleted
  payload     JSONB,          -- Event-specific data (changed fields, etc.)
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ce_item_uuid  ON collection_events(item_uuid);
CREATE INDEX idx_ce_actor      ON collection_events(actor_id);
CREATE INDEX idx_ce_type       ON collection_events(event_type);
CREATE INDEX idx_ce_created    ON collection_events(created_at);
