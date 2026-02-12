/**
 * Initial Import Detection Tests
 *
 * Tests the database trigger that sets is_initial_import on listings.
 * This is used by the "Newest" sort to prioritize genuine new inventory
 * over bulk imports from newly onboarded dealers.
 *
 * A listing is considered part of the initial import if:
 * - It was discovered within 24 hours of the dealer's first listing (baseline)
 * - The dealer has no baseline yet (this is their first listing)
 *
 * These tests verify:
 * 1. is_initial_import is TRUE for first listings from a dealer
 * 2. is_initial_import is TRUE for listings within 24h of baseline
 * 3. is_initial_import is FALSE for listings after 24h of baseline
 * 4. dealer.earliest_listing_at is updated correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test database connection
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://itbhfhyptogxcjbjfzwx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if no service role key (CI without secrets)
const shouldSkip = !SUPABASE_KEY;

describe.skipIf(shouldSkip)('Initial Import Detection Trigger', () => {
  let supabase: SupabaseClient;
  const testUrls: string[] = [];
  const testDealerIds: number[] = [];
  const TEST_PREFIX = 'https://test-initial-import-' + Date.now();

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  afterAll(async () => {
    // Clean up test listings
    if (testUrls.length > 0) {
      await supabase
        .from('listings')
        .delete()
        .in('url', testUrls);
    }
    // Note: We don't clean up dealers as they may be shared
  });

  // Helper to create a test listing
  async function createTestListing(data: {
    dealer_id: number;
    first_seen_at?: string;
    is_initial_import?: boolean;
  }) {
    const url = `${TEST_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testUrls.push(url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertData: Record<string, any> = {
      url,
      dealer_id: data.dealer_id,
      title: 'Test Listing',
      price_value: 100000,
      price_currency: 'JPY',
      first_seen_at: data.first_seen_at || new Date().toISOString(),
    };

    // Only include is_initial_import when explicitly provided
    // (tests the trigger's "respect explicit TRUE" behavior)
    if (data.is_initial_import !== undefined) {
      insertData.is_initial_import = data.is_initial_import;
    }

    const { data: listing, error } = await supabase
      .from('listings')
      .insert(insertData)
      .select('id, dealer_id, first_seen_at, is_initial_import')
      .single();

    if (error) throw new Error(`Failed to create test listing: ${error.message}`);
    return listing;
  }

  // Helper to get dealer's earliest_listing_at
  async function getDealerBaseline(dealerId: number) {
    const { data, error } = await supabase
      .from('dealers')
      .select('earliest_listing_at')
      .eq('id', dealerId)
      .single();

    if (error) throw new Error(`Failed to get dealer: ${error.message}`);
    return data.earliest_listing_at;
  }

  describe('is_initial_import column behavior', () => {
    it('should mark first listing from established dealer as initial import', async () => {
      // Using dealer ID 1 (Aoi Art) which should have existing listings
      // Any new listing within 24h of their baseline should be initial import
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        // Skip if no baseline - dealer needs existing listings
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      // Create a listing within 24h of baseline
      const withinBaseline = new Date(new Date(baseline).getTime() + 12 * 60 * 60 * 1000);
      const listing = await createTestListing({
        dealer_id: 1,
        first_seen_at: withinBaseline.toISOString(),
      });

      expect(listing.is_initial_import).toBe(true);
    });

    it('should mark listing after 24h window as NOT initial import', async () => {
      // Using dealer ID 1 which should have established baseline
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      // Create a listing 25 hours after baseline (outside 24h window)
      const afterWindow = new Date(new Date(baseline).getTime() + 25 * 60 * 60 * 1000);
      const listing = await createTestListing({
        dealer_id: 1,
        first_seen_at: afterWindow.toISOString(),
      });

      expect(listing.is_initial_import).toBe(false);
    });

    it('should handle listings with current timestamp correctly', async () => {
      // For established dealers, a listing created NOW should NOT be initial import
      // (since now is way past the 24h window of their baseline)
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      const baselineDate = new Date(baseline);
      const now = new Date();
      const hoursSinceBaseline = (now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60);

      // Only run if baseline is old enough (more than 24h ago)
      if (hoursSinceBaseline < 24) {
        console.log('Skipping: Dealer 1 baseline is too recent');
        return;
      }

      const listing = await createTestListing({
        dealer_id: 1,
        // first_seen_at defaults to now
      });

      expect(listing.is_initial_import).toBe(false);
    });
  });

  describe('explicit is_initial_import override (migration 058)', () => {
    it('should respect explicit is_initial_import=TRUE even when trigger would compute FALSE', async () => {
      // For an established dealer, a listing with current timestamp would normally
      // get is_initial_import=FALSE (well past the 24h baseline window).
      // But if the caller explicitly passes TRUE, the trigger should respect it.
      // This is the "scraper override" path for known bulk discoveries.
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      const baselineDate = new Date(baseline);
      const now = new Date();
      const hoursSinceBaseline = (now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceBaseline < 24) {
        console.log('Skipping: Dealer 1 baseline is too recent');
        return;
      }

      // Without explicit override: should be FALSE (existing behavior)
      const normalListing = await createTestListing({
        dealer_id: 1,
      });
      expect(normalListing.is_initial_import).toBe(false);

      // With explicit override: should stay TRUE (new behavior)
      const overriddenListing = await createTestListing({
        dealer_id: 1,
        is_initial_import: true,
      });
      expect(overriddenListing.is_initial_import).toBe(true);
    });

    it('should NOT override when is_initial_import=FALSE is passed explicitly', async () => {
      // Passing FALSE explicitly should let the trigger compute normally.
      // For an established dealer with a current timestamp, this means FALSE.
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      const baselineDate = new Date(baseline);
      const now = new Date();
      const hoursSinceBaseline = (now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceBaseline < 24) {
        console.log('Skipping: Dealer 1 baseline is too recent');
        return;
      }

      const listing = await createTestListing({
        dealer_id: 1,
        is_initial_import: false,
      });

      // Trigger computes FALSE for current timestamp on established dealer,
      // so explicit FALSE has no visible effect — still FALSE
      expect(listing.is_initial_import).toBe(false);
    });

    it('should still auto-detect initial import when no explicit value given', async () => {
      // Verify the original trigger logic still works: a listing within 24h of
      // baseline (without explicit override) should be auto-flagged as initial import
      const baseline = await getDealerBaseline(1);

      if (!baseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      const withinBaseline = new Date(new Date(baseline).getTime() + 6 * 60 * 60 * 1000);
      const listing = await createTestListing({
        dealer_id: 1,
        first_seen_at: withinBaseline.toISOString(),
        // No explicit is_initial_import — trigger should auto-compute TRUE
      });

      expect(listing.is_initial_import).toBe(true);
    });
  });

  describe('dealer.earliest_listing_at behavior', () => {
    it('should have earliest_listing_at populated for established dealers', async () => {
      const baseline = await getDealerBaseline(1);
      expect(baseline).not.toBeNull();
    });

    it('should not update baseline when newer listing is added', async () => {
      const originalBaseline = await getDealerBaseline(1);

      if (!originalBaseline) {
        console.log('Skipping: Dealer 1 has no baseline');
        return;
      }

      // Add a listing with a much later first_seen_at
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days from now
      await createTestListing({
        dealer_id: 1,
        first_seen_at: futureDate.toISOString(),
      });

      const newBaseline = await getDealerBaseline(1);

      // Baseline should remain unchanged (we don't backdate it)
      expect(newBaseline).toBe(originalBaseline);
    });
  });

  describe('Sorting behavior', () => {
    it('should return is_initial_import in browse query', async () => {
      // Verify that is_initial_import is available in query results
      const { data, error } = await supabase
        .from('listings')
        .select('id, is_initial_import, first_seen_at')
        .limit(5);

      if (error) throw new Error(`Query failed: ${error.message}`);

      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // Each listing should have is_initial_import defined (either true or false)
      for (const listing of data!) {
        expect(typeof listing.is_initial_import).toBe('boolean');
      }
    });

    it('should sort correctly with is_initial_import, first_seen_at', async () => {
      // Test the actual sort order used by the browse API
      const { data, error } = await supabase
        .from('listings')
        .select('id, is_initial_import, first_seen_at')
        .eq('is_available', true)
        .order('is_initial_import', { ascending: true })
        .order('first_seen_at', { ascending: false })
        .limit(20);

      if (error) throw new Error(`Query failed: ${error.message}`);

      expect(data).toBeDefined();

      // Verify sort order: is_initial_import=false should come before is_initial_import=true
      let foundTrue = false;
      for (const listing of data!) {
        if (listing.is_initial_import === false) {
          // Once we've seen is_initial_import=true, we shouldn't see false again
          expect(foundTrue).toBe(false);
        } else if (listing.is_initial_import === true) {
          foundTrue = true;
        }
      }
    });
  });
});

/**
 * Data Integrity Tests
 *
 * Tests that existing data has is_initial_import populated correctly.
 */
