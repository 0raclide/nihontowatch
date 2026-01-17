/**
 * Unit tests for freshness calculation logic
 */

import { describe, it, expect } from 'vitest';
import { calculateFreshness, needsWaybackCheck } from '@/lib/freshness/calculator';

describe('calculateFreshness', () => {
  const baseDate = '2025-01-01T00:00:00Z';
  const beforeBaseline = '2024-12-15T00:00:00Z';
  const afterBaseline = '2025-01-10T00:00:00Z';

  describe('when listing has explicit publish date', () => {
    it('returns high confidence with dealer_meta source', () => {
      const listing = {
        first_seen_at: baseDate,
        listing_published_at: '2024-06-15T00:00:00Z',
      };
      const dealer = {};

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('high');
      expect(result.source).toBe('dealer_meta');
      expect(result.displayDate).toBe('2024-06-15T00:00:00Z');
    });
  });

  describe('when listing has Wayback data', () => {
    it('returns high confidence with wayback source', () => {
      const listing = {
        first_seen_at: baseDate,
        wayback_first_archive_at: '2024-03-20T00:00:00Z',
      };
      const dealer = {};

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('high');
      expect(result.source).toBe('wayback');
      expect(result.displayDate).toBe('2024-03-20T00:00:00Z');
    });
  });

  describe('when listing appeared after dealer baseline', () => {
    it('returns high confidence with inferred source', () => {
      const listing = {
        first_seen_at: afterBaseline,
      };
      const dealer = {
        catalog_baseline_at: baseDate,
      };

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('high');
      expect(result.source).toBe('inferred');
      expect(result.displayDate).toBe(afterBaseline);
    });
  });

  describe('when listing predates dealer baseline', () => {
    it('returns low confidence', () => {
      const listing = {
        first_seen_at: beforeBaseline,
      };
      const dealer = {
        catalog_baseline_at: baseDate,
      };

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('low');
      expect(result.source).toBe('unknown');
    });
  });

  describe('when no baseline established', () => {
    it('returns unknown confidence', () => {
      const listing = {
        first_seen_at: baseDate,
      };
      const dealer = {};

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('unknown');
      expect(result.source).toBe('unknown');
    });
  });

  describe('when listing already has high confidence in DB', () => {
    it('preserves existing high confidence', () => {
      const listing = {
        first_seen_at: baseDate,
        freshness_confidence: 'high' as const,
        freshness_source: 'wayback' as const,
        wayback_first_archive_at: '2024-01-01T00:00:00Z',
      };
      const dealer = {};

      const result = calculateFreshness(listing, dealer);

      expect(result.confidence).toBe('high');
      expect(result.source).toBe('wayback');
    });
  });
});

describe('needsWaybackCheck', () => {
  it('returns false when already has wayback data', () => {
    const listing = {
      first_seen_at: '2025-01-01T00:00:00Z',
      wayback_first_archive_at: '2024-01-01T00:00:00Z',
    };

    expect(needsWaybackCheck(listing)).toBe(false);
  });

  it('returns false when already has high confidence', () => {
    const listing = {
      first_seen_at: '2025-01-01T00:00:00Z',
      freshness_confidence: 'high' as const,
    };

    expect(needsWaybackCheck(listing)).toBe(false);
  });

  it('returns true when confidence is low', () => {
    const listing = {
      first_seen_at: '2025-01-01T00:00:00Z',
      freshness_confidence: 'low' as const,
    };

    expect(needsWaybackCheck(listing)).toBe(true);
  });

  it('returns true when confidence is unknown', () => {
    const listing = {
      first_seen_at: '2025-01-01T00:00:00Z',
      freshness_confidence: 'unknown' as const,
    };

    expect(needsWaybackCheck(listing)).toBe(true);
  });

  it('returns true when no confidence set', () => {
    const listing = {
      first_seen_at: '2025-01-01T00:00:00Z',
    };

    expect(needsWaybackCheck(listing)).toBe(true);
  });
});
