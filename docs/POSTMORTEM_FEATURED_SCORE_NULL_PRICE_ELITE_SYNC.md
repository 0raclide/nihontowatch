# Postmortem: Featured Score — NULL Price Damping & Missing Elite Factor Sync

**Date:** 2026-02-25
**Severity:** High — artisan stature silently zeroed for hundreds of listings
**Commit:** `e2062ae`

## Summary

Two independent bugs in the featured score system combined to zero out artisan stature for inquiry-based and school-matched listings. A Juyo Ichimonji blade (listing 67626) from Nihon Art scored 98 instead of ~333 — ranking #273 instead of near the top. The root causes were: (1) price damping treated NULL price as ¥0 (maximum suppression), and (2) the cron never synced `elite_factor`/`elite_count` from Yuhinkai for artisan-matched listings.

## Impact

- **Inquiry-based listings** ("Ask" / no listed price): Every listing matched to a real artisan but without a numeric price had its artisan stature multiplied by 0. These are typically the *most* valuable items — exactly the ones that should rank highest.
- **NS-\* school-matched listings** (e.g., NS-Ichimonji, NS-Soshu): The Oshi-scrapper writes `artisan_id` but not elite columns. Since the cron never synced from Yuhinkai, these stayed NULL forever → treated as 0 stature.
- **Combined effect on listing 67626**: NS-Ichimonji (elite_factor=0.3087, elite_count=70) + NULL price = 0 artisan stature. Score was 98 (cert+completeness only). After fix: 332.84.

### Estimated scope

| Category | Estimated listings affected |
|----------|---------------------------|
| NULL price + real artisan match | ~200-400 (all inquiry-based items with artisan matches) |
| NULL elite_factor + artisan_id set | Unknown (all NS-* schools + any unsynced individual artisans) |
| Both bugs simultaneously | Listing 67626 was the discovered case; likely dozens more |

## Timeline

| When | What |
|------|------|
| 2026-02-20 | Featured score system deployed with price damping to suppress cheap elite false positives |
| 2026-02-20 | Price damping logic: `priceDamping = min(priceJpy / 500000, 1)` — NULL price → priceJpy=0 → damping=0 |
| 2026-02-20 | Cron batch recompute reads `artisan_elite_factor` from DB but never syncs from Yuhinkai |
| 2026-02-20 – 2026-02-25 | All inquiry-based listings with artisan matches silently score with 0 artisan stature |
| 2026-02-25 | Bug discovered via Score Inspector on listing 67626 (Juyo Ichimonji, NS-Ichimonji, no price) |
| 2026-02-25 | Root cause identified: two independent bugs compounding |
| 2026-02-25 | Fix deployed (commit `e2062ae`), cron triggered, 7,818 listings rescored |
| 2026-02-25 | Listing 67626 verified: score 98 → 332.84, elite_factor 0 → 0.3087 |

## Root Cause Analysis

### Bug 1: Price damping treats NULL price as ¥0

The price damping feature was added on 2026-02-20 to suppress cheap items with elite artisan matches (a ¥6,600 tsuba matched to Kunihiro is almost certainly wrong). The formula:

```typescript
const priceJpy = estimatePriceJpy(listing.price_value, listing.price_currency);
const priceDamping = Math.min(priceJpy / PRICE_DAMPING_CEILING_JPY, 1);
const artisanStature = rawArtisanStature * priceDamping;
```

