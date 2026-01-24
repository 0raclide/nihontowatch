-- Manual Enrichment Connection Tracking
-- Adds column to distinguish automatic SOTA matcher connections from manual admin connections
-- This enables safe, auditable manual linking of listings to Yuhinkai catalog records

-- =============================================================================
-- ADD CONNECTION SOURCE COLUMN
-- =============================================================================

ALTER TABLE yuhinkai_enrichments
ADD COLUMN IF NOT EXISTS connection_source VARCHAR(20) DEFAULT 'auto';

COMMENT ON COLUMN yuhinkai_enrichments.connection_source IS
    'Source of the enrichment connection: auto = SOTA matcher, manual = admin URL paste';

-- =============================================================================
-- INDEX FOR MANUAL CONNECTIONS
-- =============================================================================

-- Fast lookup of manual connections (for admin review/audit)
CREATE INDEX IF NOT EXISTS idx_yuhinkai_enrich_manual
ON yuhinkai_enrichments(connection_source, verified_at DESC)
WHERE connection_source = 'manual';

-- =============================================================================
-- UPDATE VIEW TO INCLUDE CONNECTION SOURCE
-- =============================================================================

-- Drop and recreate view (can't use CREATE OR REPLACE when adding columns)
DROP VIEW IF EXISTS listing_yuhinkai_enrichment;

CREATE VIEW listing_yuhinkai_enrichment AS
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
    connection_source,
    verified_by,
    verified_at,
    enriched_at,
    updated_at
FROM yuhinkai_enrichments
WHERE match_confidence = 'DEFINITIVE'
  AND verification_status IN ('auto', 'confirmed')
ORDER BY listing_id, match_score DESC;

COMMENT ON VIEW listing_yuhinkai_enrichment IS
    'Efficient view for getting best enrichment per listing - includes connection_source for audit';
