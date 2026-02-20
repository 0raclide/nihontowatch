-- Migration: 074_fix_dealer_favorite_stats.sql
-- Fix: Query user_favorites table instead of activity_events for dealer favorites.
-- The activity_events table only has 2 'favorite_add' events, while user_favorites has 175+ rows.

CREATE OR REPLACE FUNCTION get_dealer_favorite_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, favorites BIGINT) AS $$
  SELECT l.dealer_id, COUNT(*) AS favorites
  FROM user_favorites uf
  JOIN listings l ON uf.listing_id = l.id
  WHERE uf.created_at BETWEEN p_start AND p_end
  GROUP BY l.dealer_id;
$$ LANGUAGE sql SECURITY DEFINER;
