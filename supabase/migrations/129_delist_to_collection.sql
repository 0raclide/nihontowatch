-- =============================================================================
-- 129: delist_to_collection() RPC
-- =============================================================================
-- Delists a public dealer listing back to a private collection item.
-- Soft-delist: listing stays with status=DELISTED (preserves FK data:
-- favorites, price_history, views, impressions). Collection item gets
-- a fresh UUID PK but keeps the same item_uuid for re-promote.

CREATE OR REPLACE FUNCTION delist_to_collection(
  p_listing_id  BIGINT,
  p_owner_id    UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing      RECORD;
  v_collection_id UUID;
BEGIN
  -- 1. Lock and fetch listing
  SELECT * INTO v_listing
  FROM listings
  WHERE id = p_listing_id
    AND owner_id = p_owner_id
    AND source = 'dealer'
  FOR UPDATE;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'Listing not found, not owned by user, or not a dealer listing';
  END IF;

  IF v_listing.status = 'DELISTED' THEN
    RAISE EXCEPTION 'Listing is already delisted';
  END IF;

  -- 2. Insert into collection_items with fresh UUID PK, same item_uuid
  v_collection_id := gen_random_uuid();

  INSERT INTO collection_items (
    id, item_uuid, owner_id, visibility, personal_notes,
    item_type, item_category, title, description,
    status, is_available, is_sold,
    price_value, price_currency,
    nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm, weight_g, nakago_cm,
    tosogu_maker, tosogu_school, material, height_cm, width_cm, thickness_mm,
    smith, school, province, era, mei_type, mei_text, mei_guaranteed, nakago_type,
    cert_type, cert_session, cert_organization,
    images, stored_images,
    artisan_id, artisan_confidence,
    sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho,
    research_notes,
    setsumei_text_en, setsumei_text_ja,
    title_en, title_ja, description_en, description_ja,
    ai_curator_note_en, ai_curator_note_ja,
    focal_x, focal_y, hero_image_index, video_count
  ) VALUES (
    v_collection_id, v_listing.item_uuid, p_owner_id, 'private', NULL,
    v_listing.item_type, v_listing.item_category, v_listing.title, v_listing.description,
    'available', true, false,
    v_listing.price_value, v_listing.price_currency,
    v_listing.nagasa_cm, v_listing.sori_cm, v_listing.motohaba_cm, v_listing.sakihaba_cm,
    v_listing.kasane_cm, v_listing.weight_g, v_listing.nakago_cm,
    v_listing.tosogu_maker, v_listing.tosogu_school, v_listing.material,
    v_listing.height_cm, v_listing.width_cm, v_listing.thickness_mm,
    v_listing.smith, v_listing.school, v_listing.province, v_listing.era,
    v_listing.mei_type, v_listing.mei_text, v_listing.mei_guaranteed, v_listing.nakago_type,
    v_listing.cert_type, v_listing.cert_session, v_listing.cert_organization,
    v_listing.images, v_listing.stored_images,
    v_listing.artisan_id, v_listing.artisan_confidence,
    v_listing.sayagaki, v_listing.hakogaki, v_listing.koshirae, v_listing.provenance,
    v_listing.kiwame, v_listing.kanto_hibisho,
    v_listing.research_notes,
    v_listing.setsumei_text_en, v_listing.setsumei_text_ja,
    v_listing.title_en, v_listing.title_ja, v_listing.description_en, v_listing.description_ja,
    v_listing.ai_curator_note_en, v_listing.ai_curator_note_ja,
    v_listing.focal_x, v_listing.focal_y, v_listing.hero_image_index, v_listing.video_count
  );

  -- 3. Soft-delist: keep listing row for FK preservation
  UPDATE listings SET
    status = 'DELISTED',
    is_available = false,
    featured_score = 0
  WHERE id = p_listing_id;

  -- 4. Audit event
  INSERT INTO collection_events (item_uuid, actor_id, event_type, payload)
  VALUES (
    v_listing.item_uuid,
    p_owner_id,
    'delisted',
    jsonb_build_object(
      'listing_id', p_listing_id,
      'collection_item_id', v_collection_id
    )
  );

  RETURN v_collection_id;
END;
$$;
