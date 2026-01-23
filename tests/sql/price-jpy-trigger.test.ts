/**
 * Price JPY Trigger Tests
 *
 * Tests the database trigger that computes price_jpy on insert/update.
 * This ensures listings always have price_jpy populated, which is required
 * for the browse API's minimum price filter.
 *
 * REGRESSION CONTEXT:
 * - Bug: Listings with price_value but null price_jpy were filtered out of browse results
 * - Root cause: price_jpy was only computed by a periodic refresh job, not on insert
 * - Fix: Added trigger_compute_price_jpy_insert and trigger_compute_price_jpy_update triggers
 *
 * These tests verify:
 * 1. price_jpy is automatically computed on INSERT
 * 2. price_jpy is automatically computed on UPDATE when price changes
 * 3. Different currencies are converted correctly
 * 4. ASK listings (null price) have null price_jpy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test database connection
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://itbhfhyptogxcjbjfzwx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if no service role key (CI without secrets)
const shouldSkip = !SUPABASE_KEY;

describe.skipIf(shouldSkip)('Price JPY Database Trigger', () => {
  let supabase: SupabaseClient;
  const testUrls: string[] = [];
  const TEST_PREFIX = 'https://test-price-jpy-trigger-' + Date.now();

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUrls.length > 0) {
      await supabase
        .from('listings')
        .delete()
        .in('url', testUrls);
    }
  });

  // Helper to create a test listing
  async function createTestListing(data: {
    price_value: number | null;
    price_currency?: string;
  }) {
    const url = `${TEST_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testUrls.push(url);

    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        url,
        dealer_id: 1,
        title: 'Test Listing',
        price_value: data.price_value,
        price_currency: data.price_currency || 'JPY',
      })
      .select('id, price_value, price_currency, price_jpy')
      .single();

    if (error) throw new Error(`Failed to create test listing: ${error.message}`);
    return listing;
  }

  describe('INSERT trigger', () => {
    it('should compute price_jpy for JPY price on insert', async () => {
      const listing = await createTestListing({
        price_value: 550000,
        price_currency: 'JPY',
      });

      expect(listing.price_jpy).toBe(550000);
    });

    it('should compute price_jpy for USD price on insert', async () => {
      const listing = await createTestListing({
        price_value: 1000,
        price_currency: 'USD',
      });

      // Should be converted at ~156 rate
      expect(listing.price_jpy).toBe(156000);
    });

    it('should compute price_jpy for EUR price on insert', async () => {
      const listing = await createTestListing({
        price_value: 1000,
        price_currency: 'EUR',
      });

      // Should be converted at ~163 rate
      expect(listing.price_jpy).toBe(163000);
    });

    it('should compute price_jpy for GBP price on insert', async () => {
      const listing = await createTestListing({
        price_value: 1000,
        price_currency: 'GBP',
      });

      // Should be converted at ~195 rate
      expect(listing.price_jpy).toBe(195000);
    });

    it('should set price_jpy to null for ASK listings (null price_value)', async () => {
      const listing = await createTestListing({
        price_value: null,
      });

      expect(listing.price_jpy).toBeNull();
    });

    it('should handle null currency as JPY', async () => {
      const url = `${TEST_PREFIX}/${Date.now()}-null-currency`;
      testUrls.push(url);

      const { data: listing, error } = await supabase
        .from('listings')
        .insert({
          url,
          dealer_id: 1,
          title: 'Test Listing Null Currency',
          price_value: 100000,
          price_currency: null,
        })
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to create test listing: ${error.message}`);

      // Null currency should be treated as JPY
      expect(listing.price_jpy).toBe(100000);
    });
  });

  describe('UPDATE trigger', () => {
    it('should recompute price_jpy when price_value changes', async () => {
      const listing = await createTestListing({
        price_value: 100000,
        price_currency: 'JPY',
      });

      expect(listing.price_jpy).toBe(100000);

      // Update the price
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ price_value: 200000 })
        .eq('id', listing.id)
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to update listing: ${error.message}`);

      expect(updated.price_jpy).toBe(200000);
    });

    it('should recompute price_jpy when price_currency changes', async () => {
      const listing = await createTestListing({
        price_value: 1000,
        price_currency: 'USD',
      });

      expect(listing.price_jpy).toBe(156000);

      // Change currency to EUR
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ price_currency: 'EUR' })
        .eq('id', listing.id)
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to update listing: ${error.message}`);

      expect(updated.price_jpy).toBe(163000);
    });

    it('should set price_jpy to null when price_value is cleared', async () => {
      const listing = await createTestListing({
        price_value: 100000,
        price_currency: 'JPY',
      });

      expect(listing.price_jpy).toBe(100000);

      // Clear the price
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ price_value: null })
        .eq('id', listing.id)
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to update listing: ${error.message}`);

      expect(updated.price_jpy).toBeNull();
    });

    it('should not trigger when non-price fields change', async () => {
      const listing = await createTestListing({
        price_value: 100000,
        price_currency: 'JPY',
      });

      const originalPriceJpy = listing.price_jpy;

      // Update a non-price field
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ title: 'Updated Title' })
        .eq('id', listing.id)
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to update listing: ${error.message}`);

      // price_jpy should remain unchanged
      expect(updated.price_jpy).toBe(originalPriceJpy);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small prices', async () => {
      const listing = await createTestListing({
        price_value: 100,
        price_currency: 'JPY',
      });

      expect(listing.price_jpy).toBe(100);
    });

    it('should handle very large prices', async () => {
      const listing = await createTestListing({
        price_value: 100000000, // 100 million
        price_currency: 'JPY',
      });

      expect(listing.price_jpy).toBe(100000000);
    });

    it('should handle decimal prices', async () => {
      const listing = await createTestListing({
        price_value: 1234.56,
        price_currency: 'USD',
      });

      // 1234.56 * 156 = 192591.36
      expect(listing.price_jpy).toBeCloseTo(192591.36, 2);
    });

    it('should handle unknown currency as pass-through', async () => {
      const url = `${TEST_PREFIX}/${Date.now()}-unknown-currency`;
      testUrls.push(url);

      const { data: listing, error } = await supabase
        .from('listings')
        .insert({
          url,
          dealer_id: 1,
          title: 'Test Unknown Currency',
          price_value: 50000,
          price_currency: 'XYZ', // Unknown currency
        })
        .select('id, price_value, price_currency, price_jpy')
        .single();

      if (error) throw new Error(`Failed to create listing: ${error.message}`);

      // Unknown currencies should pass through as-is
      expect(listing.price_jpy).toBe(50000);
    });
  });
});

/**
 * Browse API Minimum Price Filter Tests
 *
 * Tests that the browse API correctly filters listings based on price_jpy.
 * This is a regression test for the bug where listings with null price_jpy
 * were incorrectly filtered out.
 */
