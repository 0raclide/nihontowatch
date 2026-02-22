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
-- Filter to only listing IDs that exist in listings table (orphan events are
-- possible when listings are deleted after activity was recorded)
INSERT INTO listing_views (listing_id, session_id, user_id, referrer, viewed_at, view_date)
SELECT
  (ae.event_data->>'listingId')::int AS listing_id,
  ae.session_id,
  ae.user_id,
  'quickview' AS referrer,
  ae.created_at AS viewed_at,
  ae.created_at::date AS view_date
FROM activity_events ae
WHERE ae.event_type = 'quickview_open'
  AND (ae.event_data->>'listingId') IS NOT NULL
  AND ae.session_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM listings l WHERE l.id = (ae.event_data->>'listingId')::int
  )
ON CONFLICT DO NOTHING;
