import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { checkRateLimit, getRouteLimit, _getStore, _clearStore, _stopCleanup } from '@/lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    _clearStore();
  });

  afterAll(() => {
    _stopCleanup();
  });

  describe('getRouteLimit', () => {
    it('returns 30 for /api/browse', () => {
      expect(getRouteLimit('/api/browse')).toBe(30);
      expect(getRouteLimit('/api/browse?page=2')).toBe(30);
    });

    it('returns 60 for /api/listing/', () => {
      expect(getRouteLimit('/api/listing/123')).toBe(60);
    });

    it('returns 30 for /api/artisan/', () => {
      expect(getRouteLimit('/api/artisan/MAS590')).toBe(30);
    });

    it('returns 30 for /api/artists/', () => {
      expect(getRouteLimit('/api/artists/directory')).toBe(30);
    });

    it('returns 20 for /api/search/', () => {
      expect(getRouteLimit('/api/search/suggestions')).toBe(20);
    });

    it('returns 10 for /api/exchange-rates', () => {
      expect(getRouteLimit('/api/exchange-rates')).toBe(10);
    });

    it('returns 30 for /api/favorites', () => {
      expect(getRouteLimit('/api/favorites')).toBe(30);
    });

    it('returns default 60 for unknown API routes', () => {
      expect(getRouteLimit('/api/translate')).toBe(60);
      expect(getRouteLimit('/api/feedback')).toBe(60);
      expect(getRouteLimit('/api/activity')).toBe(60);
    });

    it('longest prefix wins (exchange-rates before generic)', () => {
      expect(getRouteLimit('/api/exchange-rates')).toBe(10);
    });
  });

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      const result = checkRateLimit('1.2.3.4', '/api/browse');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(29);
    });

    it('blocks requests over the limit', () => {
      for (let i = 0; i < 30; i++) {
        const result = checkRateLimit('1.2.3.4', '/api/browse');
        expect(result.allowed).toBe(true);
      }
      const blocked = checkRateLimit('1.2.3.4', '/api/browse');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('returns correct remaining count', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('1.2.3.4', '/api/browse');
      }
      const result = checkRateLimit('1.2.3.4', '/api/browse');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 30 - 11
    });

    it('different route keys are independent', () => {
      for (let i = 0; i < 30; i++) {
        checkRateLimit('1.2.3.4', '/api/browse');
      }
      const blockedBrowse = checkRateLimit('1.2.3.4', '/api/browse');
      expect(blockedBrowse.allowed).toBe(false);

      const allowedListing = checkRateLimit('1.2.3.4', '/api/listing/123');
      expect(allowedListing.allowed).toBe(true);
    });

    it('different IPs are independent', () => {
      for (let i = 0; i < 30; i++) {
        checkRateLimit('1.2.3.4', '/api/browse');
      }
      const blockedIp1 = checkRateLimit('1.2.3.4', '/api/browse');
      expect(blockedIp1.allowed).toBe(false);

      const allowedIp2 = checkRateLimit('5.6.7.8', '/api/browse');
      expect(allowedIp2.allowed).toBe(true);
    });

    it('window slides correctly (old timestamps expire)', () => {
      const now = Date.now();
      const store = _getStore();
      const key = '1.2.3.4:/api/browse';

      // Insert timestamps that are 59 seconds old (inside window)
      const oldTimestamps = Array.from({ length: 30 }, () => now - 59_000);
      store.set(key, oldTimestamps);

      const blocked = checkRateLimit('1.2.3.4', '/api/browse');
      expect(blocked.allowed).toBe(false);

      // Now set them to 61 seconds ago (outside window)
      const expiredTimestamps = Array.from({ length: 30 }, () => now - 61_000);
      store.set(key, expiredTimestamps);

      const allowed = checkRateLimit('1.2.3.4', '/api/browse');
      expect(allowed.allowed).toBe(true);
    });

    it('returns resetAt as unix timestamp when oldest request expires', () => {
      const result = checkRateLimit('1.2.3.4', '/api/browse');
      expect(result.allowed).toBe(true);
      const nowSec = Math.floor(Date.now() / 1000);
      expect(result.resetAt).toBeGreaterThanOrEqual(nowSec + 59);
      expect(result.resetAt).toBeLessThanOrEqual(nowSec + 61);
    });

    it('uses the correct limit for exchange-rates (10)', () => {
      for (let i = 0; i < 10; i++) {
        const r = checkRateLimit('1.2.3.4', '/api/exchange-rates');
        expect(r.allowed).toBe(true);
      }
      const blocked = checkRateLimit('1.2.3.4', '/api/exchange-rates');
      expect(blocked.allowed).toBe(false);
      expect(blocked.limit).toBe(10);
    });

    it('uses the correct limit for search (20)', () => {
      for (let i = 0; i < 20; i++) {
        const r = checkRateLimit('1.2.3.4', '/api/search/suggestions');
        expect(r.allowed).toBe(true);
      }
      const blocked = checkRateLimit('1.2.3.4', '/api/search/suggestions');
      expect(blocked.allowed).toBe(false);
      expect(blocked.limit).toBe(20);
    });

    it('uses default limit (60) for unknown routes', () => {
      for (let i = 0; i < 60; i++) {
        const r = checkRateLimit('1.2.3.4', '/api/translate');
        expect(r.allowed).toBe(true);
      }
      const blocked = checkRateLimit('1.2.3.4', '/api/translate');
      expect(blocked.allowed).toBe(false);
      expect(blocked.limit).toBe(60);
    });

    it('cleanup removes stale entries', () => {
      const store = _getStore();
      const key = '1.2.3.4:/api/browse';
      // Insert timestamps that are well past the window
      store.set(key, [Date.now() - 120_000, Date.now() - 90_000]);

      // checkRateLimit evicts expired entries on access
      checkRateLimit('1.2.3.4', '/api/browse');
      const timestamps = store.get(key);
      // Should have only 1 entry (the new request) — old ones evicted
      expect(timestamps).toHaveLength(1);
    });
  });
});
