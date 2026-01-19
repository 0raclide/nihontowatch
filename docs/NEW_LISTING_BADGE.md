# New Listing Badge Logic

## Overview

The "New" badge indicates genuinely new inventory from established dealers. It helps collectors quickly identify fresh listings without flooding the UI with badges when new dealers are onboarded.

## Requirements

A listing shows the "New" badge when ALL of these conditions are met:

1. **Dealer is established** - Dealer's baseline (earliest listing) is at least 7 days old
2. **Not part of initial import** - Listing was added >24 hours after dealer's baseline
3. **Recently added** - Listing was added within the last 7 days

## Why Each Requirement Exists

### 1. Dealer Must Be Established (7+ days)

**Problem solved:** When we onboard a new dealer, we scrape their entire catalog. Without this check, ALL their listings would show badges after the first 24 hours.

**Example:**
- World Seiyudo onboarded Jan 16
- By Jan 17, all 170 listings would show "New" badges
- This floods the UI and makes the badge meaningless

**Solution:** Dealers must be in the system for 7+ days before their listings can show badges.

### 2. Not Part of Initial Import (>24h after baseline)

**Problem solved:** When we first scrape a dealer, we get all their existing inventory over several hours/days. These aren't "new" listings - they're existing inventory we're discovering.

**Example:**
- Aoi Art baseline: Dec 31, 2025
- Listings scraped on Dec 31: Part of initial import → no badge
- Listings scraped on Jan 2+: Genuinely new → can show badge

**Solution:** Items within 24 hours of the dealer's baseline are considered "initial import."

### 3. Recently Added (<7 days old)

**Problem solved:** Badges should be timely. A listing from 2 months ago isn't "new."

**Solution:** Only listings from the last 7 days can show the badge.

## Configuration

Located in `src/lib/constants.ts`:

```typescript
export const NEW_LISTING = {
  THRESHOLD_DAYS: 7,           // Max age for "new" badge + min dealer age
  INITIAL_IMPORT_WINDOW_HOURS: 24,  // Hours after baseline = initial import
} as const;
```

## Implementation

### Key Functions (`src/lib/newListing.ts`)

```typescript
// Check if dealer has been in system long enough
isDealerEstablished(dealerEarliestSeenAt, thresholdDays = 7): boolean

// Check if listing was part of initial catalog scrape
isPartOfInitialImport(listingFirstSeenAt, dealerEarliestSeenAt, windowHours = 24): boolean

// Check if listing is within the "new" window
isNewListing(firstSeenAt, thresholdDays = 7): boolean

// Main function - combines all checks
shouldShowNewBadge(listingFirstSeenAt, dealerEarliestSeenAt, thresholdDays = 7): boolean
```

### Data Flow

1. **Browse API** (`src/app/api/browse/route.ts`):
   - Fetches listings
   - Queries each dealer's baseline (earliest `first_seen_at`)
   - Enriches listings with `dealer_earliest_seen_at`

2. **Components** use `shouldShowNewBadge()`:
   - `ListingCard.tsx` - Badge in bottom-right corner
   - `QuickViewContent.tsx` - Badge in badges row
   - `QuickViewMobileSheet.tsx` - Badge in badges row
   - `listing/[id]/page.tsx` - Badge on detail page

## Visual Design

- **Position:** Bottom-right corner of card (opposite to price)
- **Text:** "New" (short for cards), "New this week" (in QuickView)
- **Style:** `bg-new-listing-bg text-new-listing` (green tones)

## Testing Scenarios

### Should Show Badge ✓

| Dealer Baseline | Listing Date | Today | Result |
|----------------|--------------|-------|--------|
| 14 days ago | 2 days ago | - | ✓ Badge |
| 30 days ago | 5 days ago | - | ✓ Badge |
| 10 days ago | 1 day ago | - | ✓ Badge |

### Should NOT Show Badge ✗

| Scenario | Dealer Baseline | Listing Date | Reason |
|----------|----------------|--------------|--------|
| New dealer | 3 days ago | 1 day ago | Dealer not established |
| Initial import | 14 days ago | 14 days ago | Within 24h of baseline |
| Too old | 30 days ago | 10 days ago | Listing >7 days old |
| No baseline | null | 2 days ago | Can't verify dealer |

## Common Issues

### "Too many badges showing"

**Cause:** Dealer established check was missing or bypassed.

**Fix:** Ensure `isDealerEstablished()` is called before other checks.

### "No badges showing for anyone"

**Cause:** Baseline enrichment failing (1000-row Supabase limit).

**Fix:** Query each dealer's baseline individually, not in one bulk query.

### "Badges on old listings"

**Cause:** `isNewListing()` threshold too high or not being checked.

**Fix:** Verify threshold is 7 days and function is being called.

## History

- **Initial implementation:** 14-day threshold, `isDealerEstablished()` check
- **Revision 1:** Changed to 24h import window + 7-day threshold, removed dealer check
- **Revision 2 (current):** Re-added dealer established check (7+ days required)
