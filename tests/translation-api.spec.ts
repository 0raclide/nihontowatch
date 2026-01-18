/**
 * Translation API Tests
 *
 * Tests for the /api/translate endpoint
 * Run with: npx playwright test tests/translation-api.spec.ts
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Translation API', () => {
  test('returns error for missing listingId', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/translate`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid listingId');
  });

  test('returns error for invalid listingId type', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/translate`, {
      data: { listingId: 'not-a-number' },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid listingId');
  });

  test('returns 404 for non-existent listing', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/translate`, {
      data: { listingId: 999999999 },
    });

    expect(response.status()).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Listing not found');
  });

  test('returns cached translation if available', async ({ request }) => {
    // First, get a listing from the browse API to find a valid ID
    const browseResponse = await request.get(`${BASE_URL}/api/browse?limit=1`);
    const browseData = await browseResponse.json();

    if (!browseData.listings || browseData.listings.length === 0) {
      test.skip();
      return;
    }

    const listingId = browseData.listings[0].id;

    // Call translate API
    const response = await request.post(`${BASE_URL}/api/translate`, {
      data: { listingId },
    });

    expect(response.ok()).toBe(true);
    const json = await response.json();

    // Response should have translation (or null if no description)
    expect(json).toHaveProperty('cached');

    if (json.translation) {
      console.log(`Translation returned for listing ${listingId}: ${json.translation.substring(0, 50)}...`);
    } else if (json.reason === 'no_description') {
      console.log(`Listing ${listingId} has no description`);
    }
  });
});

test.describe('Translation API - Rate Limiting', () => {
  test('handles concurrent requests gracefully', async ({ request }) => {
    // Get a valid listing ID
    const browseResponse = await request.get(`${BASE_URL}/api/browse?limit=1`);
    const browseData = await browseResponse.json();

    if (!browseData.listings || browseData.listings.length === 0) {
      test.skip();
      return;
    }

    const listingId = browseData.listings[0].id;

    // Make 3 concurrent requests
    const requests = Array(3).fill(null).map(() =>
      request.post(`${BASE_URL}/api/translate`, {
        data: { listingId },
      })
    );

    const responses = await Promise.all(requests);

    // All should succeed (cached or fresh)
    for (const response of responses) {
      expect(response.ok()).toBe(true);
    }

    console.log('Concurrent requests handled successfully');
  });
});

console.log('Translation API test suite loaded');
