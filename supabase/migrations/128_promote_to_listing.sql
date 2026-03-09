-- =============================================================================
-- 128: promote_to_listing() RPC
-- =============================================================================
-- Promotes a private collection item to a public dealer listing.
-- Re-promote path: if a DELISTED ghost exists with the same item_uuid,
-- UPDATE it (preserving listing.id → all FK relationships intact).
-- First-promote path: INSERT new listing row.
-- Deletes the collection_items row and logs an audit event.

CREATE OR REPLACE FUNCTION promote_to_listing(
  p_collection_item_id UUID,
  p_dealer_id          INT,
  p_owner_id           UUID,
  p_price_value        NUMERIC DEFAULT NULL,
  p_price_currency     TEXT    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item           RECORD;
  v_existing_id    BIGINT;
  v_listing_id     BIGINT;
  v_synthetic_url  TEXT;
BEGIN
  -- 1. Lock and fetch collection item
  SELECT * INTO v_item
  FROM collection_items
  WHERE id = p_collection_item_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Collection item not found or not owned by user';
  END IF;

  -- 2. Check for existing DELISTED ghost (re-promote path)
  SELECT id INTO v_existing_id
  FROM listings
  WHERE item_uuid = v_item.item_uuid AND status = 'DELISTED'
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    -- Re-promote: UPDATE existing listing with fresh collection data
    UPDATE listings SET
      title           = v_item.title,
      description     = v_item.description,
      item_type       = v_item.item_type,
      item_category   = v_item.item_category,
      status          = 'AVAILABLE',
      is_available    = true,
      is_sold         = false,
      price_value     = COALESCE(p_price_value, v_item.price_value),
      price_currency  = COALESCE(p_price_currency, v_item.price_currency),
      nagasa_cm       = v_item.nagasa_cm,
      sori_cm         = v_item.sori_cm,
      motohaba_cm     = v_item.motohaba_cm,
      sakihaba_cm     = v_item.sakihaba_cm,
      kasane_cm       = v_item.kasane_cm,
      weight_g        = v_item.weight_g,
      nakago_cm       = v_item.nakago_cm,
      tosogu_maker    = v_item.tosogu_maker,
      tosogu_school   = v_item.tosogu_school,
      material        = v_item.material,
      height_cm       = v_item.height_cm,
      width_cm        = v_item.width_cm,
      thickness_mm    = v_item.thickness_mm,
      smith           = v_item.smith,
      school          = v_item.school,
      province        = v_item.province,
      era             = v_item.era,
      mei_type        = v_item.mei_type,
      mei_text        = v_item.mei_text,
      mei_guaranteed  = v_item.mei_guaranteed,
      nakago_type     = v_item.nakago_type,
      cert_type       = v_item.cert_type,
      cert_session    = v_item.cert_session,
      cert_organization = v_item.cert_organization,
      images          = v_item.images,
      stored_images   = v_item.stored_images,
      artisan_id      = v_item.artisan_id,
      artisan_confidence = v_item.artisan_confidence,
      sayagaki        = v_item.sayagaki,
      hakogaki        = v_item.hakogaki,
      koshirae        = v_item.koshirae,
      provenance      = v_item.provenance,
      kiwame          = v_item.kiwame,
      kanto_hibisho   = v_item.kanto_hibisho,
      research_notes  = v_item.research_notes,
      setsumei_text_en = v_item.setsumei_text_en,
      setsumei_text_ja = v_item.setsumei_text_ja,
      title_en        = v_item.title_en,
      title_ja        = v_item.title_ja,
      description_en  = v_item.description_en,
      description_ja  = v_item.description_ja,
      ai_curator_note_en = v_item.ai_curator_note_en,
      ai_curator_note_ja = v_item.ai_curator_note_ja,
      focal_x         = v_item.focal_x,
      focal_y         = v_item.focal_y,
      hero_image_index = v_item.hero_image_index,
      video_count     = v_item.video_count,
      -- Listing-only defaults on re-promote
      artisan_method  = 'dealer_manual',
      artisan_candidates = NULL,
      artisan_elite_factor = NULL,
      artisan_elite_count = NULL,
      artisan_designation_factor = NULL,
      featured_score  = 0,
      admin_hidden    = false,
      page_exists     = true
    WHERE id = v_existing_id;

    v_listing_id := v_existing_id;

  ELSE
    -- First-promote: verify no active listing for this item_uuid
    IF EXISTS (
      SELECT 1 FROM listings
      WHERE item_uuid = v_item.item_uuid AND status != 'DELISTED'
    ) THEN
      RAISE EXCEPTION 'Active listing already exists for this item';
    END IF;

    -- Generate synthetic URL
    v_synthetic_url := 'nw://dealer/' || p_dealer_id || '/' || gen_random_uuid();

    INSERT INTO listings (
      url, dealer_id, owner_id, item_uuid, source,
      title, description, item_type, item_category,
      status, is_available, is_sold,
      price_value, price_currency, price_raw,
      nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm, weight_g, nakago_cm,
      tosogu_maker, tosogu_school, material, height_cm, width_cm, thickness_mm,
      smith, school, province, era, mei_type, mei_text, mei_guaranteed, nakago_type,
      cert_type, cert_session, cert_organization,
      images, stored_images,
      artisan_id, artisan_confidence, artisan_method, artisan_candidates,
      sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho,
      research_notes,
      setsumei_text_en, setsumei_text_ja,
      title_en, title_ja, description_en, description_ja,
      ai_curator_note_en, ai_curator_note_ja,
      focal_x, focal_y, hero_image_index, video_count,
      page_exists, is_initial_import, scrape_count, featured_score
    ) VALUES (
      v_synthetic_url, p_dealer_id, p_owner_id, v_item.item_uuid, 'dealer',
      v_item.title, v_item.description, v_item.item_type, v_item.item_category,
      'AVAILABLE', true, false,
      COALESCE(p_price_value, v_item.price_value), COALESCE(p_price_currency, v_item.price_currency), NULL,
      v_item.nagasa_cm, v_item.sori_cm, v_item.motohaba_cm, v_item.sakihaba_cm,
      v_item.kasane_cm, v_item.weight_g, v_item.nakago_cm,
      v_item.tosogu_maker, v_item.tosogu_school, v_item.material,
      v_item.height_cm, v_item.width_cm, v_item.thickness_mm,
      v_item.smith, v_item.school, v_item.province, v_item.era,
      v_item.mei_type, v_item.mei_text, v_item.mei_guaranteed, v_item.nakago_type,
      v_item.cert_type, v_item.cert_session, v_item.cert_organization,
      v_item.images, v_item.stored_images,
      v_item.artisan_id, v_item.artisan_confidence, 'dealer_manual', NULL,
      v_item.sayagaki, v_item.hakogaki, v_item.koshirae, v_item.provenance,
      v_item.kiwame, v_item.kanto_hibisho,
      v_item.research_notes,
      v_item.setsumei_text_en, v_item.setsumei_text_ja,
      v_item.title_en, v_item.title_ja, v_item.description_en, v_item.description_ja,
      v_item.ai_curator_note_en, v_item.ai_curator_note_ja,
      v_item.focal_x, v_item.focal_y, v_item.hero_image_index, v_item.video_count,
      true, false, 0, 0
    )
    RETURNING id INTO v_listing_id;
  END IF;

  -- 3. Delete collection item (no FKs reference it)
  DELETE FROM collection_items WHERE id = p_collection_item_id;

  -- 4. Audit event
  INSERT INTO collection_events (item_uuid, actor_id, event_type, payload)
  VALUES (
    v_item.item_uuid,
    p_owner_id,
    'promoted',
    jsonb_build_object(
      'listing_id', v_listing_id,
      'personal_notes', v_item.personal_notes,
      'price_value', COALESCE(p_price_value, v_item.price_value),
      'price_currency', COALESCE(p_price_currency, v_item.price_currency)
    )
  );

  RETURN v_listing_id;
END;
$$;
