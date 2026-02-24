# Smart Crop Focal Points

## Overview

Listing card thumbnails use AI-detected focal points to crop images at the most visually important area instead of defaulting to center-center. This is especially valuable for sword images (long, narrow subjects) and tosogu detail shots where the subject is often off-center.

**Technology:** `smartcrop-sharp` — uses edge detection, face detection, and saturation analysis to find the optimal crop region for a given target aspect ratio.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SMART CROP PIPELINE                          │
│                                                                 │
│  Scraper writes listing          Cron (every 4h at :30)        │
│  images column populated         or backfill script             │
│  focal_x/focal_y = NULL                │                        │
│        │                               ▼                        │
│        │                    ┌────────────────────┐             │
│        │                    │  Download image    │             │
│        │                    │  Resize to 512px   │             │
│        │                    │  smartcrop.crop()   │             │
│        │                    │  (3:4 target)       │             │
│        │                    └────────┬───────────┘             │
│        │                             │                          │
│        │                             ▼                          │
│        │                    ┌────────────────────┐             │
│        │                    │  Store focal_x,    │             │
│        │                    │  focal_y (0-100%)  │             │
│        │                    └────────┬───────────┘             │
│        │                             │                          │
│        ▼                             ▼                          │
│  ┌──────────────────────────────────────────────┐              │
│  │              Browse API                       │              │
│  │  SELECT ... focal_x, focal_y FROM listings   │              │
│  └───────────────────┬──────────────────────────┘              │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────┐              │
│  │         VirtualListingGrid                    │              │
│  │  smartCropEnabled = prop ?? isSmartCropActive()│             │
│  │  focalPosition = `${focal_x}% ${focal_y}%`   │              │
│  └───────────────────┬──────────────────────────┘              │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────┐              │
│  │         ListingCard                           │              │
│  │  <Image style={{ objectPosition: focalPos }}> │              │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │         Image Change → Trigger               │              │
│  │  BEFORE UPDATE: if images changed,            │              │
│  │  NULL focal_x/focal_y → cron recomputes      │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database

### Columns (`listings` table)

```sql
focal_x REAL  -- Smart crop focal X (0-100%). NULL = not yet computed.
focal_y REAL  -- Smart crop focal Y (0-100%). NULL = not yet computed.
```

- Migration: `supabase/migrations/078_focal_point.sql`
- Index: `idx_listings_focal_point` on `(id) WHERE focal_x IS NOT NULL`

### Invalidation Trigger

When `images` or `stored_images` changes on a listing, a BEFORE UPDATE trigger automatically NULLs `focal_x`/`focal_y`. This ensures stale focal points are recomputed on the next cron run.

- Migration: `supabase/migrations/080_focal_point_invalidation.sql`
- Pattern: Same as `036_price_jpy_trigger.sql` — BEFORE UPDATE with WHEN clause for efficiency

```sql
CREATE TRIGGER trigger_invalidate_focal_point
  BEFORE UPDATE ON listings
  FOR EACH ROW
  WHEN (
    OLD.images IS DISTINCT FROM NEW.images OR
    OLD.stored_images IS DISTINCT FROM NEW.stored_images
  )
  EXECUTE FUNCTION invalidate_focal_point();
```

---

## Computation

### Cron Job

**Route:** `src/app/api/cron/compute-focal-points/route.ts`
**Schedule:** `30 */4 * * *` (every 4 hours at :30, offset from featured-scores at :00)
**Timeout:** 300s (5 min)
**Cap:** 500 listings per run

**Logic:**
1. Query listings WHERE `focal_x IS NULL` AND `images IS NOT NULL` (paginated, PAGE_SIZE=200)
2. For each listing: get first image URL (prefer `stored_images[0]`, fall back to `images[0]`)
3. Download image (10s timeout), resize to max 512px via `sharp`
4. Run `smartcrop.crop()` with 3:4 target aspect (matching card thumbnail proportions)
5. Convert crop center to percentage: `centerX = (crop.x + crop.width/2) / analysisWidth * 100`
6. Batch update `focal_x`, `focal_y` in Supabase (batches of 50, all `await`ed)

**Auth:** `verifyCronAuth()` — requires `CRON_SECRET` (same as all cron routes)

### Backfill Script

**Path:** `scripts/backfill-focal-points.ts`
**Run:** `npx tsx scripts/backfill-focal-points.ts`

**Options:**
| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would be processed without writing to DB |
| `--limit N` | Process at most N listings |
| `--dealer "Name"` | Only process listings from a specific dealer |
| `--recompute` | Re-process listings that already have focal points |

**Differences from cron:** No cap, CLI args, higher concurrency (5 workers), no auth needed (uses service role key directly).

---

## Frontend

### Prop Flow

```
HomeClient
  ├── smartCropEnabled state (localStorage: 'nihontowatch-smart-crop', default: true)
  ├── handleSmartCropChange callback
  │
  ├──→ FilterSidebar (panelControls.smartCropEnabled + onSmartCropChange)
  │    └── Toggle switch UI (admin-only, in Zone 1 panel controls)
  │
  └──→ ListingGrid (smartCropEnabled prop)
       └──→ VirtualListingGrid (smartCropEnabled prop)
            │   const smartCropEnabled = prop ?? isSmartCropActive()
            │   // Evaluates ONCE per grid render, not per card
            │
            └──→ ListingCard (focalPosition prop)
                 │   focalPosition={smartCropEnabled && focal_x != null && focal_y != null
                 │     ? `${focal_x}% ${focal_y}%` : undefined}
                 │
                 └── <Image style={{ objectPosition: focalPosition }} />
```

