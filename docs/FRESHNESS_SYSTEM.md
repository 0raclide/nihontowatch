# Listing Freshness System

Accurate "Listed X days ago" information based on verified data, not just scrape timestamps.

## The Problem

When we scrape a dealer's catalog, `first_seen_at` only tells us when WE first saw the listing - not when the dealer originally listed it. This leads to misleading scenarios:

- **Bulk import**: Scraping a new dealer shows all 500 listings as "Listed today"
- **Scraper downtime**: Listings added during downtime all appear with the same date
- **Historical inventory**: Old listings show recent dates if we just started tracking them

## The Solution

A **freshness confidence system** that:
1. Tracks when we've established a "baseline" catalog for each dealer
2. Only claims a listing is "new" if it appeared AFTER the baseline
3. Uses Wayback Machine to verify older listings when possible
4. Displays freshness info only when we're confident it's accurate

---

## Database Schema

### Dealers Table
```sql
catalog_baseline_at TIMESTAMPTZ  -- When full catalog was first scraped
```

### Listings Table
```sql
listing_published_at TIMESTAMPTZ     -- Best estimate of actual publish date
freshness_source TEXT                -- 'dealer_meta' | 'wayback' | 'inferred' | 'unknown'
freshness_confidence TEXT            -- 'high' | 'medium' | 'low' | 'unknown'
wayback_first_archive_at TIMESTAMPTZ -- Wayback Machine first archive date
wayback_checked_at TIMESTAMPTZ       -- When we last checked Wayback
```

### Indexes
```sql
idx_listings_freshness_check    -- For finding listings needing verification
idx_listings_wayback_unchecked  -- For Wayback batch processing
```

---

## Confidence Levels

| Level | Meaning | Source | UI Display |
|-------|---------|--------|------------|
| `high` | Verified listing age | Wayback, dealer metadata, or post-baseline | "Listed X days ago" ✓ |
| `medium` | Some confidence | Partial verification | "First seen X days ago" ? |
| `low` | Predates baseline | Initial import, unverified | "First seen X days ago" ? |
| `unknown` | Not evaluated yet | No baseline established | "First seen X days ago" ? |

---

## Freshness Calculation Logic

```
1. If listing_published_at exists → HIGH (dealer_meta)
2. If wayback_first_archive_at exists → HIGH (wayback)
3. If first_seen_at > dealer.catalog_baseline_at → HIGH (inferred)
4. If first_seen_at <= dealer.catalog_baseline_at → LOW (unknown)
5. If no baseline established → UNKNOWN
```

**Priority for display date:**
1. `listing_published_at` (from dealer page)
2. `wayback_first_archive_at` (from Wayback Machine)
3. `first_seen_at` (when we scraped it)

---

## Wayback Machine Integration

### API
Uses the CDX Server API to find oldest archive:
```
GET https://web.archive.org/cdx/search/cdx?url=<URL>&limit=1&output=json&fl=timestamp
```

### Rate Limiting
- **1 request per minute** (conservative to respect archive.org)
- Background cron job processes 5 listings every 5 minutes
- Oldest listings checked first (most likely to be archived)

### Cron Job
**Endpoint:** `/api/cron/wayback-check`
**Schedule:** Every 5 minutes (`*/5 * * * *`)
**Batch size:** 5 listings per run

---

## UI Display

### QuickViewContent.tsx

Shows freshness with verification icon:
- **Verified** (✓ green checkmark): High confidence - we know the listing date
- **Unverified** (? gray question): Low/unknown confidence - this is our scrape date

```tsx
import { formatFreshnessDisplay } from '@/lib/freshness';

const freshness = formatFreshnessDisplay(listing);
// { text: "Listed 3 days ago", show: true, isVerified: true }
```

---

## Admin APIs

### GET /api/admin/dealers/baseline
Lists all dealers with baseline status and listing counts.

```json
{
  "dealers": [
    {
      "id": 1,
      "name": "Aoi Art",
      "catalog_baseline_at": "2025-01-15T00:00:00Z",
      "listing_count": 342,
      "has_baseline": true
    }
  ]
}
```

### POST /api/admin/dealers/baseline
Set a dealer's catalog baseline date.

```json
{
  "dealer_id": 1,
  "baseline_at": "2025-01-15T00:00:00Z"  // Optional, defaults to NOW()
}
```

This marks all listings before the baseline as `low` confidence.

---

## File Structure

```
src/lib/freshness/
├── types.ts       # FreshnessConfidence, FreshnessSource types
├── calculator.ts  # calculateFreshness(), needsWaybackCheck()
├── display.ts     # formatFreshnessDisplay(), getFreshnessIcon()
└── index.ts       # Barrel exports

src/lib/wayback/
├── types.ts       # WaybackCheckResult type
├── client.ts      # checkWaybackArchive(), WaybackRateLimiter
└── index.ts       # Barrel exports

src/app/api/
├── cron/wayback-check/route.ts      # Background Wayback verification
└── admin/dealers/baseline/route.ts  # Dealer baseline management
```

---

## Testing

### Unit Tests
```bash
npx vitest run tests/unit/freshness-calculator.test.ts
npx vitest run tests/unit/freshness-display.test.ts
```

**Coverage:**
- All confidence level calculations
- Date priority logic
- Time formatting (today, yesterday, X days ago)

### Integration Tests
```bash
npx vitest run tests/integration/wayback-client.test.ts
```

**Coverage:**
- CDX API response parsing
- Error handling (HTTP, network, malformed JSON)
- Rate limiter timing

### E2E Tests
```bash
npx playwright test tests/freshness-display.spec.ts
```

**Coverage:**
- QuickView freshness display
- Verification icon presence
- API response includes freshness fields

---

## Operational Guide

### Setting Baselines for New Dealers

1. Wait for full catalog discovery + scraping to complete
2. Call the baseline API:
   ```bash
   curl -X POST /api/admin/dealers/baseline \
     -H "Content-Type: application/json" \
     -d '{"dealer_id": 1}'
   ```
3. Future listings will have high confidence

### Monitoring Wayback Progress

Check how many listings have been verified:
```sql
SELECT
  freshness_confidence,
  COUNT(*)
FROM listings
WHERE status = 'available'
GROUP BY freshness_confidence;
```

Check Wayback verification queue:
```sql
SELECT COUNT(*)
FROM listings
WHERE wayback_checked_at IS NULL
  AND status = 'available';
```

### Forcing Wayback Re-check

To re-check a listing:
```sql
UPDATE listings
SET wayback_checked_at = NULL,
    freshness_confidence = 'unknown'
WHERE id = <listing_id>;
```

---

## Migration Notes

### Migration 015_listing_freshness.sql

Adds all freshness fields to the schema. Safe to run on existing data - all existing listings will have:
- `freshness_confidence = 'unknown'`
- `freshness_source = 'unknown'`
- Other freshness fields as `NULL`

The Wayback cron job will gradually verify listings over time.

---

## Related Documentation

- [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) - Admin dashboard
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [DEALERS.md](./DEALERS.md) - Dealer-specific notes
