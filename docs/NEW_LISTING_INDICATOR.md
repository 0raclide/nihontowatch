# New Listing Indicator

This document describes the "New this week" badge feature that highlights recently discovered listings on Nihontowatch.

## Overview

When our scraper discovers new items from dealers we've previously scraped, those items display a green "New this week" badge on their listing cards for 7 days. This helps collectors identify fresh inventory.

## How It Works

### Core Logic

A listing shows the badge if **both conditions** are met:

1. **Not part of initial import**: The listing's `first_seen_at` is more than 24 hours after the dealer's baseline (earliest `first_seen_at`)
2. **Within 7 days**: The listing was discovered within the last 7 days

### Initial Import Window

When a dealer is first added to our system, we scrape all their existing inventory at once. These items all get `first_seen_at` timestamps within the same 24-hour window. We don't show badges for these items because they weren't "new to market" - they were just "new to us."

```
Dealer Baseline: Jan 10, 12:00
├── Item A: Jan 10, 12:05  → Part of initial import (no badge)
├── Item B: Jan 10, 15:30  → Part of initial import (no badge)
├── Item C: Jan 11, 11:59  → Part of initial import (no badge, <24h)
├── Item D: Jan 11, 13:00  → GENUINELY NEW (badge shows if <7 days old)
└── Item E: Jan 15, 09:00  → GENUINELY NEW (badge shows for 7 days)
```

### Scenario Examples

| Scenario | Badge Shown | Why |
|----------|-------------|-----|
| Established dealer lists new item | Yes | After 24h window, listing < 7 days |
| Initial import when dealer onboarded | No | Within 24h window of baseline |
| Newly onboarded dealer gets fresh inventory 2 days later | Yes | After 24h window, listing < 7 days |
| URL reused for different item | Yes | Change detection resets `first_seen_at` |
| Listing is 8 days old | No | Beyond 7-day threshold |

### Data Source

The feature uses the `first_seen_at` timestamp from the `listings` table:

```sql
first_seen_at TIMESTAMPTZ DEFAULT NOW()
```

This field records when Nihontowatch first scraped the listing.

### Change Detection (URL Reuse)

For dealers who reuse URLs for new items, the Oshi-scrapper's **change detection system** handles this:

1. **Tier 1 Detection**: During catalog crawls, compares title/thumbnail/price
2. **Tier 2 Detection**: After rescraping, compares identity markers (smith, cert_session, nagasa_cm)
3. **Reset Behavior**: When a different item is detected at the same URL, the old listing is archived and `first_seen_at` is reset

This means `first_seen_at` accurately reflects when **this specific item** was first seen.

## Configuration

Settings in `src/lib/constants.ts`:

```typescript
export const NEW_LISTING = {
  THRESHOLD_DAYS: 7,                    // Badge displays for 7 days
  INITIAL_IMPORT_WINDOW_HOURS: 24,      // 24-hour window for initial import
} as const;
```

## UI Behavior

### Badge Placement

The "New this week" badge appears in the badge slot alongside certification badges:

```
┌─────────────────────────────────┐
│ aoijapan.com                    │  ← Dealer header
├─────────────────────────────────┤
│                                 │
│         [Image]                 │
│                                 │
├─────────────────────────────────┤
│ [Jūyō] [New this week]          │  ← Badges (cert + new)
│ Katana                          │
│ Kotetsu                         │
│ ¥3,500,000                      │
└─────────────────────────────────┘
```

### Badge Combinations

| Scenario | Display |
|----------|---------|
| New + Certified | Both badges shown side-by-side |
| New + No cert | Only "New this week" badge shown |
| Old + Certified | Only certification badge shown |
| Old + No cert | No badges shown |

### Styling

The badge uses theme-aware colors:

| Theme | Color | CSS Variable |
|-------|-------|--------------|
| Light | #2D8A5A (forest green) | `--new-listing` |
| Dark | #50d890 (bright green) | `--new-listing` |
| Opus | #68c890 (warm green) | `--new-listing` |

## API

### Utility Functions

Located in `src/lib/newListing.ts`:

```typescript
// Full check - use this in components
shouldShowNewBadge(
  listingFirstSeenAt: string | null | undefined,
  dealerEarliestSeenAt: string | null | undefined
): boolean

// Check if listing was part of initial import (within 24h of baseline)
isPartOfInitialImport(
  listingFirstSeenAt: string | null | undefined,
  dealerEarliestSeenAt: string | null | undefined
): boolean

// Check if listing is within threshold (7 days)
isNewListing(firstSeenAt: string | null | undefined): boolean

// Get days since a date (returns Infinity for invalid dates)
daysSince(date: string | null | undefined): number

// Get human-readable label ("Today", "3d ago", etc.)
getNewListingLabel(firstSeenAt: string | null | undefined): string | null
```

