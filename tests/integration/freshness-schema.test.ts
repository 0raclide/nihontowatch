/**
 * Integration tests for freshness database schema
 *
 * These tests verify that:
 * 1. The migration was applied (columns exist)
 * 2. The service role can update freshness fields
 * 3. RLS doesn't block the cron job's updates
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in environment.
 * Skipped in CI if not available.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Skip if no service role key (CI without secrets)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const shouldSkip = !serviceRoleKey || !supabaseUrl || serviceRoleKey === 'placeholder-key';

describe.skipIf(shouldSkip)('Freshness database schema', () => {
  let supabase: ReturnType<typeof createClient>;
  let testListingId: number | null = null;

  beforeAll(() => {
    supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false },
    });
  });

  afterAll(async () => {
    // Clean up: reset any test data we modified
    if (testListingId) {
      await supabase
        .from('listings')
        .update({
          wayback_checked_at: null,
          wayback_first_archive_at: null,
          freshness_confidence: 'unknown',
          freshness_source: 'unknown',
        })
        .eq('id', testListingId);
    }
  });

  it('listings table has freshness columns', async () => {
    // Query a single listing to check column existence
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        freshness_confidence,
        freshness_source,
        wayback_checked_at,
        wayback_first_archive_at,
        listing_published_at
      `)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data).toHaveProperty('freshness_confidence');
    expect(data).toHaveProperty('freshness_source');
    expect(data).toHaveProperty('wayback_checked_at');
    expect(data).toHaveProperty('wayback_first_archive_at');
    expect(data).toHaveProperty('listing_published_at');
  });

  it('dealers table has catalog_baseline_at column', async () => {
    const { data, error } = await supabase
      .from('dealers')
      .select('id, catalog_baseline_at')
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data).toHaveProperty('catalog_baseline_at');
  });

  it('service role can update freshness fields on listings', async () => {
    // Get a listing to test with
    const { data: listing } = await supabase
      .from('listings')
      .select('id, wayback_checked_at')
      .limit(1)
      .single();

    expect(listing).not.toBeNull();
    testListingId = listing!.id;

    // Try to update freshness fields
    const testTimestamp = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        wayback_checked_at: testTimestamp,
        freshness_confidence: 'high',
        freshness_source: 'wayback',
      })
      .eq('id', testListingId);

    expect(updateError).toBeNull();

    // Verify the update persisted
    const { data: updated } = await supabase
      .from('listings')
      .select('wayback_checked_at, freshness_confidence, freshness_source')
      .eq('id', testListingId)
      .single();

    // Compare as dates (Supabase returns +00:00 format, we send Z format)
    expect(new Date(updated?.wayback_checked_at).getTime()).toBe(new Date(testTimestamp).getTime());
    expect(updated?.freshness_confidence).toBe('high');
    expect(updated?.freshness_source).toBe('wayback');
  });

  it('freshness_confidence constraint allows valid values', async () => {
    const { data: listing } = await supabase
      .from('listings')
      .select('id')
      .limit(1)
      .single();

    testListingId = listing!.id;

    // Test all valid values
    for (const confidence of ['high', 'medium', 'low', 'unknown']) {
      const { error } = await supabase
        .from('listings')
        .update({ freshness_confidence: confidence })
        .eq('id', testListingId);

      expect(error).toBeNull();
    }
  });

  it('freshness_source constraint allows valid values', async () => {
    const { data: listing } = await supabase
      .from('listings')
      .select('id')
      .limit(1)
      .single();

    testListingId = listing!.id;

    // Test all valid values
    for (const source of ['dealer_meta', 'wayback', 'inferred', 'unknown']) {
      const { error } = await supabase
        .from('listings')
        .update({ freshness_source: source })
        .eq('id', testListingId);

      expect(error).toBeNull();
    }
  });

  it('freshness indexes exist for query performance', async () => {
    // Query using the indexed columns to verify they work
    // (doesn't prove index exists, but verifies query pattern works)
    const { error } = await supabase
      .from('listings')
      .select('id')
      .is('wayback_checked_at', null)
      .in('freshness_confidence', ['unknown', 'low'])
      .limit(1);

    expect(error).toBeNull();
  });
});

describe.skipIf(shouldSkip)('Anon role cannot update freshness fields', () => {
  let anonSupabase: ReturnType<typeof createClient>;
  let serviceSupabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey && supabaseUrl) {
      anonSupabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
    }
    if (serviceRoleKey && supabaseUrl) {
      serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
    }
  });

  it('anon role update has no effect (blocked by RLS)', async () => {
    if (!anonSupabase || !serviceSupabase) return;

    // Get a listing with service role
    const { data: listing } = await serviceSupabase
      .from('listings')
      .select('id, freshness_confidence')
      .limit(1)
      .single();

    if (!listing) return;

    const originalConfidence = listing.freshness_confidence;
    const testValue = originalConfidence === 'high' ? 'low' : 'high';

    // Try to update with anon role
    await anonSupabase
      .from('listings')
      .update({ freshness_confidence: testValue })
      .eq('id', listing.id);

    // Verify with service role that the value did NOT change
    const { data: after } = await serviceSupabase
      .from('listings')
      .select('freshness_confidence')
      .eq('id', listing.id)
      .single();

    // The value should still be the original (update was blocked)
    // NOTE: If this fails, RLS UPDATE policy is missing!
    expect(after?.freshness_confidence).toBe(originalConfidence);
  });
});
