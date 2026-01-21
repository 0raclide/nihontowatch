# Plan: Replace Yuhinkai Setsumei with OCR Setsumei

## Goal
Change "Catalog Enriched" toggle to show listings with **OCR setsumei** (182 items) instead of **Yuhinkai catalog matches** (97 items).

## Current State

| Component | Current Behavior |
|-----------|------------------|
| `enriched=true` filter | Queries `listing_yuhinkai_enrichment` table (97 items) |
| Listing detail | Shows Yuhinkai data in `YuhinkaiEnrichmentSection`, fallback to `SetsumeiSection` |
| Badge | "Catalog Data Verified" for Yuhinkai matches |

## Target State

| Component | New Behavior |
|-----------|--------------|
| `enriched=true` filter | Query `listings.setsumei_text_en IS NOT NULL` (182 items) |
| Listing detail | Show `SetsumeiSection` for OCR setsumei (primary), Yuhinkai as supplementary |
| Badge | "NBTHK Evaluation" or "Setsumei Available" for OCR items |

## Files to Modify

### 1. `/src/app/api/browse/route.ts` (Critical)
**Change**: Enriched filter logic

```typescript
// BEFORE (lines 319-327)
if (params.enriched) {
  const { data: enrichedIds } = await supabase
    .from('listing_yuhinkai_enrichment')
    .select('listing_id');
  // ...filter by enrichedIds
}

// AFTER
if (params.enriched) {
  query = query.not('setsumei_text_en', 'is', null);
}
```

### 2. `/src/app/api/browse/route.ts` (Count query)
**Change**: Also update the count query to match

```typescript
// Find where count query is built and add same filter
if (params.enriched) {
  countQuery = countQuery.not('setsumei_text_en', 'is', null);
}
```

### 3. `/src/components/ui/CatalogEnrichedBadge.tsx`
**Change**: Update badge to indicate setsumei availability

```typescript
// Option A: Keep for Yuhinkai only (supplementary)
// Option B: Create new SetsumeiAvailableBadge component
```

### 4. `/src/app/listing/[id]/ListingDetailClient.tsx`
**Change**: Prioritize SetsumeiSection over YuhinkaiEnrichmentSection

```typescript
// BEFORE (lines 396-403)
{hasVerifiedEnrichment(listing) && (
  <YuhinkaiEnrichmentSection ... />
)}
{!hasVerifiedEnrichment(listing) && (
  <SetsumeiSection ... />
)}

// AFTER
{listing.setsumei_text_en && (
  <SetsumeiSection ... />
)}
{/* Optionally show Yuhinkai as supplementary info */}
```

### 5. `/src/types/index.ts`
**Change**: Add helper function for setsumei check

```typescript
export function hasSetsumei(listing: Listing): boolean {
  return !!listing.setsumei_text_en;
}
```

## Migration Steps

1. **Update browse API filter** - Change from Yuhinkai to setsumei
2. **Update count logic** - Ensure facet counts match
3. **Update detail page** - Prioritize SetsumeiSection
4. **Update/rename badge** - Reflect setsumei not catalog
5. **Test locally** - Verify 182 items show with toggle
6. **Deploy** - Push to production

## Rollback Plan
If issues arise, revert the browse API filter back to `listing_yuhinkai_enrichment`.

## Decision Required

**Badge behavior:**
- Option A: Remove "Catalog Enriched" badge entirely (simpler)
- Option B: Change badge to "NBTHK Evaluation Available" (more informative)
- Option C: Keep Yuhinkai badge AND add setsumei indicator (both visible)

Recommend: **Option B** - Change badge text to indicate setsumei availability.
