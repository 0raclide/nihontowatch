-- Migration: Create artisan_corrections table for persistent admin fixes
-- This table stores admin corrections separately so they survive pipeline re-runs
-- After the Oshi-scrapper pipeline processes listings, it can re-apply corrections from this table

-- Create the corrections table
CREATE TABLE IF NOT EXISTS artisan_corrections (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

    -- The correction
    corrected_artisan_id TEXT NOT NULL,
    original_artisan_id TEXT,  -- What the pipeline had matched (NULL if no previous match)

    -- Audit trail
    corrected_by TEXT NOT NULL,  -- User ID of admin who made correction
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Optional notes for context
    notes TEXT,

    -- Ensure one correction per listing (latest wins)
    CONSTRAINT unique_listing_correction UNIQUE (listing_id)
);

-- Add comments for documentation
COMMENT ON TABLE artisan_corrections IS 'Stores admin corrections to artisan matches. Survives pipeline re-runs.';
COMMENT ON COLUMN artisan_corrections.listing_id IS 'The listing that was corrected';
COMMENT ON COLUMN artisan_corrections.corrected_artisan_id IS 'The correct Yuhinkai artisan ID set by admin';
COMMENT ON COLUMN artisan_corrections.original_artisan_id IS 'The artisan_id before correction (from pipeline)';
COMMENT ON COLUMN artisan_corrections.corrected_by IS 'User ID of admin who made the correction';
COMMENT ON COLUMN artisan_corrections.corrected_at IS 'When the correction was made';
COMMENT ON COLUMN artisan_corrections.notes IS 'Optional notes explaining the correction';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_artisan_corrections_listing_id
    ON artisan_corrections(listing_id);

CREATE INDEX IF NOT EXISTS idx_artisan_corrections_corrected_at
    ON artisan_corrections(corrected_at DESC);

CREATE INDEX IF NOT EXISTS idx_artisan_corrections_corrected_by
    ON artisan_corrections(corrected_by);

-- Index for pipeline re-apply queries (find all corrections)
CREATE INDEX IF NOT EXISTS idx_artisan_corrections_artisan_id
    ON artisan_corrections(corrected_artisan_id);
