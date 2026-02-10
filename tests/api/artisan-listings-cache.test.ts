/**
 * Artisan Listings API Cache-Control Tests
 *
 * Background: In Feb 2026, admin artisan corrections via fix-artisan appeared
 * to revert on page reload. The DB write succeeded, but the
 * /api/artisan/[code]/listings endpoint had aggressive CDN caching
 * (s-maxage=300, stale-while-revalidate=600), causing the artist profile
 * page to serve stale pre-edit data for up to 15 minutes.
 *
 * These tests ensure mutable listing endpoints never use public CDN caching.
 *
 * Run with: npm test -- artisan-listings-cache
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

/**
 * Helper to fetch a URL and return the Cache-Control header.
 */
async function getCacheControl(path: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    // Bypass any browser-level caching
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.headers.get('cache-control');
}

describe('Artisan listings API cache headers', () => {
  // Use a well-known artisan code that should always have listings
  const TEST_CODE = 'MAS590'; // Masamune — always has data

  it('GET /api/artisan/[code]/listings must NOT use public CDN cache', async () => {
    const cacheControl = await getCacheControl(
      `/api/artisan/${TEST_CODE}/listings`
    );

    expect(cacheControl).toBeTruthy();
    // Must not have s-maxage (CDN caching) — admin edits must be immediately visible
    expect(cacheControl).not.toMatch(/s-maxage/i);
    // Must not be public
    expect(cacheControl).not.toMatch(/\bpublic\b/i);
    // Should be private/no-store
    expect(cacheControl).toMatch(/no-store|private/i);
  });

  it('GET /api/artisan/[code]/listings?status=sold must NOT use public CDN cache', async () => {
    const cacheControl = await getCacheControl(
      `/api/artisan/${TEST_CODE}/listings?status=sold`
    );

    expect(cacheControl).toBeTruthy();
    expect(cacheControl).not.toMatch(/s-maxage/i);
    expect(cacheControl).not.toMatch(/\bpublic\b/i);
    expect(cacheControl).toMatch(/no-store|private/i);
  });

  it('browse API must NOT use public CDN cache (mutable data)', async () => {
    const cacheControl = await getCacheControl(
      `/api/browse?tab=available&limit=1`
    );

    expect(cacheControl).toBeTruthy();
    expect(cacheControl).not.toMatch(/s-maxage/i);
    expect(cacheControl).not.toMatch(/\bpublic\b/i);
  });
});

describe('Static reference endpoints CAN use CDN cache', () => {
  // These are Yuhinkai reference data that don't change with admin edits,
  // so CDN caching is fine and expected.
  // Note: Vercel strips s-maxage from downstream responses, returning just "public".
  it('GET /api/artisan/[code] (reference data) uses public cache', async () => {
    const cacheControl = await getCacheControl(`/api/artisan/MAS590`);

    expect(cacheControl).toBeTruthy();
    // Reference data should be publicly cacheable
    expect(cacheControl).toMatch(/\bpublic\b/i);
    // And NOT have no-store (which would defeat caching)
    expect(cacheControl).not.toMatch(/no-store/i);
  });
});
