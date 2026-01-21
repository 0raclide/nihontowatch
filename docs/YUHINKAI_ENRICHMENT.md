# Yuhinkai Enrichment Feature

## Overview

NihontoWatch listings can be enriched with professional English translations from the Yuhinkai catalog. This provides collectors with authoritative descriptions for Juyo-certified items.

**Supported item types:**
- Tosogu (sword fittings): tsuba, fuchi-kashira, menuki, kozuka, etc.
- Nihonto (blades): katana, wakizashi, tanto, tachi, etc.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Oshi-scrapper                Yuhinkai (oshi-v2)            │
│  ┌──────────────┐            ┌──────────────┐               │
│  │  listings    │            │ gold_values  │               │
│  │  ├─ id       │            │ ├─ uuid      │               │
│  │  ├─ title    │◄───OCR────►│ ├─ artisan   │               │
│  │  └─ images   │  matching  │ └─ japanese  │               │
│  └──────────────┘            └──────────────┘               │
│         │                           │                        │
│         │    yuhinkai_enrichments   │                        │
│         │    ┌──────────────────┐   │                        │
│         └───►│ listing_id ──────┼───┘                        │
│              │ yuhinkai_uuid    │                            │
│              │ translation_md   │◄── English translation    │
│              │ match_score      │                            │
│              └──────────────────┘                            │
│                       │                                      │
│                       ▼                                      │
│              NihontoWatch Frontend                           │
│              ┌──────────────────┐                           │
│              │ YuhinkaiEnrich-  │                           │
│              │ mentSection.tsx  │                           │
│              └──────────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Components

### `YuhinkaiEnrichmentSection.tsx`
Displays the enrichment on listing detail pages.

```tsx
// src/components/listing/YuhinkaiEnrichmentSection.tsx
interface Props {
  listingId: number;
}

// Fetches from /api/listing/[id] which includes enrichment data
// Displays:
// - "Catalog Enriched" badge
// - Professional English translation
// - Match confidence score
// - Link to Yuhinkai source
```

### `CatalogEnrichedBadge.tsx`
Small badge shown on listing cards for enriched items.

```tsx
// src/components/ui/CatalogEnrichedBadge.tsx
// Shows when listing has yuhinkai_enrichment
```

## API Response

The listing API includes enrichment data when available:

```json
// GET /api/listing/10324
{
  "id": 10324,
  "title": "雲形透日足鑢鐔 無銘 彦三",
  "yuhinkai_enrichment": {
    "yuhinkai_uuid": "abc-123-...",
    "match_score": 0.82,
    "translation_md": "## Cloud-shaped openwork tsuba...",
    "japanese_txt": "昭和五十七年...",
    "created_at": "2026-01-21T..."
  }
}
```

## Database Schema

```sql
-- yuhinkai_enrichments table (in NihontoWatch Supabase)
CREATE TABLE yuhinkai_enrichments (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) UNIQUE,
  yuhinkai_uuid UUID NOT NULL,          -- Links to oshi-v2
  match_score FLOAT NOT NULL,           -- 0.0-1.0
  match_signals JSONB,                  -- Debug info
  translation_md TEXT,                  -- English (markdown)
  japanese_txt TEXT,                    -- Original Japanese
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Backfill Process

Enrichments are created by backfill scripts in Oshi-scrapper:

```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper

# Tosogu enrichment
python3 run_backfill.py

# Sword enrichment
python3 run_sword_backfill.py
```

**Critical**: When fetching catalog_records for enrichment, always include `translation_md`:
```python
# Correct - includes translation_md
cat_resp = yuhinkai_client.table('catalog_records').select(
    'collection, volume, item_number, japanese_txt, translation_md'
)
```

See full documentation: `/Oshi-scrapper/docs/YUHINKAI_ENRICHMENT_SYSTEM.md`

## Current Status

| Metric | Value |
|--------|-------|
| Enriched tosogu | 9 |
| Total eligible | 17 |
| Coverage | 52.9% |

## Related Files

### NihontoWatch
- `src/components/listing/YuhinkaiEnrichmentSection.tsx` - Displays enrichment content
- `src/components/ui/CatalogEnrichedBadge.tsx` - Badge for enriched items
- `src/hooks/useListingEnrichment.ts` - On-demand enrichment fetching
- `src/app/listing/[id]/ListingDetailClient.tsx` - Detail page integration
- `src/app/api/listing/[id]/enrichment/route.ts` - Enrichment API endpoint

### Oshi-scrapper
- `run_backfill.py` - Tosogu backfill script
- `run_sword_backfill.py` - Sword backfill script
- `setsumei/tosogu_sota.py` - Tosogu matching algorithm
- `setsumei/matchers/sword.py` - Sword matching algorithm
- `setsumei/enrichment/enricher.py` - Enrichment logic
- `setsumei/enrichment/repository.py` - Database operations
- `tests/setsumei/enrichment/test_enricher.py` - Enricher tests
- `docs/YUHINKAI_ENRICHMENT_SYSTEM.md` - Full documentation

## Postmortems

- `docs/POSTMORTEM_SWORD_SETSUMEI_MISSING.md` - Sword enrichments missing translation fix