describe.skipIf(shouldSkip)('Browse API Minimum Price Filter', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  it('should have no listings with price_value but null price_jpy', async () => {
    // This is the critical regression test
    // If this fails, new listings are not getting price_jpy computed
    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .not('price_value', 'is', null)
      .is('price_jpy', null);

    if (error) throw new Error(`Query failed: ${error.message}`);

    expect(count).toBe(0);
  });

  it('should have consistent price_jpy for JPY listings', async () => {
    // Sample check: JPY listings should have price_jpy = price_value
    const { data, error } = await supabase
      .from('listings')
      .select('id, price_value, price_currency, price_jpy')
      .eq('price_currency', 'JPY')
      .not('price_value', 'is', null)
      .limit(10);

    if (error) throw new Error(`Query failed: ${error.message}`);

    for (const listing of data || []) {
      expect(listing.price_jpy).toBe(listing.price_value);
    }
  });

  it('should have price_jpy > price_value for USD listings', async () => {
    // USD listings should have price_jpy > price_value (since 1 USD > 1 JPY)
    const { data, error } = await supabase
      .from('listings')
      .select('id, price_value, price_currency, price_jpy')
      .eq('price_currency', 'USD')
      .not('price_value', 'is', null)
      .limit(10);

    if (error) throw new Error(`Query failed: ${error.message}`);

    for (const listing of data || []) {
      if (listing.price_value && listing.price_jpy) {
        expect(listing.price_jpy).toBeGreaterThan(listing.price_value);
      }
    }
  });
});
