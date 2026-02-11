import { describe, it, expect } from 'vitest';

/**
 * Golden tests for the admin_hidden feature.
 *
 * These tests verify the core contract:
 * 1. Hidden listings are excluded from public browse results
 * 2. Hidden listings don't count in artist "for sale" counts
 * 3. The admin_hidden field correctly controls visibility
 *
 * The actual DB filtering is done via `.eq('admin_hidden', false)` in Supabase queries.
 * These tests verify the client-side logic that depends on the admin_hidden field.
 */

// Simulate the filtering that happens at the query level
function filterVisibleListings<T extends { admin_hidden?: boolean }>(
  listings: T[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return listings; // Admin sees everything
  return listings.filter(l => !l.admin_hidden);
}

// Simulate counting available listings for artist directory
function countAvailableForArtist(
  listings: Array<{ artisan_id: string; is_available: boolean; admin_hidden?: boolean }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of listings) {
    if (!l.is_available || l.admin_hidden) continue;
    counts.set(l.artisan_id, (counts.get(l.artisan_id) || 0) + 1);
  }
  return counts;
}

describe('admin_hidden feature', () => {
  /**
   * GOLDEN TEST 1: Hidden listings excluded from public browse results
   *
   * When a non-admin user browses listings, any listing with admin_hidden=true
   * must NOT appear in results. Admin users should still see all listings.
   */
  it('GOLDEN: hidden listings excluded from public browse, visible to admin', () => {
    const listings = [
      { id: 1, title: 'Fine Katana', admin_hidden: false },
      { id: 2, title: 'Book about Masamune', admin_hidden: true }, // hidden by admin
      { id: 3, title: 'Juyo Wakizashi', admin_hidden: false },
      { id: 4, title: 'Mismatched Tsuba', admin_hidden: true }, // hidden by admin
    ];

    // Non-admin: should only see non-hidden listings
    const publicResults = filterVisibleListings(listings, false);
    expect(publicResults).toHaveLength(2);
    expect(publicResults.map(l => l.id)).toEqual([1, 3]);
    expect(publicResults.every(l => !l.admin_hidden)).toBe(true);

    // Admin: should see all listings including hidden ones
    const adminResults = filterVisibleListings(listings, true);
    expect(adminResults).toHaveLength(4);
    expect(adminResults.map(l => l.id)).toEqual([1, 2, 3, 4]);
  });

  /**
   * GOLDEN TEST 2: Hidden listings excluded from artist "for sale" counts
   *
   * The artist directory shows "N for sale" counts per artisan. Hidden listings
   * must NOT be counted, even if they are available and matched to an artisan.
   */
  it('GOLDEN: hidden listings excluded from artist for-sale counts', () => {
    const listings = [
      { artisan_id: 'MAS590', is_available: true, admin_hidden: false },
      { artisan_id: 'MAS590', is_available: true, admin_hidden: true }, // hidden — should not count
      { artisan_id: 'MAS590', is_available: true, admin_hidden: false },
      { artisan_id: 'OWA009', is_available: true, admin_hidden: false },
      { artisan_id: 'OWA009', is_available: false, admin_hidden: false }, // sold — should not count
    ];

    const counts = countAvailableForArtist(listings);

    // MAS590: 3 total, 1 hidden → 2 visible for sale
    expect(counts.get('MAS590')).toBe(2);

    // OWA009: 2 total, 1 sold → 1 visible for sale
    expect(counts.get('OWA009')).toBe(1);
  });

  /**
   * GOLDEN TEST 3: admin_hidden toggle semantics
   *
   * The hide API accepts { hidden: boolean } and the field controls visibility.
   * - hidden: true  → listing is hidden from all public views
   * - hidden: false → listing is visible (default state)
   * - Toggling back to false restores the listing everywhere
   */
  it('GOLDEN: admin can toggle hidden status and listing reappears', () => {
    const listing = { id: 42, title: 'Problematic listing', admin_hidden: false };

    // Initially visible to public
    expect(filterVisibleListings([listing], false)).toHaveLength(1);

    // Admin hides it
    listing.admin_hidden = true;
    expect(filterVisibleListings([listing], false)).toHaveLength(0);
    expect(filterVisibleListings([listing], true)).toHaveLength(1); // Still visible to admin

    // Admin unhides it
    listing.admin_hidden = false;
    expect(filterVisibleListings([listing], false)).toHaveLength(1); // Back in public results
  });
});
