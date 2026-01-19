# Plan: Fix False "New This Week" Badges

## Problem Statement

Items that have been on dealer websites for weeks are incorrectly displaying "New this week" badges. The reported example is listing ID 11117 from Nipponto (dealer 7), but the issue affects at least 30 listings currently.

## Root Cause Analysis

### The Bug

The Oshi-scrapper backend treats `http://` and `https://` versions of the same URL as different listings. When the scraper encounters a URL with a different protocol than what's already stored:

1. It doesn't find the existing listing (URL mismatch due to protocol)
2. It creates a **new** listing with `first_seen_at` = today
3. The new listing passes all "new badge" checks because it was genuinely "discovered" recently

### Evidence

**Listing 11117** (the reported item):
- URL: `http://www.nipponto.co.jp/swords2/KT221624.htm`
- `first_seen_at`: 2026-01-17 (2 days ago)
- Shows "New" badge ❌

**Listing 4282** (the original, same item):
- URL: `https://www.nipponto.co.jp/swords2/KT221624.htm`
- `first_seen_at`: 2026-01-02 (17 days ago)
- This is the same sword, duplicated due to http vs https

### Impact

| Dealer | Total Listings | Duplicate Groups | False "New" Badges |
|--------|----------------|------------------|-------------------|
| Nipponto | 202 | 32 | **30** |
| Shoubudou | 280 | 8 | 0 |
| Taiseido | 30 | 4 | 0 |
| **Total** | - | 44 | **30** |

## Solution Design

### Two-Part Fix

The fix requires changes in **both** repositories:

1. **Nihontowatch (this repo)** - Immediate mitigation + long-term deduplication
2. **Oshi-scrapper (Python repo)** - Root cause fix in scraper

### Part 1: Nihontowatch Changes (Frontend/API)

#### 1.1 Add URL Normalization Utility

Create `src/lib/urlNormalization.ts`:

```typescript
/**
 * Normalizes a URL for comparison/deduplication purposes.
 * Removes protocol differences (http/https) and www prefix.
 */
export function normalizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')  // Remove http:// or https://
    .replace(/^www\./, '');       // Remove www.
}

/**
 * Checks if two URLs point to the same resource (ignoring protocol/www).
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}
```

#### 1.2 Deduplicate Listings in Browse API

Modify `src/app/api/browse/route.ts` to filter out duplicate listings, keeping only the **oldest** version (by `first_seen_at`):

```typescript
// After fetching listings, before enrichment:
function deduplicateListings(listings: Listing[]): Listing[] {
  const byNormalizedUrl = new Map<string, Listing>();

  for (const listing of listings) {
    const normalized = normalizeUrl(listing.url);
    const existing = byNormalizedUrl.get(normalized);

    if (!existing) {
      byNormalizedUrl.set(normalized, listing);
    } else {
      // Keep the older one (lower first_seen_at)
      const existingDate = new Date(existing.first_seen_at || 0);
      const currentDate = new Date(listing.first_seen_at || 0);
      if (currentDate < existingDate) {
        byNormalizedUrl.set(normalized, listing);
      }
    }
  }

  return Array.from(byNormalizedUrl.values());
}
```

**Why keep the oldest?** The oldest listing has the true `first_seen_at` date, reflecting when the item actually appeared on the dealer's site.

#### 1.3 Update New Badge Logic (Optional Enhancement)

Optionally, add a check in `shouldShowNewBadge` to verify there's no older duplicate. This is a defense-in-depth measure:

```typescript
// In the API, before calling shouldShowNewBadge:
// Check if there's an older listing with the same normalized URL
const hasOlderDuplicate = allDealerListings.some(other =>
  other.id !== listing.id &&
  normalizeUrl(other.url) === normalizeUrl(listing.url) &&
  new Date(other.first_seen_at) < new Date(listing.first_seen_at)
);

if (hasOlderDuplicate) {
  // Don't show badge - this is a duplicate of an older listing
  return false;
}
```

### Part 2: Oshi-scrapper Changes (Scraper Backend)

The root cause fix must happen in the Python scraper. Document these changes for the scraper team:

#### 2.1 Normalize URLs Before Database Lookup

In the scraper, before checking if a URL exists in the database:

```python
def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    import re
    # Remove protocol
    url = re.sub(r'^https?://', '', url)
    # Remove www.
    url = re.sub(r'^www\.', '', url)
    return url

# When checking for existing listings:
# Instead of: SELECT * FROM listings WHERE url = $1
# Use: SELECT * FROM listings WHERE normalize_url(url) = normalize_url($1)
```

#### 2.2 Add Database Migration for Cleanup

Create a one-time cleanup script to:
1. Identify duplicate URL groups
2. Merge duplicates (keep oldest `first_seen_at`, update URL to canonical form)
3. Delete the newer duplicates

```sql
-- Example cleanup query (for reference)
WITH duplicates AS (
  SELECT
    id,
    url,
    first_seen_at,
    REGEXP_REPLACE(REGEXP_REPLACE(url, '^https?://', ''), '^www\.', '') as normalized_url,
    ROW_NUMBER() OVER (
      PARTITION BY REGEXP_REPLACE(REGEXP_REPLACE(url, '^https?://', ''), '^www\.', '')
      ORDER BY first_seen_at ASC
    ) as rn
  FROM listings
)
-- Delete all but the oldest in each group
DELETE FROM listings WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

## Testing Strategy

### Unit Tests

#### Test 1: URL Normalization

```typescript
// tests/lib/urlNormalization.test.ts
describe('normalizeUrl', () => {
  it('removes http:// protocol', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('example.com/page');
  });

  it('removes https:// protocol', () => {
    expect(normalizeUrl('https://example.com/page')).toBe('example.com/page');
  });

  it('removes www. prefix', () => {
    expect(normalizeUrl('https://www.example.com/page')).toBe('example.com/page');
  });

  it('handles already normalized URLs', () => {
    expect(normalizeUrl('example.com/page')).toBe('example.com/page');
  });
});

