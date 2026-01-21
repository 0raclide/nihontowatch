# Surgical Fix Plan: Listing 7023 Enrichment

**Date:** 2026-01-21
**Status:** ✅ COMPLETED (see Post-Execution Notes)
**Risk Level:** Low (single record fix with rollback capability)

---

## Problem Statement

Listing 7023 (Nomura Kanenori Juyo session 46 tsuba) has a **fabricated enrichment record** containing:
- Fake UUID that doesn't exist in oshi-v2
- LLM-generated biographical text instead of official catalog text
- Fake match score (0.94)

The CORRECT catalog entry exists in oshi-v2 with proper official Japanese setsumei and English translation.

## Fix Strategy

**Approach:** Delete-and-replace (not update)

**Why not update?**
- The entire record is fabricated (UUID, text, score)
- Using the proper enrichment pipeline ensures data integrity
- Delete-and-replace is idempotent (can re-run safely)

## Pre-Execution Verification

Before making any changes, verify:

### 1. Confirm the bad data exists
```sql
-- Should return 1 row with fake UUID
SELECT id, listing_id, yuhinkai_uuid, match_score,
       LENGTH(setsumei_ja) as ja_len,
       LEFT(setsumei_ja, 50) as ja_preview
FROM yuhinkai_enrichments
WHERE listing_id = 7023;

-- Expected:
-- id | listing_id | yuhinkai_uuid                        | match_score | ja_len | ja_preview
-- 1  | 7023       | f2efffa8-1e5d-4b47-b727-75c5138fae58 | 0.94        | 101    | 野村包教（のむらかねのり）...
```

### 2. Confirm fake UUID doesn't exist in oshi-v2
```sql
-- Should return 0 rows
SELECT object_uuid FROM gold_values
WHERE object_uuid = 'f2efffa8-1e5d-4b47-b727-75c5138fae58';
```

### 3. Confirm correct catalog entry exists in oshi-v2
```sql
-- Should return 1 row with proper data
SELECT
  gv.object_uuid,
  gv.gold_artisan,
  gv.gold_sessions,
  cr.collection,
  cr.volume,
  cr.item_number,
  LENGTH(cr.japanese_txt) as ja_len,
  LEFT(cr.japanese_txt, 50) as ja_preview
FROM gold_values gv
JOIN physical_objects po ON gv.object_uuid = po.object_uuid
JOIN catalog_records cr ON po.object_uuid = cr.object_uuid
WHERE gv.gold_artisan = 'Nomura Kanenori'
  AND gv.gold_form_type = 'tsuba'
  AND (gv.gold_sessions->>'Juyo')::int = 46;

-- Expected:
-- object_uuid                          | gold_artisan     | gold_sessions | collection | volume | item_number | ja_len | ja_preview
-- 5f803fe4-879d-4663-aae4-8f6b91ff7814 | Nomura Kanenori  | {"Juyo":46}   | Juyo       | 46     | 229         | ~800   | 平成十二年十月五日指定...
```

## Execution Plan

### Step 1: Create Backup (Safety Net)

```sql
-- Create backup of the enrichment before deletion
CREATE TABLE IF NOT EXISTS yuhinkai_enrichments_backup_20260121 AS
SELECT * FROM yuhinkai_enrichments WHERE listing_id = 7023;

-- Verify backup
SELECT COUNT(*) FROM yuhinkai_enrichments_backup_20260121;
-- Expected: 1
```

### Step 2: Delete Bad Enrichment

```sql
-- Delete the fabricated enrichment
DELETE FROM yuhinkai_enrichments WHERE listing_id = 7023;

-- Verify deletion
SELECT COUNT(*) FROM yuhinkai_enrichments WHERE listing_id = 7023;
-- Expected: 0
```

### Step 3: Re-run Enrichment via Pipeline

Use the existing backfill to create proper enrichment:

