-- Scraper Tables Migration for Nihontowatch Admin Dashboard
-- Run this SQL in Supabase SQL Editor to enable scraper monitoring
--
-- These tables are also defined in Oshi-scrapper (/db/schema.sql)
-- This migration uses CREATE TABLE IF NOT EXISTS to be idempotent

-- ============================================
-- SCRAPE RUNS TABLE
-- ============================================
-- Tracks each scraping run for monitoring and history

CREATE TABLE IF NOT EXISTS scrape_runs (
    id SERIAL PRIMARY KEY,
    run_type TEXT NOT NULL,                    -- 'discovery', 'scrape', 'full', 'daily_scrape'
    dealer_id INTEGER REFERENCES dealers(id),  -- NULL = all dealers
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    urls_processed INTEGER DEFAULT 0,
    new_listings INTEGER DEFAULT 0,
    updated_listings INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',             -- 'running', 'completed', 'failed', 'pending'
    error_message TEXT                         -- Error details if status = 'failed'
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_dealer ON scrape_runs(dealer_id);


-- ============================================
-- EXTRACTION METRICS TABLE
-- ============================================
-- Tracks QA metrics for each listing extraction
-- Used to calculate pass rates and identify problematic extractions

CREATE TABLE IF NOT EXISTS extraction_metrics (
    id SERIAL PRIMARY KEY,

    -- Foreign keys
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL,

    -- Prompt tracking for A/B testing
    prompt_version VARCHAR(50),                -- e.g., "v2.3.1"
    prompt_variant VARCHAR(50),                -- e.g., "control", "structured_output"
    llm_model VARCHAR(100),                    -- e.g., "gemini-1.5-flash", "gpt-4o-mini"

    -- Field-level confidence scores (0.0-1.0)
    price_confidence FLOAT,
    nagasa_confidence FLOAT,
    smith_confidence FLOAT,
    province_confidence FLOAT,
    certification_confidence FLOAT,
    title_confidence FLOAT,
    status_confidence FLOAT,

    -- Overall metrics (0.0-1.0 scale)
    overall_confidence FLOAT,
    validation_score FLOAT,
    completeness_score FLOAT,
    quality_score FLOAT,

    -- QA status for filtering
    qa_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'passed', 'warnings', 'failed', 'pending'

    -- Validation details (JSONB for flexibility)
    validation_errors JSONB DEFAULT '[]',      -- Array of {field, message, severity}
    low_confidence_fields JSONB DEFAULT '[]',  -- Array of field names
    critical_issues JSONB DEFAULT '[]',        -- Array of critical issue descriptions

    -- Issue counts for quick filtering
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    info_count INTEGER DEFAULT 0,

    -- Cover image selection
    cover_image_url TEXT,
    cover_selection_score FLOAT,
    cover_selection_reason TEXT,

    -- Timestamps
    extracted_at TIMESTAMPTZ DEFAULT NOW(),

    -- A/B testing support
    experiment_id VARCHAR(100),
    experiment_group VARCHAR(50),

    -- Raw scores for detailed analysis
    raw_scores JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_listing ON extraction_metrics(listing_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dealer ON extraction_metrics(dealer_id);
CREATE INDEX IF NOT EXISTS idx_metrics_qa_status ON extraction_metrics(qa_status);
CREATE INDEX IF NOT EXISTS idx_metrics_extracted_at ON extraction_metrics(extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_quality_score ON extraction_metrics(quality_score);
CREATE INDEX IF NOT EXISTS idx_metrics_dealer_date ON extraction_metrics(dealer_id, extracted_at);


-- ============================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- Dealer quality summary (last 7 days)
CREATE OR REPLACE VIEW dealer_quality_summary AS
SELECT
    d.id as dealer_id,
    d.name as dealer_name,
    COUNT(em.id) as sample_size,
    ROUND(AVG(em.quality_score)::numeric, 3) as avg_quality_score,
    ROUND(AVG(em.overall_confidence)::numeric, 3) as avg_confidence,
    COUNT(*) FILTER (WHERE em.qa_status = 'passed') as passed_count,
    COUNT(*) FILTER (WHERE em.qa_status = 'warnings') as warnings_count,
    COUNT(*) FILTER (WHERE em.qa_status = 'failed') as failed_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE em.qa_status IN ('passed', 'warnings')) / NULLIF(COUNT(*), 0), 1) as pass_rate,
    MAX(em.extracted_at) as last_extraction
FROM dealers d
LEFT JOIN extraction_metrics em ON d.id = em.dealer_id
    AND em.extracted_at > NOW() - INTERVAL '7 days'
GROUP BY d.id, d.name
ORDER BY avg_quality_score DESC NULLS LAST;


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- These tables should be readable by the service role

ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access for scrape_runs" ON scrape_runs
    FOR ALL USING (true);

CREATE POLICY "Service role access for extraction_metrics" ON extraction_metrics
    FOR ALL USING (true);


-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE scrape_runs IS 'Tracks scraping runs initiated by Oshi-scrapper. Used by admin dashboard to show run history and status.';
COMMENT ON TABLE extraction_metrics IS 'QA metrics for each listing extraction. Used to calculate pass rates and identify issues.';
COMMENT ON COLUMN extraction_metrics.qa_status IS 'Overall QA status: passed (no errors), warnings (minor issues), failed (critical errors), pending (not yet validated)';
COMMENT ON COLUMN extraction_metrics.validation_errors IS 'JSONB array: [{field: string, message: string, severity: string}, ...]';
