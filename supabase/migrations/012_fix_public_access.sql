-- =============================================================================
-- FIX: Ensure public read access for listings and dealers tables
-- Migration: 012_fix_public_access.sql
-- Description: Adds RLS policies to allow anonymous users to read listings
--              and dealers. This fixes the bug where unauthenticated users
--              see zero results because RLS was blocking their access.
-- =============================================================================

-- =============================================================================
-- LISTINGS TABLE - Public Read Access
-- =============================================================================

-- First, ensure RLS is enabled (idempotent)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if it exists (for idempotency)
DROP POLICY IF EXISTS listings_public_read ON listings;

-- Create policy to allow anyone (including anonymous users) to read listings
CREATE POLICY listings_public_read ON listings
    FOR SELECT
    USING (true);

-- =============================================================================
-- DEALERS TABLE - Public Read Access
-- =============================================================================

-- First, ensure RLS is enabled (idempotent)
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if it exists (for idempotency)
DROP POLICY IF EXISTS dealers_public_read ON dealers;

-- Create policy to allow anyone (including anonymous users) to read dealers
CREATE POLICY dealers_public_read ON dealers
    FOR SELECT
    USING (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON POLICY listings_public_read ON listings IS
    'Allow public read access to all listings - the browse functionality requires anonymous users to see inventory';

COMMENT ON POLICY dealers_public_read ON dealers IS
    'Allow public read access to all dealers - required for displaying dealer information with listings';
