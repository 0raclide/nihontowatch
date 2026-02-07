# Sync Elite Factor API

Webhook endpoint for syncing artisan elite factors from Yuhinkai database to Nihontowatch listings.

## Overview

When elite_factor values are recomputed in Oshi-v2 (triggered by gold value updates in Yuhinkai), this endpoint syncs the updated values to the denormalized `artisan_elite_factor` column in Nihontowatch's listings table.

**Endpoint:** `POST /api/admin/sync-elite-factor`

## Authentication

Uses the same `CRON_SECRET` as other cron jobs:

```
Authorization: Bearer {CRON_SECRET}
```

Or:

```
x-cron-secret: {CRON_SECRET}
```

## Request Body

### Targeted Sync (Recommended)

Sync specific artisans after their elite_factor has been recomputed:

```json
{
  "artisan_codes": ["MAS590", "KUN123", "OWA009"]
}
```

### Full Refresh

Sync all artisans (use sparingly, takes longer):

```json
{
  "all": true
}
```

## Response

```json
{
  "success": true,
  "updated": 42,
  "notFound": 0,
  "errors": 0,
  "duration_ms": 1234
}
```

| Field | Description |
|-------|-------------|
| `updated` | Number of artisans successfully synced |
| `notFound` | Artisan codes not found in Yuhinkai (smith_entities or tosogu_makers) |
| `errors` | Database update errors |
| `duration_ms` | Total processing time |

## Integration with Oshi-v2

Add a webhook call after gold values are recomputed:

```python
import requests
import os

def sync_elite_factor_to_nihontowatch(artisan_codes: list[str]):
    """
    Call after elite_factor is recomputed in Yuhinkai.
    Triggered by gold value updates.
    """
    if not artisan_codes:
        return

    response = requests.post(
        "https://nihontowatch.com/api/admin/sync-elite-factor",
        headers={
            "Authorization": f"Bearer {os.environ['CRON_SECRET']}",
            "Content-Type": "application/json"
        },
        json={"artisan_codes": artisan_codes},
        timeout=300  # 5 min timeout for large batches
    )

    if response.ok:
        result = response.json()
        print(f"Synced {result['updated']} artisans to Nihontowatch")
    else:
        print(f"Sync failed: {response.status_code}")
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELITE FACTOR SYNC FLOW                      │
│                                                                 │
│  1. User edits Yuhinkai data (adds Juyo designation)           │
│                          │                                      │
│                          ▼                                      │
│  2. Gold values recompute in Oshi-v2                           │
│     - elite_factor = (elite_count + 1) / (total_items + 10)    │
│     - Updated in smith_entities / tosogu_makers                │
│                          │                                      │
│                          ▼                                      │
│  3. Webhook calls Nihontowatch API                             │
│     POST /api/admin/sync-elite-factor                          │
│     { "artisan_codes": ["MAS590"] }                            │
│                          │                                      │
│                          ▼                                      │
│  4. Nihontowatch fetches fresh elite_factor from Yuhinkai      │
│                          │                                      │
│                          ▼                                      │
│  5. Updates listings.artisan_elite_factor for all listings     │
│     with that artisan_id                                       │
│                          │                                      │
│                          ▼                                      │
│  6. End user sees updated sort order by Elite Factor           │
└─────────────────────────────────────────────────────────────────┘
```

## Manual Sync

For one-time backfills or testing, use the backfill script:

```bash
npx tsx scripts/backfill-elite-factor.ts
```

This script:
- Finds all listings with `artisan_id` but no `artisan_elite_factor`
- Fetches elite_factor from Yuhinkai in parallel (20 workers)
- Updates listings in batches
- Caches artisan lookups for efficiency

## Database Schema

```sql
-- Column added by migration 050_artisan_elite_factor.sql
ALTER TABLE listings ADD COLUMN artisan_elite_factor NUMERIC(5,4);

-- Index for efficient sorting
CREATE INDEX idx_listings_artisan_elite_factor
  ON listings(artisan_elite_factor DESC NULLS LAST);
```

## Related Files

| File | Purpose |
|------|---------|
| `src/app/api/admin/sync-elite-factor/route.ts` | API endpoint |
| `scripts/backfill-elite-factor.ts` | Manual backfill script |
| `src/lib/supabase/yuhinkai.ts` | Yuhinkai database client |
| `supabase/migrations/050_artisan_elite_factor.sql` | Schema migration |

## See Also

- [ARTISAN_TOOLTIP_VERIFICATION.md](./ARTISAN_TOOLTIP_VERIFICATION.md) - Artisan display and QA
- [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md) - Oshi-v2 and Yuhinkai references
