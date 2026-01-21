# Postmortem: Sword Enrichments Missing setsumei_en

**Date**: 2026-01-21
**Severity**: Medium
**Impact**: Sword enrichments displayed only artisan/school metadata, no setsumei translation

## Summary

Enriched sword listings in Quick View showed only minimal "Catalog Data" (artisan: Sa, school: Sa) instead of the full setsumei translation, while tosogu enrichments worked correctly.

## Root Cause

**Two bugs in the sword enrichment pipeline:**

### Bug 1: Frontend filtering out swords (nihontowatch)

`useListingEnrichment.ts` only fetched enrichment for tosogu items:

```typescript
// BEFORE - only tosogu allowed
function isEligibleForEnrichment(itemType, certType) {
  if (!isTosogu(itemType)) {
    return false;  // Swords rejected here!
  }
  // ...
}
```

### Bug 2: Backend not fetching translation_md (Oshi-scrapper)

`run_sword_backfill.py` fetched catalog data but omitted `translation_md`:

```python
# BEFORE - missing translation_md!
cat_resp = yuhinkai_client.table('catalog_records').select(
    'collection, volume, item_number, japanese_txt'  # No translation_md!
).eq('object_uuid', object_uuid)...
```

The enricher then called `yuhinkai.get("translation_md")` which returned `None`, so `setsumei_en` was saved as `null` in the database.

## Timeline

1. Sword enrichment pipeline created (assumed to work like tosogu)
2. ~69 sword enrichments created with `setsumei_en = null`
3. User reported swords not showing setsumei in Quick View
4. Investigation revealed two-part bug

## Fix

### Part 1: Frontend (nihontowatch)

Updated `useListingEnrichment.ts` to allow blades:

```typescript
// AFTER - both tosogu and blades allowed
function isEligibleForEnrichment(itemType, certType) {
  if (!isTosogu(itemType) && !isBlade(itemType)) {
    return false;
  }
  // ...
}
```

### Part 2: Backend (Oshi-scrapper)

1. Added `translation_md` to SELECT query:
```python
cat_resp = yuhinkai_client.table('catalog_records').select(
    'collection, volume, item_number, japanese_txt, translation_md'  # Added!
)
```

2. Pass to yuhinkai_record:
```python
yuhinkai_record['translation_md'] = catalog.get('translation_md')
```

### Part 3: Regression Tests

Added 5 new tests to `test_enricher.py`:
- `test_setsumei_en_from_translation_md`
- `test_setsumei_en_fallback_to_english_txt`
- `test_setsumei_en_none_when_both_missing`
- `test_setsumei_en_empty_string_falls_back`
- `test_setsumei_format_accuracy` (parametrized)

## Re-enrichment

Existing sword enrichments with `setsumei_en = null` need to be re-enriched:

```sql
DELETE FROM yuhinkai_enrichments
WHERE item_category = 'blade'
  AND setsumei_en IS NULL;
```

Then re-run backfill, or wait for V2 sword matching pipeline which will upsert.

## Lessons Learned

1. **Test edge cases explicitly** - The test fixture had a default `translation_md` value, so the None case was never tested
2. **Compare working vs broken flows** - Tosogu worked because it loaded catalog data upfront; sword fetched on-demand but missed fields
3. **Frontend eligibility checks can mask backend bugs** - The frontend was filtering out swords entirely, hiding the fact that backend data was also broken

## Files Changed

| File | Change |
|------|--------|
| `nihontowatch/src/hooks/useListingEnrichment.ts` | Allow blades in eligibility check |
| `Oshi-scrapper/run_sword_backfill.py` | Add translation_md to SELECT and pass to record |
| `Oshi-scrapper/tests/setsumei/enrichment/test_enricher.py` | Add 5 regression tests |

## Related

- `docs/YUHINKAI_ENRICHMENT.md` - Feature overview
- `Oshi-scrapper/docs/YUHINKAI_ENRICHMENT_SYSTEM.md` - Full backend docs
