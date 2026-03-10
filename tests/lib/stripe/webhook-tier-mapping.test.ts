/**
 * Webhook Tier Mapping Tests
 *
 * Ensures legacy Stripe subscription metadata with removed tier names
 * (enthusiast, collector, yuhinkai) are safely mapped to valid tiers,
 * preventing CHECK constraint violations on profiles.subscription_tier.
 */

import { describe, it, expect } from 'vitest';
import { mapLegacyTier } from '@/lib/stripe/server';

describe('mapLegacyTier', () => {
  it('maps "enthusiast" to "free"', () => {
    expect(mapLegacyTier('enthusiast')).toBe('free');
  });

  it('maps "collector" to "free"', () => {
    expect(mapLegacyTier('collector')).toBe('free');
  });

  it('maps "yuhinkai" to "free"', () => {
    expect(mapLegacyTier('yuhinkai')).toBe('free');
  });

  it('passes through "inner_circle" unchanged', () => {
    expect(mapLegacyTier('inner_circle')).toBe('inner_circle');
  });

  it('passes through "dealer" unchanged', () => {
    expect(mapLegacyTier('dealer')).toBe('dealer');
  });

  it('passes through "free" unchanged', () => {
    expect(mapLegacyTier('free')).toBe('free');
  });
});
