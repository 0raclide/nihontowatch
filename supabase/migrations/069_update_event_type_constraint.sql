-- =============================================================================
-- Update activity_events event_type constraint for unified event pipeline
-- =============================================================================
-- Migration: 069_update_event_type_constraint.sql
-- Description: Adds listing_detail_view, search_click, dealer_click,
--              inquiry_copy, inquiry_mailto_click, listing_impression
--              to the allowed event types
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS check_event_type;

-- Add updated constraint with all event types
ALTER TABLE activity_events
ADD CONSTRAINT check_event_type
CHECK (event_type IN (
    'page_view',
    'listing_view',
    'listing_detail_view',
    'listing_impression',
    'search',
    'search_click',
    'filter_change',
    'favorite_add',
    'favorite_remove',
    'alert_create',
    'alert_delete',
    'external_link_click',
    'dealer_click',
    'viewport_dwell',
    'quickview_open',
    'quickview_panel_toggle',
    'image_pinch_zoom',
    'inquiry_copy',
    'inquiry_mailto_click'
));

-- Also add visitor_id column if not present (added in migration 047 but needed for fan-out)
-- This is a no-op if the column already exists
DO $$ BEGIN
    ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS visitor_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
