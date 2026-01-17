/**
 * Integration tests for Wayback Machine client
 * Uses mocked fetch to test without hitting real API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkWaybackArchive, WaybackRateLimiter } from '@/lib/wayback/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('checkWaybackArchive', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns found=true with archive date when URL is archived', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('[["timestamp"],["20240315120000"]]'),
    });

    const result = await checkWaybackArchive('https://example.com/listing/123');

    expect(result.found).toBe(true);
    expect(result.firstArchiveAt).toBeInstanceOf(Date);
    expect(result.firstArchiveAt?.toISOString()).toBe('2024-03-15T12:00:00.000Z');
    expect(result.error).toBeUndefined();
  });

  it('returns found=false when URL is not archived', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const result = await checkWaybackArchive('https://example.com/not-archived');

    expect(result.found).toBe(false);
    expect(result.firstArchiveAt).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('handles HTTP errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const result = await checkWaybackArchive('https://example.com/error');

    expect(result.found).toBe(false);
    expect(result.error).toBe('HTTP 503: Service Unavailable');
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkWaybackArchive('https://example.com/network-error');

    expect(result.found).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('handles malformed JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('not valid json'),
    });

    const result = await checkWaybackArchive('https://example.com/malformed');

    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles empty array response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('[]'),
    });

    const result = await checkWaybackArchive('https://example.com/empty');

    expect(result.found).toBe(false);
    expect(result.firstArchiveAt).toBeNull();
  });

  it('includes correct User-Agent header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    });

    await checkWaybackArchive('https://example.com/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Nihontowatch'),
        }),
      })
    );
  });
});

describe('WaybackRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first request immediately', async () => {
    const limiter = new WaybackRateLimiter(1); // 1 per minute

    const waitPromise = limiter.waitForSlot();
    await vi.runAllTimersAsync();

    await expect(waitPromise).resolves.toBeUndefined();
  });

  it('delays second request by rate limit interval', async () => {
    const limiter = new WaybackRateLimiter(1); // 60 second interval

    // First request
    await limiter.waitForSlot();

    // Second request should wait
    let secondResolved = false;
    const secondPromise = limiter.waitForSlot().then(() => {
      secondResolved = true;
    });

    // Advance 30 seconds - should not resolve yet
    await vi.advanceTimersByTimeAsync(30000);
    expect(secondResolved).toBe(false);

    // Advance another 30 seconds - should resolve
    await vi.advanceTimersByTimeAsync(30000);
    await secondPromise;
    expect(secondResolved).toBe(true);
  });
});
