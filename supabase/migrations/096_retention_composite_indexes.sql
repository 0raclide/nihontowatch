-- =============================================================================
-- Composite indexes for retention/segmentation RPC performance
-- =============================================================================
-- Migration: 096_retention_composite_indexes.sql
-- Problem: Retention RPCs scan activity_events with WHERE created_at range +
--          GROUP BY visitor_id, but only single-column indexes exist.
--          This forces a full index scan on created_at then random lookups
--          for visitor_id on each row.
-- Fix: Composite index (created_at, visitor_id) covers the exact access pattern.
--      Also add (created_at, user_id) for the user cohort variant.
-- =============================================================================

-- Covers: get_visitor_retention_cohorts, get_visitor_segments_with_devices
-- WHERE created_at >= ... AND created_at < ... AND visitor_id IS NOT NULL
-- GROUP BY visitor_id
CREATE INDEX IF NOT EXISTS idx_activity_events_created_visitor
  ON activity_events (created_at, visitor_id)
  WHERE visitor_id IS NOT NULL;

-- Covers: get_user_retention_cohorts
-- WHERE user_id IS NOT NULL AND created_at >= ... AND created_at < ...
-- SELECT DISTINCT user_id, DATE_TRUNC('week', created_at)
CREATE INDEX IF NOT EXISTS idx_activity_events_created_user
  ON activity_events (created_at, user_id)
  WHERE user_id IS NOT NULL;
