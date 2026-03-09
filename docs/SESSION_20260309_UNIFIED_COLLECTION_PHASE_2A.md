# Session: Unified Collection Phase 2a — Database Foundation

**Date:** 2026-03-09
**Status:** Complete
**Design doc:** `docs/DESIGN_UNIFIED_COLLECTION.md`
**Next phase:** Phase 2b (Video migration `listing_videos` → `item_videos`)

---

## What Was Done

Phase 2a creates the database infrastructure for the unified collection system. Zero API or UI changes. Zero behavior changes to existing functionality.

### SQL Migrations (119–124)

| Migration | Purpose | Risk |
|-----------|---------|------|
| `119_listing_item_uuid_owner.sql` | Add `item_uuid` (UUID UNIQUE) and `owner_id` (FK auth.users) to `listings`. Both nullable — NULL for scraped listings. Partial indexes on non-NULL values. | Low — additive nullable columns |
| `120_collection_items.sql` | Create `collection_items` table with 56 shared item-data columns + collection-only fields (`visibility`, `source_listing_id`, `personal_notes`). Column types precisely match `listings` (REAL for height_cm/width_cm per migration 099, TEXT for cert_session). Reuses `update_collection_updated_at()` trigger from migration 057. | Low — new table, nothing reads it |
| `121_collection_events.sql` | Create `collection_events` audit log. No FKs to either table — `item_uuid` is a soft reference so audit trail survives deletion. Event types: created, updated, promoted, delisted, sold, deleted. | Low — new table |
| `122_item_videos.sql` | Create `item_videos` table keyed by `item_uuid` (no FK). Mirrors `listing_videos` but adds `stream_url` and `updated_at`. No `listing_id` column. | Low — new table, populated in Phase 2b |
| `123_collection_rls.sql` | RLS policies on all 3 new tables. Owner full CRUD + service role bypass. | Low — RLS on new tables |
| `124_backfill_dealer_item_uuid.sql` | Backfill `owner_id` (from `profiles.dealer_id` → `profiles.id`) then `item_uuid` (gen_random_uuid) for all `source='dealer'` listings. Both idempotent (WHERE IS NULL). | Medium — UPDATE on listings, but no existing trigger reacts to these columns |

### TypeScript Types

| File | Purpose |
|------|---------|
| `src/types/itemData.ts` | `ItemDataFields` interface (56 shared fields). `SHARED_COLUMNS`, `LISTING_ONLY_COLUMNS`, `COLLECTION_ONLY_COLUMNS` const arrays for golden test. |
| `src/types/collectionItem.ts` | `CollectionItemRow` extends `ItemDataFields` + identity/collection fields. `CollectionEvent` type. `ItemVideoRow` type. Named `CollectionItemRow` to avoid collision with existing `CollectionItem` in `src/types/collection.ts`. |

### Typed Supabase Helpers

| File | Purpose |
|------|---------|
| `src/lib/supabase/collectionItems.ts` | `collectionItemsFrom()`, `collectionEventsFrom()`, + CRUD wrappers. Follows `listingVideos.ts` pattern — centralizes `as any` casts. |
| `src/lib/supabase/itemVideos.ts` | `itemVideosFrom()` + CRUD wrappers. |

### Listing Type Changes

- `ListingStatus` gains `| 'DELISTED' | 'HOLD'`
- `Listing` interface gains `item_uuid?: string | null` and `owner_id?: string | null`

### Golden Test

`tests/lib/collection-schema-sync.test.ts` — **140 tests**:
- All 56 shared columns present in SQL migration
- All 56 shared fields present in `ItemDataFields` TS interface
- `LISTING_ONLY`, `COLLECTION_ONLY`, `SHARED` column sets don't overlap
- Structural invariants on each migration (UUID PK, FK constraints, indexes, trigger reuse)
- Backfill migration safety (owner_id before item_uuid, dealer-only filter, idempotent)

---

## Verification

- `tsc --noEmit` — zero type errors
- Golden test — 140/140 pass
- Full test suite — 5189 pass, 0 new failures (1 pre-existing flaky: LoginModal timing)

---

## Key Design Decisions Made During Implementation

1. **`cert_session` is TEXT** in `collection_items` (matches DB schema), even though the `Listing` TS type has it as `number`. The DB actually stores it as TEXT — the TS type is slightly off but we match the actual DB.

2. **`collection_items` does NOT have `price_raw`** — intentionally excluded. Collection items will have `price_value`/`price_currency` (structured) but not the raw dealer price string.

3. **`item_videos` has NO FK on `item_uuid`** — the item may be in either table at any point. Owner deletion cascades from `auth.users` via `owner_id` FK.

4. **Backfill order matters**: `owner_id` first (needs profile lookup), then `item_uuid` (unconditional gen_random_uuid). If reversed, `item_uuid` would be set but `owner_id` might fail silently.

5. **`collection_events.payload`** uses generic JSONB (not typed snapshot columns like the design doc's `item_title`, `item_type`, `price_value`, `price_currency`). Simpler schema — event-specific data goes in the `payload` object. The design doc RPCs can populate these at call time.

---

## Deployment (2026-03-09)

- **Committed:** `31792aa` — 13 files, 2,774 insertions
- **Pushed:** to `origin/main`
- **Migrations applied:** `supabase db push --include-all` — all 6 migrations (119-124) applied cleanly
- **Prod verification:**
  - `listings` with `item_uuid`: 6/6 dealer listings backfilled
  - `listings` with `owner_id`: 6/6 dealer listings backfilled
  - `collection_items` table: exists, empty (ready for Phase 2c)
  - `collection_events` table: exists (audit log ready)
  - `item_videos` table: exists (populated in Phase 2b)
  - All existing queries, cron jobs, and APIs unaffected (new columns are nullable)

---

## Phase 2b: Next Steps

**Depends on:** This phase (2a) — needs `item_uuid` backfilled on dealer listings.

**Scope:** Migrate all video data from `listing_videos` → `item_videos`:

1. SQL migration to copy `listing_videos` rows → `item_videos` (JOIN with `listings` for `item_uuid` + `owner_id`)
2. Rewrite `listings.video_count` trigger to count from `item_videos`
3. Update Bunny webhook to write to `item_videos`
4. Update video upload/delete routes
5. Update `listingVideos.ts` → `itemVideos.ts`
6. Update `getListingDetail()` to join `item_videos` by `item_uuid`
7. Golden test: migrated data matches original
8. Drop `listing_videos` table

**Independent of 2b (can run in parallel):**
- Phase 2c: Storage bucket + collection API + form wiring
- These both depend on 2a but are independent of each other

---

## Files Created

```
supabase/migrations/119_listing_item_uuid_owner.sql
supabase/migrations/120_collection_items.sql
supabase/migrations/121_collection_events.sql
supabase/migrations/122_item_videos.sql
supabase/migrations/123_collection_rls.sql
supabase/migrations/124_backfill_dealer_item_uuid.sql
src/types/itemData.ts
src/types/collectionItem.ts
src/lib/supabase/collectionItems.ts
src/lib/supabase/itemVideos.ts
tests/lib/collection-schema-sync.test.ts
```

## Files Modified

```
src/types/index.ts  (ListingStatus + Listing interface)
```
