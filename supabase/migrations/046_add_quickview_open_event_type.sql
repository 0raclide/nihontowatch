-- =============================================================================
-- Add quickview_open and related event types to activity_events constraint
-- =============================================================================
-- Migration: 046_add_quickview_open_event_type.sql
-- Description: Adds 'quickview_open', 'quickview_panel_toggle', and 'image_pinch_zoom'
--              to the allowed event types for dealer analytics tracking fix
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS check_event_type;

-- Add updated constraint with new event types
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
    'viewport_dwell',
    'quickview_open',
    'quickview_panel_toggle',
    'image_pinch_zoom'
));

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON CONSTRAINT check_event_type ON activity_events IS
'Validates event types. quickview_open tracks when users click listing cards to open QuickView.
external_link_click tracks actual dealer site visits via "View on dealer" button.';
