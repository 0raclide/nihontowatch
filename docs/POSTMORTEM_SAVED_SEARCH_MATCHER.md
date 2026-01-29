# Postmortem: Saved Search Matcher False Positives/Negatives

**Date:** 2026-01-29
**Severity:** Medium (incorrect alert notifications)
**Status:** Resolved

## Summary

Users received saved search alerts for items that didn't match their search criteria (false positives) and didn't receive alerts for items that should have matched (false negatives).

## Timeline

- **2026-01-25**: User sets up saved search for "Juyo" with instant notifications
- **2026-01-29**: User receives alert for listing 39280 (Hozon item) - false positive
- **2026-01-29**: User notices listing 39097 (actual Juyo) didn't trigger alert - false negative
- **2026-01-29**: Bug investigated and fixed

## Root Cause Analysis

### The Mismatch

The browse API and saved search matcher handled certification terms differently:

| Component | How it handled `query: "Juyo"` |
|-----------|-------------------------------|
| **Browse API** | Used `parseSemanticQuery()` → extracted "Juyo" → filtered by `cert_type IN ('Juyo', 'juyo')` |
| **Saved Search Matcher** | Did NOT use semantic parsing → searched `ilike.%juyo%` across ALL text fields |

### False Positive (Listing 39280)

- **Item:** Tachi by Kuninaga (NBTHK Hozon Token)
- **cert_type:** `"Hozon"` (correctly Hozon)
- **Why it matched:** The description contained a "Related Items" section that referenced OTHER swords:
  > "Tachi:Bishū Osafune Tomosada (48th NBTHK **Juyo** Token)"
- The text search `ilike.%juyo%` matched this reference, even though the item itself was Hozon

### False Negative (Listing 39097)

- **Item:** 刀 肥前国住陸奥守忠吉 (Katana by Mutsunokami Tadayoshi)
- **cert_type:** `NULL` (data extraction bug in scraper)
- **Description:** Contains "Jyuyo Touken" (romanized with 'y' before 'u')
- **Why it didn't match:**
  1. `cert_type` was NULL, so exact match would fail
  2. The spelling "Jyuyo" doesn't contain "juyo" as a substring
  3. The text search `ilike.%juyo%` did NOT match "Jyuyo"

## The Fix

Updated `/src/lib/savedSearches/matcher.ts` to use `parseSemanticQuery()` (same as browse API):

```typescript
// Before: Raw text search
for (const word of textWords) {
  const conditions = searchFields.map((field) => `${field}.ilike.%${word}%`);
  query = query.or(conditions.join(','));
}

// After: Semantic parsing first
const { extractedFilters, remainingTerms } = parseSemanticQuery(criteria.query);

// Apply cert filter (exact match)
if (extractedFilters.certifications.length > 0 && !criteria.certifications?.length) {
  const certVariants = extractedFilters.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
  query = query.in('cert_type', certVariants);
}

// Only text search on remaining terms
const { textWords } = parseNumericFilters(remainingTerms.join(' '));
// ... text search only on non-semantic terms
```

## Additional Fix: Email Quickview Links

Also fixed email templates to link to Nihontowatch quickview (`?listing=<id>`) instead of external dealer URLs, improving UX.

## Commits

- `0ca016e`: fix: Use semantic query parsing in saved search matcher
- `b1b2505`: feat: Email alerts link to Nihontowatch quickview instead of dealer sites

## Remaining Issue

Listing 39097's `cert_type` is `NULL` despite being a Juyo sword. This is a data extraction bug in Oshi-scrapper for this Japanese dealer that should be fixed separately.

## Lessons Learned

1. **Consistency matters**: When two systems query the same data, they should use the same logic
2. **Text search is fuzzy**: ILIKE searches can match unintended content (Related Items, descriptions mentioning other items)
3. **Semantic parsing is precise**: Extracting known terms and applying exact filters prevents false matches
4. **Test with real data**: The bug was only apparent with real listing data that had "Related Items" sections

## Prevention

- Added 15 unit tests for email templates (`tests/lib/email/templates/saved-search.test.ts`)
- Documented the semantic parsing requirement in `docs/SEARCH.md`
- Updated `docs/EMAIL_ALERTS.md` with quickview link documentation

## Related Files

| File | Change |
|------|--------|
| `src/lib/savedSearches/matcher.ts` | Added semantic query parsing |
| `src/lib/email/templates/saved-search.ts` | Added `getListingQuickViewUrl()`, updated links |
| `docs/SEARCH.md` | Documented matcher consistency |
| `docs/EMAIL_ALERTS.md` | Documented quickview links |