### Usage Example

```typescript
import { shouldShowNewBadge } from '@/lib/newListing';

// In a component
{shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at) && (
  <span className="bg-new-listing-bg text-new-listing">
    New this week
  </span>
)}
```

### Browse API Enrichment

The `/api/browse` route enriches each listing with `dealer_earliest_seen_at`:

```typescript
// Query dealer baselines
const baselineMap = {}; // dealer_id -> earliest first_seen_at

// Add to each listing
enrichedListings = listings.map(listing => ({
  ...listing,
  dealer_earliest_seen_at: baselineMap[listing.dealer_id] || null,
}));
```

## Testing

The feature has comprehensive test coverage:

### Unit Tests (`tests/lib/newListing.test.ts`)
- `daysSince` - date calculation edge cases
- `isNewListing` - threshold boundary conditions
- `isPartOfInitialImport` - 24-hour window detection
- `shouldShowNewBadge` - full integration scenarios
- Null/undefined/invalid date handling
- Timezone handling
- Real-world Supabase timestamp formats

### Component Tests (`tests/components/browse/ListingCard.test.tsx`)
- Badge visibility based on listing age
- Initial import detection (within 24h of baseline)
- Badge text ("New this week")
- Coexistence with certification badges
- Correct CSS classes applied

Run tests:
```bash
npm test -- --run tests/lib/newListing.test.ts tests/components/browse/ListingCard.test.tsx
```

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/constants.ts` | Threshold configuration |
| `src/lib/newListing.ts` | Utility functions |
| `src/app/globals.css` | Badge color variables |
| `src/app/api/browse/route.ts` | API enrichment with dealer baseline |
| `src/components/browse/ListingCard.tsx` | Badge rendering |
| `tests/lib/newListing.test.ts` | Unit tests |
| `tests/components/browse/ListingCard.test.tsx` | Component tests |

## "Newest" Sort Prioritization

As of January 2026, the "Newest" sort prioritizes genuine new inventory over bulk imports.

### How It Works

The sort uses two columns:
1. **`is_initial_import`** (boolean) - `FALSE` = genuine new inventory, `TRUE` = bulk import
2. **`first_seen_at`** (timestamp) - when the listing was discovered

```sql
ORDER BY is_initial_import ASC, first_seen_at DESC
```

This means:
1. **Tier 1**: Genuine new inventory (not part of initial import), sorted by discovery date
2. **Tier 2**: Bulk imports, sorted by discovery date

### Database Schema

**`dealers.earliest_listing_at`** - Tracks when the dealer's first listing was discovered (baseline)

**`listings.is_initial_import`** - Static boolean set at insert time:
- `TRUE` if `first_seen_at <= dealer.earliest_listing_at + 24 hours`
- `FALSE` if discovered after the 24-hour import window

### Triggers

Two triggers maintain this data automatically:

1. **`trigger_update_dealer_earliest_listing`** - Updates dealer baseline when new listing is earlier
2. **`trigger_set_is_initial_import`** - Sets `is_initial_import` on new listings

### Example Sort Order

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Genuine New Inventory (is_initial_import = FALSE)       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Katana from Aoi Art (discovered today)                       │
│ 2. Tsuba from Eirakudo (discovered 2 days ago)                  │
│ 3. Wakizashi from Nipponto (discovered 5 days ago)              │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: Bulk Imports (is_initial_import = TRUE)                 │
├─────────────────────────────────────────────────────────────────┤
│ 4. Katana from NewDealer (discovered today, part of onboarding) │
│ 5. Tsuba from NewDealer (discovered today, part of onboarding)  │
│ 6. Wakizashi from OldDealer (discovered 2 years ago)            │
└─────────────────────────────────────────────────────────────────┘
```

### Related Files

| File | Purpose |
|------|---------|
| `supabase/migrations/037_dealer_earliest_listing.sql` | Adds `earliest_listing_at` to dealers |
| `supabase/migrations/038_listing_is_initial_import.sql` | Adds `is_initial_import` to listings |
| `src/app/api/browse/route.ts` | Sort implementation |
| `tests/sql/initial-import.test.ts` | Trigger tests |
| `tests/api/browse.test.ts` | Sort behavior tests |

---

## Future Enhancements

Potential improvements:

1. **Filter by new**: Add a "New arrivals" filter to the browse page
2. **Tooltip**: Show "Added X days ago" on hover
3. **Email alerts**: Notify users about new items matching their saved searches
