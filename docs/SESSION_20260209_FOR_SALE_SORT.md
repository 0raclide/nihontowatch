# Session: "For Sale" Sort Option on Artist Directory

**Date:** 2026-02-09

## Feature

Added a fourth sort option to the artist directory (`/artists`) that ranks artists by number of currently available listings. This lets collectors quickly find artists who have works they can actually buy right now.

## Challenge: Cross-Database Sort

The artist directory data lives in two separate databases:
- **Yuhinkai DB** — Artist metadata (name, school, province, era, certifications, elite_factor)
- **Main DB** — Listings (available inventory with `artisan_id` foreign key)

Existing sorts (Elite Factor, Total Works, Name) all operate on Yuhinkai columns, so the query is straightforward: filter → sort → paginate in one query.

"For Sale" count doesn't exist in Yuhinkai — it's derived from the listings table. This required a reversed query flow.

## Implementation

### Normal sort flow
```
Yuhinkai (filter + sort + paginate) → Main DB (get listing counts for page)
```

### "For Sale" sort flow
```
Main DB (get ALL available listing counts) → Yuhinkai (filter by those codes) → Sort by count → Paginate in JS
```

Steps:
1. Query all available listings grouped by `artisan_id` from the main database
2. Pass those artisan codes to Yuhinkai with all active filters (type, school, province, era, search, notable)
3. Sort matched artists by available count descending
4. Paginate the sorted result
5. Fetch percentiles for the page (same as other sorts)

Only artists with at least one available listing appear when this sort is active.

### Batched Yuhinkai Queries

The new `getFilteredArtistsByCodes()` function processes codes in batches of 200 to avoid URL length limits on Supabase `.in()` queries.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/supabase/yuhinkai.ts` | Added `'for_sale'` to `DirectoryFilters.sort` type; added `getFilteredArtistsByCodes()` function; added safeguard in `getArtistsForDirectory` so `for_sale` falls back to `elite_factor` column |
| `src/app/api/artists/directory/route.ts` | Added `'for_sale'` to sort whitelist; added special cross-DB flow for `for_sale` sort; added `getAllAvailableListingCounts()` helper |
| `src/app/artists/page.tsx` | Added `'for_sale'` to sort whitelist; mirrored cross-DB flow for SSR; added `getAllListingCounts()` helper |
| `src/app/artists/ArtistsPageClient.tsx` | Added `'for_sale'` to `Filters.sort` type; added "Sort: For Sale" dropdown option |

## URL Parameter

`/artists?sort=for_sale` — shareable, works with all other filters (type, school, province, era, search, notable).

## Performance Notes

- The number of distinct `artisan_id` values with available listings is bounded by total available inventory (typically hundreds, not thousands), so the cross-DB flow is fast
- Batching at 200 codes per Yuhinkai query keeps request sizes manageable
- Pagination happens in JS after the full sorted set is assembled, which is fine for the expected result set size
