# Postmortem: Yuhinkai Enrichment Data Quality Issues

**Date:** 2026-01-21
**Author:** Claude
**Severity:** Medium (affects UI quality, not functionality)
**Status:** Diagnosed, fix pending

---

## Executive Summary

An investigation revealed **significant data quality issues** in the Yuhinkai enrichment data displayed in QuickView:

| Issue | Count | % of Total | Impact |
|-------|-------|------------|--------|
| Enrichments with NULL/empty setsumei | **30** | 48% | Shows empty enrichment section |
| Enrichments with fabricated data | **1** | 2% | Shows dealer-style text instead of official catalog |
| **Enrichments with proper data** | **32** | 51% | Displays correctly |
| **Total enrichments** | **63** | 100% | |

---

## Issue #1: Missing Setsumei Data (30 entries, 48%)

### Symptoms
- Enrichment records exist but `setsumei_ja` and `setsumei_en` are NULL or empty
- UI shows blank enrichment section or falls back to SetsumeiSection

### Root Cause
The source catalog records in oshi-v2 (`catalog_records.japanese_txt`) have no text for these entries.

### Affected Collections
| Collection | Count | Notes |
|------------|-------|-------|
| JE_Koto | 28 | Juyo blades - catalog text not yet imported |
| Other | 2 | Various gaps in catalog data |

### Evidence
```sql
-- Example: Listing 50 (Norinari)
-- yuhinkai_enrichments.setsumei_ja = NULL
-- catalog_records.japanese_txt = NULL (source is empty)
-- UUID is VALID but source data missing
```

### Why This Happened
The blade enrichment pipeline was run before the Japanese setsumei text was imported into oshi-v2's `catalog_records` table for the JE_Koto (Juyo blades) collection.

### Recommended Fix
1. Import missing `japanese_txt` and `translation_md` for JE_Koto collection into oshi-v2
2. Re-run enrichment backfill for affected listings
3. Add validation in enricher to skip records where source `japanese_txt` is empty

---

## Issue #2: Fabricated Enrichment Data (1 entry)

### Symptoms
Listing 7023 (Nomura Kanenori Juyo 46 tsuba) displays:
- LLM-generated biographical text instead of official catalog text
- Text appears dealer-description style, not official NBTHK format

### Affected Listing
- **Listing ID:** 7023
- **Title:** 野村包教製 江州彦根住辛丑仲秋 (第46回重要刀装具)
- **UUID in enrichment:** `f2efffa8-1e5d-4b47-b727-75c5138fae58` (FAKE)
- **enriched_at:** 2026-01-20T23:10:09.42401+00:00

### Root Cause Analysis

**The enrichment UUID does not exist in oshi-v2:**
```
UUID: f2efffa8-1e5d-4b47-b727-75c5138fae58
gold_values: 0 records
catalog_records: 0 records
physical_objects: 0 records
```

**The CORRECT catalog entry exists:**
```
UUID: 5f803fe4-879d-4663-aae4-8f6b91ff7814
gold_artisan: Nomura Kanenori
gold_sessions: {"Juyo":46}
gold_form_type: tsuba
collection: Juyo
volume: 46
item_number: 229
japanese_txt: 平成十二年十月五日指定... (proper official text)
```

### What The Enrichment Contains

**setsumei_ja (LLM-generated, NOT from catalog):**
```
野村包教（のむらかねのり）
彦根藩主井伊家お抱えの金工。
文久年間（1861-1864）に活躍した名工で、精緻な象嵌技法で知られる。
本作は瓢箪と唐草を配した意匠で、井伊家の紋章を巧みに取り入れている。
```

**What It SHOULD Contain (from actual catalog):**
```
平成十二年十月五日指定
第四十六回
要刀装
群仙図鐔銘
干英子野村包教製
江州彦根住仲秋
... (full official designation document)
```

### Investigation Findings

The enrichment record claims:
- `match_score: 0.94`
- `match_signals: {"ocr":0.94,"session":true}`
- `match_confidence: DEFINITIVE`

But these signals are **impossible** if matching against a valid oshi-v2 catalog record because:
1. The UUID doesn't exist in oshi-v2
2. The setsumei_ja content is clearly LLM-generated (biographical style with parenthetical readings)
3. The setsumei_en is also LLM-generated (has "Historical Context", "Craftsmanship" headers - not translation style)

### Hypothesis: How This Happened

This enrichment was likely created by a **different code path** than the normal backfill:

1. **Possible cause:** Manual enrichment script that generated synthetic data when no exact match was found
2. **Possible cause:** LLM-based enrichment fallback that fabricated catalog-style entries
3. **Possible cause:** Test/demo data that was accidentally committed to production

The timestamp (2026-01-20T23:10:09) suggests this was created during the initial enrichment deployment, possibly by a different process than the documented `run_backfill.py`.

### Recommended Fix

**Immediate:**
1. Delete the invalid enrichment record for listing 7023
2. Re-run proper enrichment for listing 7023 using correct UUID `5f803fe4-879d-4663-aae4-8f6b91ff7814`

**Long-term:**
1. Add UUID validation in enricher - verify UUID exists in oshi-v2 before saving
2. Add setsumei content validation - check for official format markers
3. Audit all enrichments for fabricated UUIDs

---

## Comparison: Good vs Bad Enrichment

