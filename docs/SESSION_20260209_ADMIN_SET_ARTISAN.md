# Session: Admin "Set Artisan" Widget in QuickView
**Date:** February 9, 2026

## Summary

Added an admin-only UI for manually assigning artisan codes to listings that lack automated matches. Also wired up ArtisanTooltip edit pens on artisan badges in QuickView for quick corrections.

---

## What Was Built

### 1. AdminArtisanWidget (new component)

**File:** `src/components/artisan/AdminArtisanWidget.tsx`

A collapsible admin panel rendered in QuickView, styled identically to `AdminSetsumeiWidget` (gold dashed border, gear icon, uppercase label). Collapsed by default.

**Header status badge:**
- Green with display name when artisan is assigned
- Gray "None" when no artisan

**Expanded behavior:**
- Search input with 300ms debounce → `/api/artisan/search`
- Auto-detects search type from listing `item_type` (`smith` for blades, `tosogu` for fittings, `all` if unknown)
- Results show: code, kanji/romaji name, generation, school, province, Juyo/Tokuju counts
- Click result → POST `/api/listing/{id}/fix-artisan` with `confidence: 'HIGH'`
- On success: shows confirmation, calls `onArtisanChanged()` → `refreshCurrentListing()` → badge appears in header

**Note:** "Remove artisan" was considered but omitted — the fix-artisan API validates artisan_id as non-empty string. Removal can be done through ArtisanTooltip's existing "incorrect" flow.

### 2. ArtisanTooltip Edit Pen on QuickView Badges

**Files:** `QuickViewContent.tsx`, `QuickViewMobileSheet.tsx`

Admin users now see a small pencil icon next to artisan badges in both desktop and mobile QuickView. Clicking it opens the full ArtisanTooltip with correction search, verification buttons, and artisan details — same experience as on browse grid cards.

Non-admin users see the badge as a plain link to `/artists/{code}` (unchanged).

### 3. Listing Type Extensions

**File:** `src/types/index.ts`

Added fields to `Listing` interface needed by ArtisanTooltip in QuickView context:
- `artisan_method?: string | null`
- `artisan_candidates?: Array<{...}> | null`
- `artisan_verified?: 'correct' | 'incorrect' | null`

### 4. ArtisanListings Status Prop

**File:** `src/components/artisan/ArtisanListings.tsx`

Added `status` prop (`'available' | 'sold'`) to control the "View all" link destination. Defaults to `'available'`. The link text now reads "Browse all for sale by..." or "Browse sold archive for..." accordingly.

### 5. Artist Page Link Fix

**File:** `src/app/artists/[slug]/ArtistPageClient.tsx`

Browse CTA link now includes `&tab=all` and uses shorter "Browse all listings" text.

---

## APIs Used (no changes needed)

| API | Method | Purpose |
|-----|--------|---------|
| `/api/artisan/search?q=...&type=...&limit=10` | GET | Admin-only artisan search |
| `/api/listing/[id]/fix-artisan` | POST | Assign artisan_id with confidence |
| `/api/listing/[id]?nocache=1` | GET | Refresh listing data after assignment |

---

## How It Works End-to-End

1. Admin opens QuickView on a listing without an artisan badge
2. Sees "Admin: Set Artisan" widget with "None" badge (below Yuhinkai Connection widget)
3. Expands widget, types artisan name/school/code
4. 300ms debounce triggers search filtered by item type
5. Clicks correct result → fix-artisan API called
6. `refreshCurrentListing()` fetches updated listing with new `artisan_id`, `artisan_confidence`, `artisan_display_name`
7. Badge appears in QuickView header automatically (existing rendering logic)
8. Badge also propagates to browse grid card via QuickView listings array update

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/components/artisan/AdminArtisanWidget.tsx` | Created | 284 |
| `src/components/listing/QuickViewContent.tsx` | Modified | +71/-14 |
| `src/components/listing/QuickViewMobileSheet.tsx` | Modified | +63/-17 |
| `src/types/index.ts` | Modified | +12 |
| `src/components/artisan/ArtisanListings.tsx` | Modified | +8/-3 |
| `src/app/artists/[slug]/ArtistPageClient.tsx` | Modified | +2/-2 |

---

## Commit

`725d4b7` — `feat: Admin "Set Artisan" widget in QuickView + artisan tooltip edit pen`

Deployed to production via Vercel auto-deploy on push to main.
