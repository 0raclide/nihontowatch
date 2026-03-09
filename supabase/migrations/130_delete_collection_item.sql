-- =============================================================================
-- 130: delete_collection_item() RPC
-- =============================================================================
-- Permanently deletes a collection item and its DELISTED ghost listing.
-- API caller must clean up Bunny video files BEFORE calling this RPC
-- (needs provider_id values from item_videos which this RPC deletes).

CREATE OR REPLACE FUNCTION delete_collection_item(
  p_collection_item_id UUID,
  p_owner_id           UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_uuid UUID;
BEGIN
  -- 1. Get item_uuid (FOR UPDATE to prevent concurrent ops)
  SELECT item_uuid INTO v_item_uuid
  FROM collection_items
  WHERE id = p_collection_item_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_item_uuid IS NULL THEN
    RAISE EXCEPTION 'Collection item not found or not owned by user';
  END IF;

  -- 2. Delete collection item
  DELETE FROM collection_items WHERE id = p_collection_item_id;

  -- 3. Delete any DELISTED ghost listing (CASCADE cleans FK data)
  DELETE FROM listings WHERE item_uuid = v_item_uuid AND status = 'DELISTED';

  -- 4. Delete video records (no FK — keyed by item_uuid)
  DELETE FROM item_videos WHERE item_uuid = v_item_uuid;

  -- 5. Audit event
  INSERT INTO collection_events (item_uuid, actor_id, event_type, payload)
  VALUES (
    v_item_uuid,
    p_owner_id,
    'deleted',
    jsonb_build_object('collection_item_id', p_collection_item_id)
  );
END;
$$;
