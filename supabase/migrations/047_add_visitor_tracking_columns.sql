-- Migration: 047_add_visitor_tracking_columns.sql
-- Purpose: Add visitor_id and ip_address columns to activity_events for proper visitor tracking
-- These columns were being used by the API but were missing from the schema migration

-- Add visitor_id column for persistent visitor identification
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- Add ip_address column for geo-location and analytics
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create index on visitor_id for efficient visitor-based queries
CREATE INDEX IF NOT EXISTS idx_activity_events_visitor_id ON activity_events(visitor_id);

-- Create index on ip_address for geo-based analysis
CREATE INDEX IF NOT EXISTS idx_activity_events_ip_address ON activity_events(ip_address);

-- Add comment explaining the columns
COMMENT ON COLUMN activity_events.visitor_id IS 'Persistent visitor ID generated on client-side (vis_<timestamp>_<random>)';
COMMENT ON COLUMN activity_events.ip_address IS 'Client IP address extracted from request headers for geo-location';
