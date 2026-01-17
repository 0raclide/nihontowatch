-- =============================================================================
-- FIX: Allow service role to update listings for Wayback freshness checks
-- Migration: 017_allow_service_role_updates.sql
-- Description: Adds RLS policy to allow service_role to update listings table
--              This is required for the Wayback cron job to update freshness fields
-- =============================================================================

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS listings_service_role_update ON listings;

-- Create policy to allow service_role to update listings
-- The service role is used by server-side API routes (like cron jobs)
CREATE POLICY listings_service_role_update ON listings
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON POLICY listings_service_role_update ON listings IS
    'Allow service_role to update listings - required for Wayback freshness cron job';