### Feature Flag

```typescript
// src/types/subscription.ts
export const isSmartCropActive = (): boolean => {
  return process.env.NEXT_PUBLIC_SMART_CROP !== 'false';
};
```

- Default: **ON** (env var not set or any value other than `'false'`)
- To disable globally: set `NEXT_PUBLIC_SMART_CROP=false` in Vercel env vars
- Admin toggle overrides this per-session via localStorage

### Admin Toggle

Visible only to admin users in the FilterSidebar panel controls (desktop, Zone 1). A simple on/off switch that:
1. Reads from localStorage key `nihontowatch-smart-crop` (default: `'true'`)
2. Passes `smartCropEnabled` prop down through ListingGrid → VirtualListingGrid
3. VirtualListingGrid uses `smartCropEnabledProp ?? isSmartCropActive()` — prop takes precedence
4. Allows instant A/B comparison of smart crop vs center-center

Non-admin users don't see the toggle and always get the env var default.

### Performance Note

The `isSmartCropActive()` call was originally inside ListingCard (evaluating `process.env` on each of 100 cards per render). It was moved to VirtualListingGrid to evaluate once per grid render. The computed `focalPosition` string is passed as a prop.

---

## Key Files

| Component | Location | Purpose |
|-----------|----------|---------|
| **Cron job** | `src/app/api/cron/compute-focal-points/route.ts` | Batch compute focal points for new/invalidated listings |
| **Backfill script** | `scripts/backfill-focal-points.ts` | One-shot bulk processing with CLI flags |
| **Feature flag** | `src/types/subscription.ts` | `isSmartCropActive()` reads `NEXT_PUBLIC_SMART_CROP` env var |
| **Grid (compute)** | `src/components/browse/VirtualListingGrid.tsx` | Computes `focalPosition` string per-listing, passes as prop |
| **Card (render)** | `src/components/browse/ListingCard.tsx` | Receives `focalPosition` prop, applies as `objectPosition` style |
| **Admin toggle** | `src/components/browse/FilterSidebar.tsx` | Toggle switch in PanelControls (admin-only) |
| **Toggle state** | `src/app/HomeClient.tsx` | `smartCropEnabled` localStorage state + handler |
| **Pass-through** | `src/components/browse/ListingGrid.tsx` | Props relay from HomeClient to VirtualListingGrid |
| **DB columns** | `supabase/migrations/078_focal_point.sql` | `focal_x REAL, focal_y REAL` on listings |
| **Invalidation** | `supabase/migrations/080_focal_point_invalidation.sql` | BEFORE UPDATE trigger NULLs on image change |
| **Cron schedule** | `vercel.json` | `"30 */4 * * *"` — every 4h at :30 |

---

## Common Tasks

### "Focal points aren't showing for new listings"
1. Check if `focal_x` is NULL: `SELECT id, focal_x FROM listings WHERE id = <id>`
2. If NULL, the cron hasn't run yet (runs every 4h). Manually trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://nihontowatch.com/api/cron/compute-focal-points`
3. If the image isn't downloadable (404, timeout), the cron skips it

### "A listing has wrong focal point after image change"
1. The trigger should have NULLed focal_x/focal_y when images changed
2. Verify: `SELECT id, focal_x, images FROM listings WHERE id = <id>`
3. If focal_x is still set, the trigger may not have fired (check if `images` column actually changed)
4. Manual fix: `UPDATE listings SET focal_x = NULL, focal_y = NULL WHERE id = <id>`

### "I want to recompute all focal points"
```bash
npx tsx scripts/backfill-focal-points.ts --recompute
```

### "I want to test focal points for a specific dealer"
```bash
npx tsx scripts/backfill-focal-points.ts --dealer "Aoi Art" --dry-run
npx tsx scripts/backfill-focal-points.ts --dealer "Aoi Art" --limit 50
```

### "Smart crop looks worse than center-center for certain listings"
This is expected for some images (e.g., full-sword photos where smartcrop picks the handle). The admin toggle lets you compare visually. Future improvements could include per-item-type tuning or confidence scoring.

---

## Design Decisions

1. **3:4 target aspect ratio** — Matches the card thumbnail proportions. smartcrop needs a target aspect to determine the optimal crop region.

2. **512px max analysis size** — Smartcrop is O(n) on pixel count. Resizing to 512px max makes analysis 10-50x faster with negligible quality difference.

3. **Cron at :30 offset** — Avoids competing with featured-scores cron at :00 for database and CPU resources.

4. **500 listing cap per cron** — Stays well within 5-minute Vercel serverless timeout. At ~0.5s/listing download+analyze, 500 takes ~4 minutes.

5. **BEFORE UPDATE trigger** — Modifies the NEW row in-place (no extra write). More efficient than AFTER UPDATE + separate UPDATE statement.

6. **Admin toggle via localStorage** — No API calls, instant switching, persists across page loads. Doesn't affect other users.

7. **Prop override pattern** — `smartCropEnabledProp ?? isSmartCropActive()` lets the admin toggle override the env var without changing global config.
