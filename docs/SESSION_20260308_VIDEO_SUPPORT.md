# Session: Dealer Video Upload & Playback

**Date:** 2026-03-08
**Commits:** `5f43273` (video support + 6 fixes)
**Branch:** main (deployed to prod)
**Migrations:** 111 (`listing_videos` table), 112 (`video_count` denormalization + trigger)

---

## What This Does

Dealers can upload videos to their listings. Videos are stored on Bunny.net Stream, transcoded to HLS, and played back inline in listing detail pages, QuickView, and artist profile pages. A video count badge appears on ListingCard thumbnails.

---

## Architecture

```
Dealer uploads MP4
        │
        ▼
POST /api/dealer/videos  ──►  Bunny.net "Create Video"
        │                           │
        ▼                           ▼
   listing_videos row         TUS upload URL
   (status=processing)        + HMAC signature
        │                           │
        ▼                           ▼
   VideoUploadSection     tus-js-client uploads
   polls GET every 5s      direct to Bunny CDN
        │                           │
        ▼                           ▼
   GET /api/dealer/videos   Bunny transcodes video
   checks Bunny status             │
        │                          ▼
        │              POST /api/dealer/videos/webhook
        │              (Bunny callback → status=ready)
        │                          │
        ▼                          ▼
   UI shows thumbnail     Trigger: listing.video_count++
   + playable video        (migration 112)
```

**Key design decisions:**
- **TUS protocol** for resumable uploads (handles large files, network interruptions)
- **Bunny.net Stream** for transcoding + HLS delivery (no self-hosted ffmpeg)
- **Denormalized `video_count`** on `listings` table — browse API reads a plain column instead of joining `listing_videos` per row (eliminates N+1 sub-queries)
- **Shared Bunny library** with oshi-v2 — both apps use library `573856`. Webhooks for unknown video IDs are silently ignored.

---

## Database

