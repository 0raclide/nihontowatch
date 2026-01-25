-- =============================================================================
-- Add viewport_dwell to activity_events event_type constraint
-- =============================================================================
-- Migration: 042_add_viewport_dwell_event_type.sql
-- Description: Adds 'viewport_dwell' to the allowed event types for tracking
--              listing card visibility/dwell time in the browse page
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS check_event_type;

-- Add updated constraint with viewport_dwell
ALTER TABLE activity_events
ADD CONSTRAINT check_event_type
CHECK (event_type IN (
    'page_view',
    'listing_view',
    'search',
    'filter_change',
    'favorite_add',
    'favorite_remove',
    'alert_create',
    'alert_delete',
    'external_link_click',
    'viewport_dwell'
));

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON CONSTRAINT check_event_type ON activity_events IS
'Validates event types. viewport_dwell tracks time users spend viewing listing cards in browse grid.';