`estimatePriceJpy()` correctly returns 0 for NULL `price_value` (it's a price conversion function). But `computeQuality()` then used that 0 directly in the damping formula: `min(0 / 500000, 1) = 0`, zeroing out the entire artisan stature.

**The semantic error:** "no listed price" ≠ "cheap". Inquiry-based items on dealers like Nihon Art, Legacy Swords, and high-end Japanese dealers omit prices precisely *because* the items are expensive. A Juyo Ichimonji with no listed price is not a ¥6,600 tsuba — it's likely worth ¥5M+.

### Bug 2: Cron never syncs elite_factor from Yuhinkai

The featured score cron (`compute-featured-scores`) runs every 4 hours and processes all available listings. For each listing, it reads `artisan_elite_factor` and `artisan_elite_count` directly from the `listings` table columns. If these are NULL, they default to 0:

```typescript
const eliteFactor = hasRealArtisan ? (listing.artisan_elite_factor ?? 0) : 0;
```

The problem: the Oshi-scrapper writes `artisan_id` to the listing when it matches an artisan, but it does **not** populate the elite columns. Those columns are only populated by:

1. The `fix-artisan` admin API (when an admin manually assigns an artisan)
2. The `backfill-elite-factor.ts` script (when manually run)
3. The `sync-elite-factor` webhook API (when triggered from oshi-v2)

None of these run automatically for newly matched listings. The cron — which processes every listing every 4 hours — was the obvious place for this sync, but it never did it.

**NS-\* school codes are especially affected** because they require a fallback lookup to `artisan_schools` (not `artisan_makers`). The `getArtisanEliteStats()` function in `scoring.ts` already handles this correctly, but it was only called from `recomputeScoreForListing()` (admin actions), never from the cron.

### Why this wasn't caught earlier

1. **Most listings have prices** — the NULL price bug only affects inquiry-based listings, which are a minority
2. **Most artisan matches have synced elite factors** — the backfill script was run for initial deployment, covering existing matches. Only new matches (from ongoing scraping) and NS-* schools were affected
3. **The Score Inspector shows the breakdown correctly** — but you have to look at a specific listing to notice. There was no system-wide alert for "artisan stature = 0 despite real artisan match"
4. **The two bugs compound** — even if elite_factor had been synced, the NULL price damping would still zero it. And even if damping was correct, NULL elite_factor would still show 0 stature. Both had to be fixed.

## Fixes Applied

### Fix 1: NULL price bypasses damping (`scoring.ts`)

**Before:**
```typescript
const priceDamping = Math.min(priceJpy / PRICE_DAMPING_CEILING_JPY, 1);
```

**After:**
```typescript
const priceDamping = listing.price_value ? Math.min(priceJpy / PRICE_DAMPING_CEILING_JPY, 1) : 1;
```

When `price_value` is NULL, `priceDamping = 1` (full stature, no suppression). When `price_value` is set, normal damping applies. Applied in both `computeQuality()` and `computeScoreBreakdown()` (admin diagnostics).

**Design rationale:** The damping feature exists to catch *cheap false positives* — items priced too low for the artisan attribution to be plausible. "No price" items are inquiry-based and typically expensive. The damping should only apply when we *know* the price is low, not when we *don't know* the price.

### Fix 2: Cron syncs elite_factor for unsynced listings (`compute-featured-scores/route.ts`)

New step 2 (before scoring) in the cron:

1. Query listings where `artisan_id IS NOT NULL AND artisan_elite_factor IS NULL` (limit 500/run)
2. Deduplicate artisan IDs (many listings may share the same artisan)
3. Batch-fetch elite stats from Yuhinkai via `getArtisanEliteStats()` (handles NS-* → `artisan_schools`)
4. Update `artisan_elite_factor` and `artisan_elite_count` columns
5. Continue to normal scoring (which now reads the synced values)

`getArtisanEliteStats()` was changed from `private` to `export` for cron reuse.

**Self-healing property:** Any listing with a NULL elite_factor will be automatically fixed on the next cron run (within 4 hours). No manual backfill needed for future matches.

### Fix 3: Test updated (`scoring.test.ts`)

The test "zero stature when no price (null)" was updated to "full stature when no price (null) — inquiry-based items bypass damping". Expected value changed from 0 to 300 (full raw stature of elite_factor=1.0, elite_count=100).

## Production Verification

| Metric | Before | After |
|--------|--------|-------|
| Listing 67626 `artisan_elite_factor` | NULL (0) | 0.3087 |
| Listing 67626 `artisan_elite_count` | NULL (0) | 70 |
| Listing 67626 `featured_score` | 98 (stored 106.4) | 332.84 |
| Listing 67626 browse rank | #273 of 3,476 | Near top |
| Cron completion | 7,818 listings processed, 49.9s | Successful |
| Test suite | 4,322 tests passed | No regressions |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/featured/scoring.ts` | NULL price → damping=1; exported `getArtisanEliteStats()` |
| `src/app/api/cron/compute-featured-scores/route.ts` | Added step 2: elite_factor sync for NULL columns |
| `tests/lib/featured/scoring.test.ts` | Updated NULL price test expectation (0→300) |

## Monitoring

### SQL: Find listings still affected

```sql
-- Listings with artisan but NULL elite factor (should be 0 after cron runs)
SELECT COUNT(*) FROM listings
WHERE artisan_id IS NOT NULL
  AND artisan_elite_factor IS NULL
  AND is_available = true;

-- Inquiry-based listings with real artisan matches (verify stature > 0)
SELECT id, artisan_id, artisan_elite_factor, featured_score, price_value
FROM listings
WHERE price_value IS NULL
  AND artisan_id IS NOT NULL
  AND artisan_id NOT IN ('UNKNOWN', 'unknown')
  AND is_available = true
ORDER BY featured_score DESC
LIMIT 20;
```

### Key metrics to watch

| Metric | Healthy | Investigate |
|--------|---------|-------------|
| Listings with NULL elite_factor + artisan_id | 0 | > 0 after cron |
| Inquiry-based items with featured_score < 50 | 0 (if artisan matched) | Any |
| NS-* school matches with elite_factor = 0 | 0 | Any |

## Lessons Learned

1. **Price damping must distinguish "no price" from "cheap price."** NULL semantics matter — in nihonto, no listed price signals exclusivity, not low value. Any scoring feature that uses price as a signal must handle the NULL case explicitly and with domain awareness.

2. **Denormalized columns need a sync pipeline, not just a backfill.** The `artisan_elite_factor`/`artisan_elite_count` columns on `listings` are denormalized from Yuhinkai. The initial backfill script populated existing rows, but new artisan matches from ongoing scraping had no sync path. The cron is the natural place for this because it already processes every listing.

3. **Two subtle bugs can hide each other.** Even if someone had noticed the NULL elite_factor, they might have fixed only that — and the listings would still score 0 because of the price damping bug. And vice versa. The Score Inspector was essential for seeing both problems at once.

4. **School codes (NS-\*) are second-class citizens.** The `artisan_makers` table is the primary lookup, and `artisan_schools` is only checked as a fallback. Every new code path that touches artisan data needs to handle NS-* explicitly. This has been a recurring pattern: `getArtisan()`, `getArtisanEliteStats()`, `expandArtisanCodes()`, directory API, and now the cron.

5. **The Score Inspector paid for itself.** Without the admin diagnostics breakdown showing `elite_factor (0) × 200 = 0` and `price damping (¥0 / ¥500K) = ×0`, this bug would have been much harder to diagnose. Invest in admin observability tools.

## Related Documents

- [SESSION_20260222_FEATURED_SCORE_RECOMPUTE.md](./SESSION_20260222_FEATURED_SCORE_RECOMPUTE.md) — Featured score system, inline recompute, fire-and-forget postmortem
- [ARTIST_FEATURE.md](./ARTIST_FEATURE.md) — Artist/artisan system, NS-* school codes
- [SYNC_ELITE_FACTOR_API.md](./SYNC_ELITE_FACTOR_API.md) — Elite factor sync webhook API
- `supabase/migrations/088_artisan_confidence_cheap_downgrade.sql` — Related cheap elite suppression (confidence downgrade)