| Field | Listing 10324 (GOOD) | Listing 7023 (BAD) |
|-------|---------------------|-------------------|
| UUID valid in oshi-v2 | Yes | **No** |
| setsumei_ja source | catalog_records.japanese_txt | LLM-generated |
| setsumei_ja format | Official: "平成...年...指定" | Biographical: "野村包教（のむら...）" |
| setsumei_ja length | 654 chars | 101 chars |
| setsumei_en format | Translation with measurements | Educational with headers |
| match_score trustworthy | Yes (from real OCR) | **No** (fabricated) |

---

## Data Quality Summary

### By Collection Type
| Collection | Total | With Setsumei | Without | % Complete |
|------------|-------|---------------|---------|------------|
| Juyo (tosogu) | 34 | 33 | 1 (bad data) | 97%* |
| JE_Koto (blades) | 28 | 0 | 28 | 0% |
| Juyo Tosogu | 1 | 0 | 1 (fabricated) | 0% |

*Note: Juyo tosogu count includes the 1 fabricated entry which needs correction

### Quality Metrics
- **True positive rate (good enrichments):** 32/63 = 50.8%
- **Missing data rate:** 30/63 = 47.6%
- **Bad data rate:** 1/63 = 1.6%

---

## Action Items

### P0 - Critical (Fix Now)
1. [ ] Delete invalid enrichment for listing 7023
2. [ ] Create correct enrichment using proper UUID `5f803fe4-879d-4663-aae4-8f6b91ff7814`

### P1 - High (Fix This Week)
3. [ ] Add UUID validation in enricher to verify UUID exists in oshi-v2 before saving
4. [ ] Add content validation to detect LLM-generated vs authentic catalog text
5. [ ] Audit all 63 enrichments for other fabricated UUIDs

### P2 - Medium (Fix This Sprint)
6. [ ] Import missing japanese_txt for JE_Koto collection into oshi-v2
7. [ ] Re-run enrichment for listings with empty setsumei after data import
8. [ ] Add monitoring for enrichment data quality metrics

### P3 - Low (Backlog)
9. [ ] Investigate source of fabricated enrichment (which code path created it)
10. [ ] Add integration tests validating enrichment against oshi-v2

---

## Appendix: SQL Queries for Investigation

### Check enrichment validity
```sql
-- In nihontowatch DB
SELECT
  listing_id,
  yuhinkai_uuid,
  LENGTH(setsumei_ja) as ja_len,
  yuhinkai_collection,
  enriched_at
FROM yuhinkai_enrichments
ORDER BY ja_len ASC;
```

### Find fabricated UUIDs (cross-db check)
```javascript
// Check if UUID exists in oshi-v2
const { data } = await oshiV2
  .from("gold_values")
  .select("object_uuid")
  .eq("object_uuid", enrichment.yuhinkai_uuid);
if (!data || data.length === 0) {
  console.log("FABRICATED UUID:", enrichment.yuhinkai_uuid);
}
```

### Find correct match for Nomura Kanenori
```sql
-- In oshi-v2 DB
SELECT object_uuid, gold_artisan, gold_sessions
FROM gold_values
WHERE gold_artisan ILIKE '%Nomura%Kanenori%'
  AND gold_form_type = 'tsuba';
-- Returns: 5f803fe4-879d-4663-aae4-8f6b91ff7814
```

---

---

## Issue #3: Multi-Layer Caching Prevents Cache Invalidation (2026-01-21)

### Symptoms
After fixing listing 7023's enrichment data in the database:
- Raw API with `?nocache=1` returns **correct** data
- UI still displays **old** LLM-generated content
- Closing browser tabs, incognito mode don't help
- Even explicit nocache param on page URL doesn't work

### Caching Layers Identified

| Layer | Location | TTL | Bypass Method |
|-------|----------|-----|---------------|
| **1. Vercel ISR** | Edge CDN | 3600s | `revalidatePath()` or deploy |
| **2. API Cache-Control** | CDN/Browser | s-maxage=3600, swr=86400 | `?nocache=1` header |
| **3. Client useApiCache** | In-memory (React) | 60min TTL | Different URL (cache key) |

### Root Cause: ISR vs Cache-Control

The enrichment API has **two independent caching mechanisms**:

```typescript
// src/app/api/listing/[id]/enrichment/route.ts

// 1. Next.js ISR - caches the FUNCTION RESULT at Vercel edge
export const revalidate = 3600; // 1 hour

// 2. HTTP Cache-Control - tells browsers/CDNs to cache RESPONSE
response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
```

Our `?nocache=1` param sets `Cache-Control: no-store` which bypasses layer #2.
But layer #1 (ISR) is controlled by `export const revalidate` and ignores query params.

### Why This Matters

When we updated the database:
- Database: ✅ New enrichment (ID 64, correct UUID)
- ISR Cache: ❌ Still serving old response (ID 1, fake UUID)
- Response Cache: ✅ Bypassed with nocache=1
- Client Cache: ✅ Different URL = different cache key

The ISR cache serves the OLD function result until:
1. TTL expires (1 hour), OR
2. Explicit revalidation via `revalidatePath()`, OR
3. New deployment

### Solution Implemented

Added on-demand revalidation API endpoint:

```typescript
// POST /api/revalidate?path=/api/listing/7023/enrichment
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path');
  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
```

### Lessons Learned

1. **ISR caching is separate from HTTP caching** - both must be considered
2. **Query params don't invalidate ISR cache** - the cached response is keyed by path
3. **Database changes don't automatically propagate** - need explicit cache invalidation
4. **For data that can change, consider**:
   - `revalidate = 0` (no ISR caching)
   - On-demand revalidation after data changes
   - Cache tags with `revalidateTag()`

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-21 | Claude | Initial investigation and report |
| 2026-01-21 | Claude | Added Issue #3: Multi-layer caching findings |
