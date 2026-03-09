# Session: Video Migration Phase 2b — `listing_videos` → `item_videos`

**Date:** 2026-03-09
**Status:** Complete
**Design doc:** `docs/DESIGN_UNIFIED_COLLECTION.md` (Phase 2b section)
**Depends on:** Phase 2a (migrations 119-124, `item_uuid` backfill)
**Next phase:** Phase 2c (collection API + form wiring) or Phase 2d (DisplayItem + "All Items" tab)

---

## What Was Done

Migrated all video data from the old `listing_videos` table (keyed by `listing_id`) to the new `item_videos` table (keyed by `item_uuid`). This enables videos to survive promote/delist cycles in the unified collection system, since `item_uuid` is stable across table transitions.

### SQL Migration (125)

| Step | Action |
|------|--------|
| 1 | Copy all `listing_videos` rows → `item_videos` via JOIN on `listings` for `item_uuid` + `owner_id` |
| 2 | Drop old trigger on `listing_videos` |
| 3 | Rewrite `update_listing_video_count()` to count from `item_videos WHERE item_uuid = X` |
| 4 | Create new trigger on `item_videos` (fires on INSERT/DELETE/UPDATE OF status) |
| 5 | Verify row counts (safety check) |
| 6 | Drop `listing_videos` table |

Migration is idempotent (skips existing rows via `NOT EXISTS`). Preserves original UUIDs for traceability.

### API Route Updates

| Route | Key change |
|-------|-----------|
| `POST /api/dealer/videos` | Resolves `item_uuid` from listing, inserts into `item_videos` with `item_uuid` + `owner_id` |
| `GET /api/dealer/videos?listingId=X` | Resolves `item_uuid`, queries `item_videos` by `item_uuid` |
| `DELETE /api/dealer/videos/[id]` | Queries `item_videos`, ownership check via `owner_id` (no listing roundtrip) |
| `POST /api/dealer/videos/webhook` | Looks up `item_videos` by `provider_id`, stores `stream_url` on ready |
| `DELETE /api/dealer/listings/[id]` | Bunny cleanup queries `item_videos` by `item_uuid`, explicit delete (no CASCADE) |

**API contract preserved**: Client-facing parameters unchanged (still `listingId`). All resolution happens server-side. No UI changes needed.

### Code Updates

| File | Change |
|------|--------|
| `getListingDetail.ts` | Removed `listing_videos (...)` nested select. Added `item_uuid` to SELECT. Separate query on `item_videos` by `item_uuid`. |
| `itemVideos.ts` | Added `selectItemVideoSingle()` (needed by webhook) |
| `media.ts` | Removed `ListingVideosRow`, re-exported `ItemVideoRow` from `collectionItem.ts` |
| `collectionItems.ts` | Updated comment reference |

### Deleted

| File | Reason |
|------|--------|
| `src/lib/supabase/listingVideos.ts` | Replaced by `itemVideos.ts` |
| `listing_videos` table | Dropped in migration 125 |

---

## Key Design Decisions

1. **API routes still accept `listingId`** — no UI changes needed. The route resolves `item_uuid` from the listing internally. Phase 2c will add `itemUuid` as an alternative param for collection items.

2. **`getListingDetail()` does a separate query** — `item_videos` has no FK to `listings`, so PostgREST nested select doesn't work. A separate `selectItemVideos()` call by `item_uuid` is the correct pattern.

3. **`stream_url` cached in DB** — the webhook now stores `stream_url` when status becomes ready (new column in `item_videos`). `getListingDetail()` falls back to computing it from `videoProvider.getStreamUrl()` for migrated rows where `stream_url` is NULL.

4. **Ownership via `owner_id` directly** — DELETE /api/dealer/videos/[id] checks `video.owner_id === auth.user.id` instead of the old listing→dealer_id roundtrip. Simpler and correct by construction.

5. **Trigger uses `item_uuid` for listing lookup** — `UPDATE listings SET video_count = (SELECT count(*) FROM item_videos WHERE item_uuid = X) WHERE item_uuid = X`. If no listing exists for the `item_uuid` (e.g., collection-only item), the UPDATE affects 0 rows (safe no-op).

---

## Verification

- `tsc --noEmit` — zero type errors
- Golden tests — 46/46 pass (33 video implementation + 5 API + 8 videoProvider)
- Full test suite — 5209/5209 pass, 0 new failures
- Zero remaining references to `listing_videos`, `listingVideos`, or `ListingVideosRow` in production code

---

## Deployment (2026-03-09)

- **Committed:** `4ba6149` (code) + `a20e34f` (migration SQL + doc)
- **Pushed:** to `origin/main`
- **Migration 125 applied:** `supabase db push --include-all` — applied cleanly
  - NOTICE: `trigger "trg_update_item_video_count" does not exist, skipping` (harmless `DROP IF EXISTS` guard)
- **Prod verification:**
  - `item_videos` rows: 2 (both migrated from `listing_videos`)
  - `item_uuid` linkage: correct (`c21d2691...` matches listing)
  - `listing_videos` table: functionally gone (empty/inaccessible via PostgREST)
  - Video playback: working (HLS delivery via Bunny CDN)
  - `video_count` trigger: active on `item_videos` (fires on INSERT/DELETE/UPDATE OF status)
- **Full test suite:** 5,209/5,209 pass, build clean

---

## Files Created

```
supabase/migrations/125_migrate_listing_videos_to_item_videos.sql
docs/SESSION_20260309_VIDEO_MIGRATION_PHASE_2B.md
```

## Files Modified

```
src/app/api/dealer/videos/route.ts          (listing_videos → item_videos)
src/app/api/dealer/videos/[id]/route.ts     (listing_videos → item_videos)
src/app/api/dealer/videos/webhook/route.ts  (listing_videos → item_videos, + stream_url)
src/app/api/dealer/listings/[id]/route.ts   (Bunny cleanup → item_videos by item_uuid)
src/lib/listing/getListingDetail.ts         (removed nested select, separate item_videos query)
src/lib/supabase/itemVideos.ts              (+ selectItemVideoSingle)
src/types/media.ts                          (removed ListingVideosRow, re-export ItemVideoRow)
src/lib/supabase/collectionItems.ts         (comment update)
tests/lib/video-implementation.test.ts      (rewritten for item_videos, 33 tests)
```

## Files Deleted

```
src/lib/supabase/listingVideos.ts           (replaced by itemVideos.ts)
```