```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper

# Preview the match (dry run)
DRY_RUN=true python3 -c "
import os
from pathlib import Path

# Load environment
env_file = Path('.env')
if env_file.exists():
    for line in env_file.read_text().split('\n'):
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            os.environ[key.strip()] = value.strip()

oshi_v2_env = Path('../oshi-v2/.env.local')
if oshi_v2_env.exists():
    for line in oshi_v2_env.read_text().split('\n'):
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip()
            if key == 'NEXT_PUBLIC_SUPABASE_URL':
                os.environ['OSHI_V2_SUPABASE_URL'] = value
            elif key == 'SUPABASE_SERVICE_ROLE_KEY':
                os.environ['OSHI_V2_SUPABASE_KEY'] = value

# Query listing 7023 and run match
from db.client import get_supabase_client
from supabase import create_client

client = get_supabase_client()
result = client.table('listings').select('*').eq('id', 7023).single().execute()
listing = result.data

print(f'Listing: {listing[\"id\"]} - {listing[\"title\"][:60]}')
print(f'Images: {len(listing.get(\"stored_images\") or listing.get(\"images\") or [])}')

# Load Yuhinkai catalog (tosogu only)
yuhinkai_client = create_client(
    os.environ['OSHI_V2_SUPABASE_URL'],
    os.environ['OSHI_V2_SUPABASE_KEY']
)

response = yuhinkai_client.table('gold_values').select(
    '*, physical_objects!object_uuid(*, catalog_records!object_uuid(*))'
).eq('gold_item_type', 'tosogu').execute()

yuhinkai_records = []
for gold in response.data:
    physical_obj = gold.get('physical_objects') or {}
    catalog_list = physical_obj.get('catalog_records') or []
    catalog = catalog_list[0] if catalog_list else {}
    gold_sessions_raw = gold.get('gold_sessions') or {}

    session_number = None
    if isinstance(gold_sessions_raw, dict):
        for session_type in ['Juyo', 'Tokuju', 'JuBun', 'Kokuho']:
            if session_type in gold_sessions_raw:
                session_number = gold_sessions_raw[session_type]
                break

    yuhinkai_records.append({
        'object_uuid': gold.get('object_uuid'),
        'uuid': gold.get('object_uuid'),
        'collection': catalog.get('collection'),
        'volume': catalog.get('volume'),
        'item_number': catalog.get('item_number'),
        'session': session_number,
        'japanese_txt': catalog.get('japanese_txt'),
        'translation_md': catalog.get('translation_md'),
        'gold_artisan': gold.get('gold_artisan'),
        'gold_artisan_kanji': gold.get('gold_artisan_kanji'),
        'maker': gold.get('gold_artisan'),
        'gold_sessions': gold_sessions_raw,
        'gold_form_type': gold.get('gold_form_type'),
        'form_type': gold.get('gold_form_type'),
    })

print(f'Loaded {len(yuhinkai_records)} Yuhinkai tosogu')

# Run matcher
from setsumei.tosogu_sota import TosoguSOTAMatcher
matcher = TosoguSOTAMatcher(yuhinkai_records)

images = listing.get('stored_images') or listing.get('images') or []
result = matcher.match(
    images=images,
    title=listing.get('title', ''),
    maker=listing.get('tosogu_maker'),
    item_type=listing.get('item_type'),
    description=listing.get('description', '')
)

print(f'\\nMatch Result:')
print(f'  Confidence: {result.confidence}')
print(f'  Score: {result.best_score:.2f}')
print(f'  Best Match UUID: {result.best_match}')

# Find the matched record
matched = next((r for r in yuhinkai_records if r['object_uuid'] == result.best_match), None)
if matched:
    print(f'  Artisan: {matched.get(\"gold_artisan\")}')
    print(f'  Collection: {matched.get(\"collection\")}')
    print(f'  Volume/Item: {matched.get(\"volume\")}/{matched.get(\"item_number\")}')
    print(f'  Japanese text length: {len(matched.get(\"japanese_txt\") or \"\")}')
    print(f'  Has translation: {bool(matched.get(\"translation_md\"))}')
"
```

**Expected output:**
```
Listing: 7023 - 野村包教製 江州彦根住辛丑仲秋 (第46回重要刀装具)
Match Result:
  Confidence: DEFINITIVE
  Score: 0.XX (real OCR score)
  Best Match UUID: 5f803fe4-879d-4663-aae4-8f6b91ff7814
  Artisan: Nomura Kanenori
  Collection: Juyo
  Volume/Item: 46/229
  Japanese text length: ~800
  Has translation: True
```

### Step 4: Execute Real Enrichment

If dry run shows correct match, execute:

```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper

# Real run for single listing
python3 -c "
# (same setup code as above, but without DRY_RUN)
# ... setup code ...

# After getting result.confidence == 'DEFINITIVE':
from setsumei.enrichment import YuhinkaiEnricher, EnrichmentRepository, EnrichmentConfig
from setsumei.matchers import Confidence, MatchResult, MatchCandidate

enrichment_repo = EnrichmentRepository()
config = EnrichmentConfig(min_confidence_auto='DEFINITIVE', definitive_threshold=0.70)
enricher = YuhinkaiEnricher(repository=enrichment_repo, config=config)

match_result_obj = MatchResult(
    confidence=Confidence.DEFINITIVE,
    best_match=MatchCandidate(
        uuid=result.best_match,
        collection=matched.get('collection', ''),
        volume=matched.get('volume', 0),
        item_number=matched.get('item_number', 0),
        japanese_txt=matched.get('japanese_txt', ''),
        combined_score=result.best_score,
    ),
    candidates=[],
    signals={'ocr': result.best_score},
)

enrich_result = enricher.enrich_from_match(
    listing=listing,
    match_result=match_result_obj,
    yuhinkai_record=matched,
)

print(f'\\nEnrichment Result:')
print(f'  Applied: {enrich_result.applied}')
print(f'  Enrichment ID: {enrich_result.enrichment_id}')
print(f'  Fields enriched: {enrich_result.fields_enriched}')
"
```

## Post-Execution Verification

