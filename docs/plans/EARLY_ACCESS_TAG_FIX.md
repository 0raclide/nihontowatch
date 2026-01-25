# Plan: Early Access Tag Respects Trial Mode

## Problem

The "Early Access" tag still displays on listings < 72 hours old even when trial mode is active (`NEXT_PUBLIC_TRIAL_MODE=true`). This is semantically confusing because:

- "Early Access" implies the listing is premium-only (free users can't see it yet)
- In trial mode, everyone can see all listings with no delay
- The tag suggests exclusive access when there is none

## Root Cause

**File:** `src/components/browse/ListingCard.tsx` (line 595)

```typescript
{isEarlyAccessListing(listing.first_seen_at) ? 'Early Access' : 'New'}
```

The `isEarlyAccessListing()` function only checks if the listing is within the 72-hour window but doesn't consider trial mode status.

## Solution

Modify the badge logic to show "New" instead of "Early Access" when trial mode is active.

### Changes Required

#### 1. `src/components/browse/ListingCard.tsx`

**Add import:**
```typescript
import { isTrialModeActive } from '@/types/subscription';
```

**Modify line 595 (badge text):**
```typescript
// Before:
{isEarlyAccessListing(listing.first_seen_at) ? 'Early Access' : 'New'}

// After:
{isEarlyAccessListing(listing.first_seen_at) && !isTrialModeActive() ? 'Early Access' : 'New'}
```

**Logic explanation:**
- If listing is < 72h old AND trial mode is OFF → "Early Access"
- If listing is < 72h old AND trial mode is ON → "New"
- If listing is > 72h old → "New"

### Behavior Matrix

| Listing Age | Trial Mode | Badge Text |
|-------------|------------|------------|
| < 72 hours  | ON         | New        |
| < 72 hours  | OFF        | Early Access |
| 72h - 7d    | ON/OFF     | New        |
| > 7 days    | ON/OFF     | (no badge) |

### When Paywall Returns

When `NEXT_PUBLIC_TRIAL_MODE` is set to `false` or removed:
- "Early Access" badges automatically reappear for listings < 72h old
- No code changes needed - the condition already checks `isTrialModeActive()`
- Free users will once again see the 72h delay enforced server-side

## Testing

1. Verify with `NEXT_PUBLIC_TRIAL_MODE=true`:
   - Listings < 72h old show "New" (not "Early Access")
   - Listings 72h-7d old show "New"
   - Listings > 7d old show no badge

2. Verify with `NEXT_PUBLIC_TRIAL_MODE=false` (or unset):
   - Listings < 72h old show "Early Access"
   - Listings 72h-7d old show "New"

## Files Changed

- `src/components/browse/ListingCard.tsx` (2 line changes)

## Rollback

If issues arise, simply revert the conditional:
```typescript
{isEarlyAccessListing(listing.first_seen_at) ? 'Early Access' : 'New'}
```

This returns to always showing "Early Access" for listings < 72h regardless of trial mode.
