# Session Summary: Listing 7023 Enrichment & Cache Fix

**Date:** 2026-01-21
**Issue:** QuickView showing fabricated LLM-generated text instead of official catalog data

---

## Problem

Listing 7023 (Nomura Kanenori Juyo 46 tsuba) displayed:
- LLM-generated biographical text: "野村包教（のむらかねのり）彦根藩主井伊家お抱えの金工..."
- Fake UUID: `f2efffa8-1e5d-4b47-b727-75c5138fae58` (doesn't exist in oshi-v2)

Should have displayed:
- Official NBTHK catalog text: "平成十二年十月五日指定..."
- Correct UUID: `5f803fe4-879d-4663-aae4-8f6b91ff7814`

---

## Root Causes

### 1. Fabricated Enrichment Data
The enrichment record was created by a non-standard code path that generated fake data instead of matching to the real catalog entry.

### 2. Multi-Layer Caching
After database fix, UI still showed old data due to:

| Layer | Issue |
|-------|-------|
| Vercel ISR | `export const revalidate = 3600` cached stale function results |
| HTTP Cache-Control | Properly bypassed with `?nocache=1` |
| Client useApiCache | Different URL = different cache key |

**Key insight:** ISR caching operates independently of HTTP Cache-Control headers and ignores query parameters.

---

## Fixes Applied

### Database Fix
```sql
-- Deleted fabricated enrichment (ID 1)
DELETE FROM yuhinkai_enrichments WHERE listing_id = 7023;

-- Inserted correct enrichment (ID 64) with verified data
INSERT INTO yuhinkai_enrichments (...) VALUES (...);
```

### Code Changes

**`src/app/api/listing/[id]/enrichment/route.ts`**
```typescript
// Before
export const revalidate = 3600;

// After
export const revalidate = 0;
export const dynamic = 'force-dynamic';
```

**`src/app/api/listing/[id]/route.ts`**
- Same ISR disable
- Added `?nocache=1` support for debugging

### Deployment
```bash
npx vercel --prod --force  # Purged edge cache
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/listing/[id]/route.ts` | Disabled ISR, added nocache support |
| `src/app/api/listing/[id]/enrichment/route.ts` | Disabled ISR, already had nocache |
| `src/hooks/useListingEnrichment.ts` | Pass nocache param from page URL |
| `docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md` | Created - full analysis |
| `docs/PLAN_FIX_LISTING_7023_ENRICHMENT.md` | Created - surgical fix plan |

---

## Commits

1. `ddf1a46` - "fix: Disable ISR caching for listing APIs to enable cache bypass"

---

## Verification

API returns correct data:
```
enrichment_id: 64
yuhinkai_uuid: 5f803fe4-879d-4663-aae4-8f6b91ff7814
setsumei_ja: "平成十二年十月五日指定..." (official NBTHK format)
```

---

## Documentation Created

1. **`docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md`**
   - Issue #1: Missing setsumei data (30 entries, 48%)
   - Issue #2: Fabricated enrichment (1 entry)
   - Issue #3: Multi-layer caching analysis

2. **`docs/PLAN_FIX_LISTING_7023_ENRICHMENT.md`**
   - Pre-execution verification steps
   - Execution plan with rollback
   - Post-execution notes

---

## Lessons Learned

1. **ISR vs HTTP caching are independent** - both must be considered for cache invalidation
2. **Query params don't invalidate ISR** - cached response is keyed by path only
3. **Database changes don't auto-propagate** - need explicit cache invalidation or redeploy
4. **For mutable data, avoid ISR** - use `revalidate = 0` or on-demand revalidation

---

## Related Files for Future Reference

- Enrichment hook: `src/hooks/useListingEnrichment.ts`
- Enrichment API: `src/app/api/listing/[id]/enrichment/route.ts`
- Client cache: `src/hooks/useApiCache.ts` (has `clearApiCache()` function)
