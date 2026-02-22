-- =============================================================================
-- BACKFILL: quickview_open events → listing_views
-- Migration: 079_backfill_quickview_listing_views.sql
--
-- The listing_views fan-out previously only captured listing_detail_view events.
-- QuickView is the primary way users interact with listings, so quickview_open
-- events should also count as listing views. This backfills historical data.
--
-- The fan-out code (src/app/api/activity/route.ts) has been updated to include
-- quickview_open going forward. This migration handles the historical gap.
-- =============================================================================

-- Step 1: Add 'quickview' to the referrer check constraint
ALTER TABLE listing_views DROP CONSTRAINT IF EXISTS listing_views_referrer_check;
ALTER TABLE listing_views ADD CONSTRAINT listing_views_referrer_check
  CHECK (referrer IN ('browse', 'search', 'direct', 'external', 'alert', 'quickview'));

-- Step 2: Backfill historical quickview_open events
INSERT INTO listing_views (listing_id, session_id, user_id, referrer, viewed_at, view_date)
SELECT
  (event_data->>'listingId')::int AS listing_id,
  session_id,
  user_id,
  'quickview' AS referrer,
  created_at AS viewed_at,
  created_at::date AS view_date
FROM activity_events
WHERE event_type = 'quickview_open'
  AND (event_data->>'listingId') IS NOT NULL
  AND session_id IS NOT NULL
ON CONFLICT DO NOTHING;