### `listing_videos` table (migration 111)

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
listing_id      INTEGER REFERENCES listings(id) ON DELETE CASCADE
provider        TEXT DEFAULT 'bunny'
provider_id     TEXT          -- Bunny video GUID
duration_seconds INTEGER
width           INTEGER
height          INTEGER
thumbnail_url   TEXT
status          TEXT          -- 'processing' | 'ready' | 'failed'
sort_order      INTEGER DEFAULT 0
original_filename TEXT
size_bytes      BIGINT
created_by      UUID REFERENCES auth.users(id)
created_at      TIMESTAMPTZ DEFAULT now()
```

Indexes: `listing_id` (FK lookup), `provider_id` (webhook lookup).

### `listings.video_count` column (migration 112)

`INTEGER NOT NULL DEFAULT 0` — maintained by Postgres trigger `trg_update_listing_video_count` that fires on INSERT/DELETE/UPDATE OF status on `listing_videos`. Recounts ready videos for the affected `listing_id`.

---

## API Routes

### `POST /api/dealer/videos`
**Auth:** Dealer only (verifyDealer)
**Body:** `{ listingId: number, filename: string }`
**Returns:** `{ videoId, providerId, uploadUrl, libraryId, authSignature, authExpire }`

Creates a Bunny video, inserts a `listing_videos` row (status=processing), returns TUS upload credentials. If DB insert fails, deletes the Bunny video (best-effort cleanup).

### `GET /api/dealer/videos?listingId=X`
**Auth:** Dealer only
**Returns:** `{ videos: ListingVideosRow[] }` (with `stream_url` enriched for ready videos)

Fetches all videos for a listing. For videos still in `processing` state, actively polls Bunny API and updates DB if status has changed. This is the "active polling" path used by `VideoUploadSection`.

### `DELETE /api/dealer/videos/[id]`
**Auth:** Dealer only

Deletes the Bunny video (awaited, Critical Rule #9), then deletes the DB row.

### `POST /api/dealer/videos/webhook`
**Auth:** None (Bunny webhook)
**Body:** `{ VideoId: string, Status: number }` (Bunny format)

Maps Bunny status codes (4=finished→ready, 5/6=error→failed) and updates the DB row. On status=ready, fetches full metadata (duration, dimensions, thumbnail). The trigger on `listing_videos` then increments `listings.video_count`.

---

## Display Integration

### ListingCard (browse grid)
`src/components/browse/ListingCard.tsx` — Shows video count badge (camera icon + count) in bottom-left of thumbnail when `listing.video_count > 0`. Badge reads the denormalized column — no video data needed at the card level.

### ListingDetailClient (listing detail page)
`src/app/listing/[id]/ListingDetailClient.tsx` — Uses **unified `MediaItem[]` array** via `getMediaItemsFromImages(validatedImages, listing.videos)`. Images appear first, then ready videos. Single thumbnail strip with play icon overlay on video thumbnails. Main display switches between `<Image>` and `<VideoGalleryItem>` based on `currentMedia.type`. Sold overlay only appears on image items.

### QuickView (browse overlay)
`src/components/listing/QuickView.tsx` — Appends `VideoGalleryItem` components after the image scroller for ready videos. Uses `getMediaItems(listing).filter(m => m.type === 'video')`.

### getListingDetail (server-side enrichment)
`src/lib/listing/getListingDetail.ts` — Joins `listing_videos` in the SELECT, filters to ready videos, sorts by `sort_order`, and enriches with `stream_url` from `videoProvider.getStreamUrl()`. The enriched `videos: ListingVideo[]` is part of `EnrichedListingDetail`.

### Artist pages
`src/app/api/artisan/[code]/listings/route.ts` — Includes `video_count` in SELECT, so ListingCard badges appear on artist profile listing grids.

### Favorites
`src/app/api/favorites/route.ts` — Includes `video_count` in nested listing SELECT.

---

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `VideoPlayer` | `src/components/video/VideoPlayer.tsx` | HLS.js player with Safari native fallback. Dynamic import (70KB not in main bundle). |
| `VideoThumbnail` | `src/components/video/VideoThumbnail.tsx` | Clickable thumbnail with play overlay, duration badge (M:SS), processing/failed states. |
| `VideoGalleryItem` | `src/components/video/VideoGalleryItem.tsx` | Two-state toggle: thumbnail → inline player on click. |
| `VideoUploadProgress` | `src/components/video/VideoUploadProgress.tsx` | TUS upload with progress bar, pause/resume/cancel, processing state. Dynamic tus-js-client import. |
| `VideoUploadSection` | `src/components/dealer/VideoUploadSection.tsx` | Dealer form section: existing video grid + upload zone + delete. Polls every 5s while processing. Disabled in "add" mode (no listing_id yet). |

---

## Typed Supabase Helpers

`src/lib/supabase/listingVideos.ts` — Centralizes all `as any` casts for the `listing_videos` table (not in generated Supabase types) behind typed wrappers:

- `insertListingVideo(client, row)` → `Promise<{ data: ListingVideosRow, error }>`
- `selectListingVideos(client, column, value, fields?, orderBy?)` → typed array
- `selectListingVideoSingle(client, column, value, fields?)` → typed single row
- `updateListingVideo(client, id, updates)` → update by ID
- `deleteListingVideo(client, id)` → delete by ID

All video API routes use these helpers — zero `as any` in the route files themselves.

---

## Environment Variables

```bash
BUNNY_STREAM_LIBRARY_ID=573856              # Shared with oshi-v2
BUNNY_STREAM_API_KEY=<redacted>             # Bunny Stream API key
BUNNY_STREAM_CDN_HOSTNAME=vz-abb611a8-a81.b-cdn.net  # Optional (falls back to default)
```

Set on Vercel production. `isVideoProviderConfigured()` gates all video functionality — if credentials are missing, upload returns 503 and display gracefully shows zero videos.

---

## Bunny Cleanup on Listing Delete

When a dealer deletes a listing (`DELETE /api/dealer/listings/[id]`), the handler:
1. Queries `listing_videos` for all `provider_id` values
2. Calls `videoProvider.deleteVideo()` for each (best-effort, `.catch()` swallows errors)
3. Proceeds with listing delete (CASCADE removes DB rows)

This prevents orphaned video files on Bunny when the DB rows are removed by CASCADE.

---

## Tests

| File | Count | What it covers |
|------|-------|----------------|
| `tests/lib/media.test.ts` | 17 | `getMediaItems`, `getMediaItemsFromImages`, `hasReadyVideos` — filtering, sorting, index assignment |
| `tests/lib/video-implementation.test.ts` | 14 | Golden structural tests: video_count in APIs, no listing_videos join, Bunny cleanup ordering, no `as any`, unified gallery |
| `tests/api/dealer/videos.test.ts` | ~8 | POST/DELETE auth, validation, access control |
| `tests/components/video/VideoGalleryItem.test.tsx` | 8 | Thumbnail→player toggle, processing/failed states, duration formatting |
| `tests/lib/video/videoProvider.test.ts` | 9 | URL generation, config check, error on missing credentials |

---

## Six Implementation Fixes (self-review)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Browse API joined `listing_videos` per row (N+1) | Denormalized `video_count` column + Postgres trigger (migration 112) |
| 2 | Dual-array gallery arithmetic in ListingDetailClient | Unified `MediaItem[]` via `getMediaItemsFromImages()` |
| 3 | Listing delete orphaned Bunny videos | Query + delete Bunny files before CASCADE |
| 4 | 16+ `as any` casts across video route files | `listingVideos.ts` typed helpers — zero casts in routes |
| 5 | Artist pages missing video badges | Added `video_count` to artisan + favorites API SELECTs |
| 6 | Videos not in draft persistence | Confirmed correct by design (upload requires listing_id) |

---

## Known Gaps / Future Work

- **No RLS policies** on `listing_videos` — currently uses service role key for all queries
- **No webhook authentication** — Bunny webhook endpoint is unauthenticated (consider `BUNNY_WEBHOOK_SECRET` header check)
- **No video SEO** — JSON-LD/meta tags don't include VideoObject schema
- **No video sitemap** — video URLs not in sitemap.xml
- **QuickView uses dual-array pattern** — still has `getMediaItems().filter(video)` appended after images (not unified like ListingDetailClient). Lower priority since QuickView doesn't have the same bounds-check issues.
- **No video in collection manager** — collection items don't support videos yet
