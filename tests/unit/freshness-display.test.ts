/**
 * Unit tests for freshness display formatting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatFreshnessDisplay, getFreshnessIcon } from '@/lib/freshness/display';

describe('formatFreshnessDisplay', () => {
  beforeEach(() => {
    // Mock Date.now to get consistent time differences
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with high confidence', () => {
    it('shows "Listed" prefix and verified icon', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z', // 3 days ago
        freshness_confidence: 'high' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('Listed 3 days ago');
      expect(result.show).toBe(true);
      expect(result.isVerified).toBe(true);
    });

    it('uses listing_published_at when available', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
        listing_published_at: '2025-01-10T12:00:00Z', // 7 days ago
        freshness_confidence: 'high' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('Listed 1 weeks ago');
      expect(result.isVerified).toBe(true);
    });

    it('uses wayback date when available', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
        wayback_first_archive_at: '2024-12-17T12:00:00Z', // 1 month ago
        freshness_confidence: 'high' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('Listed 1 months ago');
    });
  });

  describe('with medium confidence', () => {
    it('shows "First seen" prefix and unverified icon', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
        freshness_confidence: 'medium' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('First seen 3 days ago');
      expect(result.show).toBe(true);
      expect(result.isVerified).toBe(false);
    });
  });

  describe('with low or unknown confidence', () => {
    it('shows "First seen" for low confidence', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
        freshness_confidence: 'low' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('First seen 3 days ago');
      expect(result.isVerified).toBe(false);
    });

    it('shows "First seen" for unknown confidence', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
        freshness_confidence: 'unknown' as const,
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('First seen 3 days ago');
      expect(result.isVerified).toBe(false);
    });

    it('shows "First seen" when no confidence set', () => {
      const listing = {
        first_seen_at: '2025-01-14T12:00:00Z',
      };

      const result = formatFreshnessDisplay(listing);

      expect(result.text).toBe('First seen 3 days ago');
      expect(result.show).toBe(true);
      expect(result.isVerified).toBe(false);
    });
  });

  describe('time formatting', () => {
    it('formats today correctly', () => {
      const listing = {
        first_seen_at: '2025-01-17T10:00:00Z', // same day
        freshness_confidence: 'high' as const,
      };

      const result = formatFreshnessDisplay(listing);
      expect(result.text).toBe('Listed today');
    });

    it('formats yesterday correctly', () => {
      const listing = {
        first_seen_at: '2025-01-16T12:00:00Z', // 1 day ago
        freshness_confidence: 'high' as const,
      };

      const result = formatFreshnessDisplay(listing);
      expect(result.text).toBe('Listed yesterday');
    });
  });
});

describe('getFreshnessIcon', () => {
  it('returns verified when isVerified is true', () => {
    expect(getFreshnessIcon(true)).toBe('verified');
  });

  it('returns unverified when isVerified is false', () => {
    expect(getFreshnessIcon(false)).toBe('unverified');
  });
});
