-- =============================================================================
-- 133: Drop V1 Collection Tables
-- =============================================================================
-- The old user_collection_items and user_collection_folders tables from
-- migration 057 are no longer referenced by any code. The unified collection
-- system (collection_items + collection_events, migrations 119-130) replaced
-- them entirely. Dropping these dead tables.

-- Drop items first (has FK to folders)
DROP TABLE IF EXISTS public.user_collection_items CASCADE;
DROP TABLE IF EXISTS public.user_collection_folders CASCADE;

-- NOTE: Do NOT drop update_collection_updated_at() — it is still used by
-- collection_items.trg_ci_updated (migration 120, line 132).
