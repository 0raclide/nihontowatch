-- Fix: Galleries (dealers) visibility is dealer-tier only.
-- Inner circle members are Yuhinkai members, not galleries.
DROP POLICY IF EXISTS ci_dealers_read ON collection_items;

CREATE POLICY ci_dealers_read ON collection_items
  FOR SELECT USING (
    visibility = 'dealers'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier = 'dealer'
    )
  );
