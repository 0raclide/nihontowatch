-- =============================================================================
-- Composite index for dwell stats RPC performance
-- =============================================================================
-- Migration: 151_dwell_rpc_performance_index.sql
-- Problem: get_dealer_dwell_stats times out on 30-day ranges because it scans
--          activity_events with WHERE event_type = 'viewport_dwell' AND created_at
--          BETWEEN ... but only has single-column indexes on each field.
--          The JSONB JOIN (event_data->>'listingId')::BIGINT = listings.id
--          also requires extracting a value from every matching row.
-- Fix: Composite index (event_type, created_at) for the initial filter,
--      plus an expression index on the JSONB listingId extraction for the JOIN.
-- =============================================================================

-- Covers: get_dealer_dwell_stats, get_dealer_click_stats, get_listing_engagement_counts
-- WHERE event_type = '...' AND created_at BETWEEN ...
CREATE INDEX IF NOT EXISTS idx_activity_events_type_created
  ON activity_events (event_type, created_at);

-- Expression index for JSONB listingId extraction used in dwell JOIN
-- Covers: JOIN listings l ON (ae.event_data->>'listingId')::BIGINT = l.id
CREATE INDEX IF NOT EXISTS idx_activity_events_listing_id_expr
  ON activity_events (((event_data->>'listingId')::BIGINT))
  WHERE event_data->>'listingId' IS NOT NULL;