describe('urlsMatch', () => {
  it('matches http and https versions', () => {
    expect(urlsMatch(
      'http://nipponto.co.jp/swords2/KT221624.htm',
      'https://nipponto.co.jp/swords2/KT221624.htm'
    )).toBe(true);
  });

  it('matches with and without www', () => {
    expect(urlsMatch(
      'https://www.nipponto.co.jp/page',
      'https://nipponto.co.jp/page'
    )).toBe(true);
  });

  it('does not match different paths', () => {
    expect(urlsMatch(
      'https://nipponto.co.jp/page1',
      'https://nipponto.co.jp/page2'
    )).toBe(false);
  });
});
```

#### Test 2: Listing Deduplication

```typescript
// tests/lib/listingDeduplication.test.ts
describe('deduplicateListings', () => {
  it('keeps only the oldest listing when duplicates exist', () => {
    const listings = [
      { id: 11117, url: 'http://example.com/item1', first_seen_at: '2026-01-17' },
      { id: 4282, url: 'https://example.com/item1', first_seen_at: '2026-01-02' },
    ];

    const result = deduplicateListings(listings);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4282); // Older one kept
  });

  it('preserves unique listings', () => {
    const listings = [
      { id: 1, url: 'https://example.com/item1', first_seen_at: '2026-01-01' },
      { id: 2, url: 'https://example.com/item2', first_seen_at: '2026-01-02' },
    ];

    const result = deduplicateListings(listings);
    expect(result).toHaveLength(2);
  });

  it('handles multiple duplicate groups', () => {
    const listings = [
      { id: 1, url: 'http://example.com/item1', first_seen_at: '2026-01-17' },
      { id: 2, url: 'https://example.com/item1', first_seen_at: '2026-01-02' },
      { id: 3, url: 'http://example.com/item2', first_seen_at: '2026-01-15' },
      { id: 4, url: 'https://example.com/item2', first_seen_at: '2026-01-05' },
    ];

    const result = deduplicateListings(listings);
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id).sort()).toEqual([2, 4]); // Older ones kept
  });
});
```

#### Test 3: False New Badge Prevention

```typescript
// tests/lib/newListing.test.ts (additions)
describe('shouldShowNewBadge with duplicates', () => {
  it('should NOT show badge for duplicate that has older original', () => {
    // The duplicate was "discovered" 2 days ago
    const duplicateFirstSeen = '2026-01-17T12:00:00Z';
    // The original was discovered 17 days ago
    const originalFirstSeen = '2026-01-02T12:00:00Z';
    // Dealer baseline is from the original
    const dealerBaseline = originalFirstSeen;

    // After deduplication, only the original remains
    // So the badge check uses the original's first_seen_at
    expect(shouldShowNewBadge(originalFirstSeen, dealerBaseline)).toBe(false);
  });
});
```

### Integration Tests

```typescript
// tests/api/browse.test.ts (additions)
describe('Browse API deduplication', () => {
  it('returns deduplicated listings for dealer with http/https duplicates', async () => {
    // This test would need to mock Supabase responses
    // with duplicate listings and verify only one is returned
  });

  it('shows correct first_seen_at after deduplication', async () => {
    // Verify the older first_seen_at is preserved
  });
});
```

## Implementation Steps

### Phase 1: Immediate Fix (Nihontowatch)

1. Create `src/lib/urlNormalization.ts` with `normalizeUrl` and `urlsMatch` functions
2. Add unit tests for URL normalization
3. Add `deduplicateListings` function to browse API route
4. Add unit tests for deduplication
5. Test locally against production data
6. Deploy to production

### Phase 2: Root Cause Fix (Oshi-scrapper)

1. Add URL normalization to scraper's URL existence check
2. Create database migration to clean up existing duplicates
3. Test scraper changes locally
4. Run cleanup migration on production database
5. Deploy scraper changes

### Phase 3: Monitoring

1. Add logging for detected duplicates (for monitoring)
2. Set up alert if duplicate count increases
3. Document the fix in postmortem

## Files to Modify

### Nihontowatch (this repo)

| File | Change |
|------|--------|
| `src/lib/urlNormalization.ts` | NEW - URL normalization utilities |
| `src/app/api/browse/route.ts` | Add deduplication logic |
| `tests/lib/urlNormalization.test.ts` | NEW - Unit tests |
| `tests/api/browse.test.ts` | Add integration tests |
| `docs/POSTMORTEM_FALSE_NEW_BADGES.md` | NEW - Document the issue |

### Oshi-scrapper (separate repo)

| File | Change |
|------|--------|
| `utils/url.py` | Add URL normalization |
| `scrapers/base.py` | Use normalized URL for lookups |
| `migrations/cleanup_duplicates.sql` | One-time cleanup |

## Success Criteria

1. Listing 11117 no longer shows "New" badge
2. All 30 false "New" badges are eliminated
3. Duplicate listings are hidden from users
4. No regression in legitimate "New" badges
5. All tests pass
6. No new duplicates created after scraper fix

## Rollback Plan

If issues arise:
1. Revert the browse API changes (remove deduplication)
2. Keep URL normalization utilities (no side effects)
3. Investigate the specific failure before re-deploying
