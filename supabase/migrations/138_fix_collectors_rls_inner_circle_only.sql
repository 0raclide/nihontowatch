-- Fix: Yuhinkai (collectors) visibility is inner_circle only.
-- Previously allowed all paid tiers — now restricted to inner_circle.
DROP POLICY IF EXISTS ci_collectors_read ON collection_items;

CREATE POLICY ci_collectors_read ON collection_items
  FOR SELECT USING (
    visibility = 'collectors'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier = 'inner_circle'
    )
  );