### 1. Verify new enrichment exists with correct UUID
```sql
SELECT
  id, listing_id, yuhinkai_uuid, match_score, match_confidence,
  LENGTH(setsumei_ja) as ja_len,
  LEFT(setsumei_ja, 80) as ja_preview,
  setsumei_en_format
FROM yuhinkai_enrichments
WHERE listing_id = 7023;

-- Expected:
-- id | listing_id | yuhinkai_uuid                        | match_score | match_confidence | ja_len | ja_preview                      | setsumei_en_format
-- X  | 7023       | 5f803fe4-879d-4663-aae4-8f6b91ff7814 | 0.XX        | DEFINITIVE       | ~800   | 平成十二年十月五日指定...      | markdown
```

### 2. Verify UUID exists in oshi-v2
```sql
-- Should return 1 row
SELECT object_uuid FROM gold_values
WHERE object_uuid = '5f803fe4-879d-4663-aae4-8f6b91ff7814';
```

### 3. Verify setsumei starts with official format
```sql
SELECT LEFT(setsumei_ja, 100) FROM yuhinkai_enrichments WHERE listing_id = 7023;
-- Should start with: 平成十二年十月五日指定
-- NOT with: 野村包教（のむらかねのり）
```

### 4. Verify in UI
```
Visit: https://nihontowatch.com/?tab=available&cat=tosogu&enriched=true&listing=7023

Expected:
- Official NBTHK designation document format
- Proper "Jūyō-Tōsōgu, 46th Session — Designated October 5, 2000" header
- "Gathering of Immortals" (群仙図) design description
```

## Rollback Plan

If anything goes wrong:

```sql
-- Restore from backup
INSERT INTO yuhinkai_enrichments
SELECT * FROM yuhinkai_enrichments_backup_20260121;

-- Verify restoration
SELECT id, listing_id, yuhinkai_uuid FROM yuhinkai_enrichments WHERE listing_id = 7023;
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Delete wrong record | Low | Medium | Verify listing_id before DELETE |
| Backfill produces wrong match | Low | Low | Dry run + verify UUID before commit |
| API cache shows stale data | Medium | Low | Wait for cache expiry (1 hour) or bust cache |
| Database connection fails | Low | None | Transaction will rollback |

## Success Criteria

1. Enrichment UUID is `5f803fe4-879d-4663-aae4-8f6b91ff7814`
2. `setsumei_ja` starts with "平成十二年十月五日指定"
3. `setsumei_ja` length is ~800 chars (not 101)
4. UI shows official catalog format, not biographical text

## Timeline

| Step | Duration | Checkpoint |
|------|----------|------------|
| Pre-verification | 2 min | Confirm bad data exists |
| Create backup | 30 sec | Backup table created |
| Delete bad record | 30 sec | No records for listing 7023 |
| Dry run match | 2 min | Verify correct UUID matched |
| Execute enrichment | 1 min | New enrichment created |
| Post-verification | 2 min | All success criteria met |
| **Total** | ~8 min | |

## Cleanup (After Success)

```sql
-- Remove backup table (keep for 7 days, then delete)
-- DROP TABLE yuhinkai_enrichments_backup_20260121;
```

---

## Appendix: Why This Happened (Root Cause)

The fabricated enrichment was likely created by a non-standard code path. Investigation suggests:

1. **Not from `run_backfill.py`**: The backfill uses the SOTA matcher which would have found the real UUID
2. **Possible source**: A manual/test script that generated synthetic data when no exact match was found
3. **Timestamp**: `2026-01-20T23:10:09` suggests initial deployment testing

**Prevention:**
- Add UUID validation to enricher: verify UUID exists in oshi-v2 before saving
- Add setsumei format validation: check for official markers (年月日指定, 第X回)

---

## Post-Execution Notes (2026-01-21)

### What Was Done

1. **Pre-verification**: Confirmed bad data existed (fake UUID `f2efffa8-...`)
2. **Backup created**: `/tmp/enrichment_7023_backup.json`
3. **Bad record deleted**: Enrichment ID 1
4. **New enrichment created**: Enrichment ID 64 with correct UUID `5f803fe4-879d-4663-aae4-8f6b91ff7814`
5. **Verification status**: Set to `confirmed` with manual verification notes

### Caching Issue Discovered

After database fix, UI still showed old data due to **multi-layer caching**:
- Vercel ISR cache ignored `?nocache=1` parameter
- ISR caches function results independently of HTTP Cache-Control

### Caching Fix Applied

1. Disabled ISR caching (`revalidate = 0`, `dynamic = 'force-dynamic'`)
2. HTTP Cache-Control still provides CDN caching
3. `?nocache=1` now properly bypasses all caching layers
4. New deployment clears old ISR cache

See `docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md` Issue #3 for full analysis.

### Commits

- Database fix: Manual SQL (not committed)
- Caching fix: `ddf1a46` - "fix: Disable ISR caching for listing APIs to enable cache bypass"

### Verification After Deployment

Visit: `https://nihontowatch.com/?tab=available&cat=tosogu&enriched=true&listing=7023`

Expected:
- Official NBTHK text starting with: "平成十二年十月五日指定"
- NOT: "野村包教（のむらかねのり）" (LLM-generated)

For debugging: Add `&nocache=1` to bypass all caches
