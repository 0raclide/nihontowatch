-- =============================================================================
-- 123: RLS policies for collection tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- collection_items
-- ---------------------------------------------------------------------------
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Owner full CRUD
CREATE POLICY ci_owner_all
  ON collection_items FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Service role bypass (admin, crons)
CREATE POLICY ci_service_role
  ON collection_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- collection_events
-- ---------------------------------------------------------------------------
ALTER TABLE collection_events ENABLE ROW LEVEL SECURITY;

-- Owner can read own events
CREATE POLICY ce_owner_read
  ON collection_events FOR SELECT
  USING (auth.uid() = actor_id);

-- Owner can insert own events
CREATE POLICY ce_owner_insert
  ON collection_events FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- Service role bypass
CREATE POLICY ce_service_role
  ON collection_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- item_videos
-- ---------------------------------------------------------------------------
ALTER TABLE item_videos ENABLE ROW LEVEL SECURITY;

-- Owner full CRUD
CREATE POLICY iv_owner_all
  ON item_videos FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Service role bypass
CREATE POLICY iv_service_role
  ON item_videos FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