describe.skipIf(shouldSkip)('Initial Import Data Integrity', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  it('should have is_initial_import populated for all listings', async () => {
    // After migration, no listing should have NULL is_initial_import
    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .is('is_initial_import', null);

    if (error) throw new Error(`Query failed: ${error.message}`);

    expect(count).toBe(0);
  });

  it('should have earliest_listing_at for all dealers with listings', async () => {
    // All dealers that have listings should have earliest_listing_at set
    const { data, error } = await supabase
      .from('dealers')
      .select(`
        id,
        name,
        earliest_listing_at,
        listings:listings(count)
      `)
      .is('earliest_listing_at', null);

    if (error) throw new Error(`Query failed: ${error.message}`);

    // Filter to dealers that have listings but no baseline
    const dealersWithListingsButNoBaseline = (data || []).filter(
      (d: { listings: { count: number }[] }) => d.listings?.[0]?.count > 0
    );

    expect(dealersWithListingsButNoBaseline.length).toBe(0);
  });

  it('should have consistent is_initial_import values based on baseline', async () => {
    // Sample check: listings within 24h of baseline should be initial import
    const { data: dealers, error: dealerError } = await supabase
      .from('dealers')
      .select('id, earliest_listing_at')
      .not('earliest_listing_at', 'is', null)
      .limit(3);

    if (dealerError) throw new Error(`Query failed: ${dealerError.message}`);

    for (const dealer of dealers || []) {
      const baseline = new Date(dealer.earliest_listing_at);
      const cutoff = new Date(baseline.getTime() + 24 * 60 * 60 * 1000);

      // Get listings within 24h of baseline
      const { data: listings, error: listingError } = await supabase
        .from('listings')
        .select('id, first_seen_at, is_initial_import')
        .eq('dealer_id', dealer.id)
        .lte('first_seen_at', cutoff.toISOString())
        .limit(5);

      if (listingError) throw new Error(`Query failed: ${listingError.message}`);

      // All these listings should be marked as initial import
      for (const listing of listings || []) {
        expect(listing.is_initial_import).toBe(true);
      }
    }
  });
});
