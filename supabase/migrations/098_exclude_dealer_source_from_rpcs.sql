-- Migration 098: Exclude dealer portal listings from public access via RLS
-- ============================================================================
-- P0 FIX: Dealer portal test listings leaked into saved search alerts because
-- the `source = 'dealer'` filter was missing from 15+ query paths.
--
-- STRUCTURAL FIX: Replace the existing `listings_public_read` RLS policy
-- (which uses USING(true) — allows everything) with one that excludes
-- dealer portal listings. This protects ALL query paths at the database
-- level — including RPCs, future code, and anything else.
--
-- How it works:
-- - User-facing queries use anon/authenticated keys → RLS applies → no dealer listings
-- - Dealer portal APIs use service_role key → bypasses RLS → full access
-- - Admin/cron APIs use service_role key → bypasses RLS → full access
-- - Scraper (Oshi-scrapper) uses service_role key → bypasses RLS → can write normally
--
-- When NEXT_PUBLIC_DEALER_LISTINGS_LIVE goes true, update this policy to
-- USING (true) again or add source-specific logic.
-- ============================================================================

-- Drop the old "allow everything" policy (from migration 012)
DROP POLICY IF EXISTS listings_public_read ON listings;

-- New policy: allow SELECT on all listings EXCEPT source = 'dealer'
-- IS DISTINCT FROM handles NULL correctly (NULL source → not 'dealer' → allowed)
CREATE POLICY listings_public_read ON listings
    FOR SELECT
    USING (source IS DISTINCT FROM 'dealer');

COMMENT ON POLICY listings_public_read ON listings IS
    'Allow public read access to all listings except dealer portal submissions (source = dealer). Update this policy when dealer portal goes live.';
