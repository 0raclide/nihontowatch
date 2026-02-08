# Sync Elite Factor API

Webhook endpoint for syncing artisan elite factors from Yuhinkai database to Nihontowatch listings.

## Overview

When elite_factor values are recomputed in Oshi-v2 (triggered by gold value updates in Yuhinkai), this endpoint syncs the updated values to the denormalized `artisan_elite_factor` column in Nihontowatch's listings table.

**Endpoints:**
- `POST /api/admin/sync-elite-factor` — Targeted or full sync (used by webhook + manual)
- `GET /api/admin/sync-elite-factor` — Full sync (used by daily cron)

## Three Sync Mechanisms

| Mechanism | Trigger | Scope | How |
|-----------|---------|-------|-----|
| **Fire-and-forget webhook** | User edits artisan code in Yuhinkai | Only the changed artisan(s) | POST with `artisan_codes` |
| **Daily cron** | `0 6 * * *` UTC (`vercel.json`) | All listings with `artisan_id` | GET (Vercel cron) |
| **Manual full sync** | Operator runs curl command | All listings with `artisan_id` | POST with `{ "all": true }` |

## Authentication

Uses the same `CRON_SECRET` as other cron jobs:

```
Authorization: Bearer {CRON_SECRET}
```

Or:

```
x-cron-secret: {CRON_SECRET}
```

## Request Body (POST)

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

The webhook is already implemented in `oshi-v2/src/app/api/catalog/[uuid]/artisan-code/route.ts`. When a user changes an artisan code in Yuhinkai, it fires and forgets a POST to this endpoint with the affected codes:

```typescript
// Fire and forget (doesn't block UI)
if (process.env.NIHONTOWATCH_CRON_SECRET) {
  fetch('https://nihontowatch.com/api/admin/sync-elite-factor', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NIHONTOWATCH_CRON_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ artisan_codes: affectedCodes })
  }).catch(err => console.error('Sync failed:', err));
}
```

## Daily Cron

A daily cron in `vercel.json` ensures values stay fresh even if individual webhooks fail:

```json
{
  "path": "/api/admin/sync-elite-factor",
  "schedule": "0 6 * * *"
}
```

The `GET` handler triggers a full sync (all listings with `artisan_id`) when authenticated via Vercel's cron mechanism.

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

## Manual Full Sync

For one-time backfills or when values have gone null, trigger a full sync via curl:

```bash
curl -X POST https://nihontowatch.com/api/admin/sync-elite-factor \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"all": true}'
```

**Last full sync:** 2026-02-08 — 2,113 artisan codes updated, 0 errors, ~102 seconds.

## Troubleshooting

### All listings show `artisan_elite_factor: null`

This happened on 2026-02-08 after V2 artisan codes were deployed but the sync was never triggered. **The fix is to run a manual full sync** (see above).

**If this recurs, check in order:**
1. Is the daily cron still in `vercel.json`? (Should be `0 6 * * *`)
2. Does `CRON_SECRET` still match between NihontoWatch and Yuhinkai Vercel environments?
3. Is the Yuhinkai cross-DB client still working? (`src/lib/supabase/yuhinkai.ts`)
4. Do listings actually have `artisan_id` set? (The sync only touches listings where `artisan_id IS NOT NULL`)

### Webhook returns 401 Unauthorized

1. Verify `CRON_SECRET` in NihontoWatch Vercel matches `NIHONTOWATCH_CRON_SECRET` in Yuhinkai Vercel
2. Header format must be exactly `Authorization: Bearer {secret}`

### Values drift after bulk Yuhinkai recompute

If Yuhinkai runs a full `compute_maker_statistics()`, individual webhooks aren't fired. The daily cron at 06:00 UTC will catch up, or trigger a manual full sync.

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
| `src/app/api/admin/sync-elite-factor/route.ts` | API endpoint (POST + GET handlers) |
| `src/lib/supabase/yuhinkai.ts` | Yuhinkai database client |
| `supabase/migrations/050_artisan_elite_factor.sql` | Schema migration |
| `vercel.json` | Daily cron configuration |

## See Also

- [ARTISAN_TOOLTIP_VERIFICATION.md](./ARTISAN_TOOLTIP_VERIFICATION.md) - Artisan display and QA
- [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md) - Oshi-v2 and Yuhinkai references
- Oshi-v2: [ELITE_FACTOR_SYNC.md](../../oshi-v2/docs/ELITE_FACTOR_SYNC.md) - Full system documentation
