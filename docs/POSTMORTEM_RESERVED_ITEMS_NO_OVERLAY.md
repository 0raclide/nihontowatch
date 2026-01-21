# Postmortem: Reserved Items Missing Visual Indicator

**Date:** 2026-01-21
**Severity:** Medium
**Status:** Resolved
**Commit:** `a8251be`

## Issue Summary

Items with `status="reserved"` were appearing in browse results without any visual indicator of being unavailable. Users viewing these items would see them as if they were available for purchase, when in fact they were already reserved, under negotiation, or out of stock.

## Detection

User reported that listing #9619 (a Nobuie tsuba from Kusanagi) was marked as "SOLD" on the dealer's website but appeared available on nihontowatch.com.

## Investigation

### Database State (Listing #9619)
```
status: "reserved"
is_available: false
is_sold: false
last_scraped_at: 2026-01-17 (4 days stale)
```

### Dealer Page State
- Japanese text: "在庫切れ" (out of stock)
- Schema.org markup: `OutOfStock`
- Price: 0円 (indicating not for sale)

### Root Cause

The `ListingCard` component only showed an overlay for items where:
```javascript
const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
```

Items with `status="reserved"` and `is_available=false` had **no visual indicator**.

### Scope Analysis

| Dealer | Reserved Items | Notes |
|--------|---------------|-------|
| World Seiyudo | 28 | 14% of their visible inventory |
| Kusanagi | 1 | Listing #9619 |
| Nihonto Art | 1 | |
| Touken Matsumoto | 1 | |
| **Total** | **31** | |

The "reserved" status is assigned by the scraper when:
- Page exists (`page_exists=true`)
- Item not available (`is_available=false`)
- Item not explicitly sold (`is_sold=false`)

This typically occurs when dealer pages show "在庫切れ" (out of stock), "商談中" (under negotiation), or similar statuses.

## Resolution

### Code Change

**File:** `src/components/browse/ListingCard.tsx`

```javascript
// Before
const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
// Overlay only shown for isSold

// After
const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
const isUnavailable = !listing.is_available;
// Overlay shown for isUnavailable, text varies based on isSold
```

### Visual Behavior

| Item Status | Overlay Text | Sale Data Shown |
|-------------|--------------|-----------------|
| Available | None | N/A |
| Sold | "SOLD" | Yes (date, days on market) |
| Reserved | "UNAVAILABLE" | No |
| Withdrawn | "UNAVAILABLE" | No |

### Test Coverage

Added test case in `tests/components/browse/ListingCard.test.tsx`:
```javascript
it('shows unavailable overlay for reserved items', () => {
  const reservedListing = { ...mockListing, is_sold: false, is_available: false, status: 'reserved' };
  render(<ListingCard {...defaultProps} listing={reservedListing} />);
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
});
```

## Timeline

- **15:10** - Issue reported
- **15:15** - Investigation started, listing #9619 examined
- **15:20** - Root cause identified (missing overlay for reserved status)
- **15:25** - Scope analysis completed (31 affected items)
- **15:30** - Fix implemented and tested
- **15:35** - Deployed to production

## Lessons Learned

1. **Data model has nuanced states**: The `status` field has more values than just "available" and "sold". The UI must handle all states appropriately.

2. **Test data should be realistic**: The original test for sold items used `is_sold: true` but kept `is_available: true` - an impossible state in production data.

3. **Dealer-specific patterns matter**: World Seiyudo accounted for 90% of reserved items. Understanding dealer-specific scraping patterns helps identify issues.

## Follow-up Actions

- [ ] Consider adding "reserved" to `ListingStatus` type in `src/types/index.ts` (currently missing)
- [ ] Review World Seiyudo scraper - should "在庫切れ" map to `sold` instead of `reserved`?
- [ ] Add monitoring for reserved item counts by dealer
