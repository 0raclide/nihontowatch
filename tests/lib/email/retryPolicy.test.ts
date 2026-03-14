import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNextRetryAfter, shouldAbandon, MAX_RETRY_COUNT } from '@/lib/email/retryPolicy';

describe('retryPolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getNextRetryAfter', () => {
    it('should return 15m delay for retry 0', () => {
      const result = getNextRetryAfter(0);
      expect(result).not.toBeNull();
      const delayMs = result!.getTime() - Date.now();
      expect(delayMs).toBe(15 * 60 * 1000);
    });

    it('should return 30m delay for retry 1', () => {
      const result = getNextRetryAfter(1);
      expect(result).not.toBeNull();
      const delayMs = result!.getTime() - Date.now();
      expect(delayMs).toBe(30 * 60 * 1000);
    });

    it('should return 1h delay for retry 2', () => {
      const result = getNextRetryAfter(2);
      expect(result).not.toBeNull();
      const delayMs = result!.getTime() - Date.now();
      expect(delayMs).toBe(60 * 60 * 1000);
    });

    it('should return 2h delay for retry 3', () => {
      const result = getNextRetryAfter(3);
      expect(result).not.toBeNull();
      const delayMs = result!.getTime() - Date.now();
      expect(delayMs).toBe(120 * 60 * 1000);
    });

    it('should return 4h delay for retry 4', () => {
      const result = getNextRetryAfter(4);
      expect(result).not.toBeNull();
      const delayMs = result!.getTime() - Date.now();
      expect(delayMs).toBe(240 * 60 * 1000);
    });

    it('should return null at MAX_RETRY_COUNT (5)', () => {
      expect(getNextRetryAfter(5)).toBeNull();
    });

    it('should return null beyond MAX_RETRY_COUNT', () => {
      expect(getNextRetryAfter(10)).toBeNull();
    });
  });

  describe('shouldAbandon', () => {
    it('should return false for retry count 0', () => {
      expect(shouldAbandon(0)).toBe(false);
    });

    it('should return false for retry count 4', () => {
      expect(shouldAbandon(4)).toBe(false);
    });

    it('should return true at MAX_RETRY_COUNT (5)', () => {
      expect(shouldAbandon(5)).toBe(true);
    });

    it('should return true beyond MAX_RETRY_COUNT', () => {
      expect(shouldAbandon(100)).toBe(true);
    });
  });

  describe('MAX_RETRY_COUNT', () => {
    it('should be 5', () => {
      expect(MAX_RETRY_COUNT).toBe(5);
    });
  });
});
