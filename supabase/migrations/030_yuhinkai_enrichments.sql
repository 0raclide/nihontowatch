-- Yuhinkai Enrichment Integration
-- Stores enrichment data from Yuhinkai catalog matches for tosogu (and later swords)
--
-- This table enables:
-- 1. Professional English translations for Juyo/Tokuju items (dealers only show images)
-- 2. Verified artisan, school, period information from official catalog
-- 3. Non-destructive enrichment (original dealer data preserved in listings table)
-- 4. Easy extension to sword enrichment when pipeline is ready

-- =============================================================================
-- MAIN TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS yuhinkai_enrichments (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

    -- Yuhinkai reference (links to oshi-v2 physical_objects + catalog_records)
    yuhinkai_uuid UUID NOT NULL,              -- physical_objects.uuid
    yuhinkai_collection VARCHAR(50),          -- catalog_records.collection (Juyo, Tokuju, etc.)
    yuhinkai_volume INTEGER,                  -- catalog_records.volume
    yuhinkai_item_number INTEGER,             -- catalog_records.item_number

    -- Match metadata
    match_score FLOAT NOT NULL,               -- 0.0-1.0 weighted score from SOTA matcher
    match_confidence VARCHAR(20) NOT NULL,    -- DEFINITIVE, HIGH, MEDIUM, LOW
    match_signals JSONB DEFAULT '{}',         -- {ocr: 0.95, session: true, maker: 0.9}
    matched_fields TEXT[],                    -- ['ocr_text', 'session', 'maker']

    -- Enriched data (denormalized from gold_values + catalog_records)
    enriched_maker TEXT,                      -- gold_values.gold_artisan
    enriched_maker_kanji TEXT,                -- gold_values.gold_artisan_kanji
    enriched_school TEXT,                     -- gold_values.gold_school
    enriched_period TEXT,                     -- gold_values.gold_period
    enriched_form_type TEXT,                  -- gold_values.gold_form_type (tosogu only)

    -- Translations - the "magic" - professional English from catalog
    setsumei_ja TEXT,                         -- catalog_records.japanese_txt
    setsumei_en TEXT,                         -- catalog_records.translation_md
    setsumei_en_format VARCHAR(20) DEFAULT 'markdown',  -- 'markdown' or 'plain'

    -- Certification info from catalog
    enriched_cert_type VARCHAR(50),           -- 'Juyo Tosogu', 'Tokubetsu Juyo', etc.
    enriched_cert_session INTEGER,            -- Session number

    -- Item type (for extensibility: 'tosogu' now, 'blade' later)
    item_category VARCHAR(20) NOT NULL DEFAULT 'tosogu',

    -- Verification workflow
    verification_status VARCHAR(20) DEFAULT 'auto',  -- 'auto', 'confirmed', 'rejected', 'review_needed'
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,

    -- Timestamps
    enriched_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate enrichments for same listing+yuhinkai pair
    UNIQUE(listing_id, yuhinkai_uuid)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Fast lookup by listing (for JOIN in listing detail API)
CREATE INDEX idx_yuhinkai_enrich_listing ON yuhinkai_enrichments(listing_id);

-- Filter by confidence level
CREATE INDEX idx_yuhinkai_enrich_confidence ON yuhinkai_enrichments(match_confidence);

-- Filter by item category (for future sword extension)
CREATE INDEX idx_yuhinkai_enrich_category ON yuhinkai_enrichments(item_category);

-- Filter by verification status
CREATE INDEX idx_yuhinkai_enrich_status ON yuhinkai_enrichments(verification_status);

-- Combined index for the view query
CREATE INDEX idx_yuhinkai_enrich_displayable
    ON yuhinkai_enrichments(listing_id, match_score DESC)
    WHERE match_confidence = 'DEFINITIVE'
    AND verification_status IN ('auto', 'confirmed');

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_yuhinkai_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER yuhinkai_enrichment_update_timestamp
    BEFORE UPDATE ON yuhinkai_enrichments
    FOR EACH ROW
    EXECUTE FUNCTION update_yuhinkai_enrichment_timestamp();

-- =============================================================================
-- VIEW: Best enrichment per listing (for efficient queries)
-- =============================================================================

-- Only returns DEFINITIVE matches with auto/confirmed status
-- Returns exactly one row per listing (the highest scoring match)
CREATE OR REPLACE VIEW listing_yuhinkai_enrichment AS
SELECT DISTINCT ON (listing_id)
    id as enrichment_id,
    listing_id,
    yuhinkai_uuid,
    yuhinkai_collection,
    yuhinkai_volume,
    yuhinkai_item_number,
    match_score,
    match_confidence,
    match_signals,
    matched_fields,
    enriched_maker,
    enriched_maker_kanji,
    enriched_school,
    enriched_period,
    enriched_form_type,
    setsumei_ja,
    setsumei_en,
    setsumei_en_format,
    enriched_cert_type,
    enriched_cert_session,
    item_category,
    verification_status,
    enriched_at,
    updated_at
FROM yuhinkai_enrichments
WHERE match_confidence = 'DEFINITIVE'
  AND verification_status IN ('auto', 'confirmed')
ORDER BY listing_id, match_score DESC;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS
ALTER TABLE yuhinkai_enrichments ENABLE ROW LEVEL SECURITY;

-- Public read access (enrichments are public data)
CREATE POLICY "Anyone can read enrichments"
    ON yuhinkai_enrichments
    FOR SELECT
    USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage enrichments"
    ON yuhinkai_enrichments
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE yuhinkai_enrichments IS
    'Stores Yuhinkai catalog enrichment data for matched Juyo/Tokuju listings. '
    'Enables professional English translations and verified attribution data.';

COMMENT ON COLUMN yuhinkai_enrichments.match_confidence IS
    'DEFINITIVE = 95%+ OCR match, HIGH = strong multi-signal, MEDIUM/LOW = weaker matches';

COMMENT ON COLUMN yuhinkai_enrichments.setsumei_en IS
    'Professional English translation from Yuhinkai catalog - the "magic" value-add';

COMMENT ON COLUMN yuhinkai_enrichments.item_category IS
    'Currently ''tosogu'' only, will support ''blade'' when sword pipeline is ready';

COMMENT ON VIEW listing_yuhinkai_enrichment IS
    'Efficient view for getting best enrichment per listing - use for API JOINs';
