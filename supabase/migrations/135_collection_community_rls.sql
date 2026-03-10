-- Phase 6a: RLS policies for community visibility on collection_items
--
-- Two new SELECT policies allow authenticated users to read other users'
-- collection items based on visibility level and subscription tier.

-- Collectors visibility: any authenticated user with collection_access tier
CREATE POLICY ci_collectors_read ON collection_items
  FOR SELECT USING (
    visibility = 'collectors'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier IN ('yuhinkai','enthusiast','collector','inner_circle','dealer')
    )
  );

-- Dealers visibility: dealer + inner_circle only
CREATE POLICY ci_dealers_read ON collection_items
  FOR SELECT USING (
    visibility = 'dealers'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier IN ('dealer','inner_circle')
    )
  );
