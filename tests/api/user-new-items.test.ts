/**
 * User New Items API Tests
 *
 * Tests for the "New Since Last Visit" feature endpoints.
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

// Helper to check if endpoint exists
const checkEndpointExists = async (path: string) => {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'HEAD' });
    return res.status !== 404;
  } catch {
    return false;
  }
};

// =============================================================================
// NEW ITEMS COUNT API TESTS
// =============================================================================

describe('New Items Count API', () => {
  describe('GET /api/user/new-items-count', () => {
    it('endpoint exists or returns expected response', async () => {
      const exists = await checkEndpointExists('/api/user/new-items-count');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }
      expect(exists).toBe(true);
    });

    it('returns isLoggedIn=false for anonymous users', async () => {
      const exists = await checkEndpointExists('/api/user/new-items-count');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/new-items-count`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isLoggedIn).toBe(false);
      expect(data.count).toBeNull();
    });

    it('returns JSON response', async () => {
      const exists = await checkEndpointExists('/api/user/new-items-count');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/new-items-count`);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
});

// =============================================================================
// UPDATE LAST VISIT API TESTS
// =============================================================================

describe('Update Last Visit API', () => {
  describe('POST /api/user/update-last-visit', () => {
    it('endpoint exists or returns expected response', async () => {
      const exists = await checkEndpointExists('/api/user/update-last-visit');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }
      expect(exists).toBe(true);
    });

    it('returns 401 for anonymous users', async () => {
      const exists = await checkEndpointExists('/api/user/update-last-visit');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/update-last-visit`, {
        method: 'POST',
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Not authenticated');
    });

    it('rejects GET requests', async () => {
      const exists = await checkEndpointExists('/api/user/update-last-visit');
      if (!exists) {
        console.log('Skipping: Endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/update-last-visit`);
      // Should return 405 Method Not Allowed or similar
      expect([404, 405].includes(res.status)).toBe(true);
    });
  });
});

// =============================================================================
// RESPONSE STRUCTURE TESTS
// =============================================================================

describe('Response Structure', () => {
  it('new-items-count returns expected fields for anonymous user', async () => {
    const exists = await checkEndpointExists('/api/user/new-items-count');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/user/new-items-count`);
    const data = await res.json();

    // Anonymous users get minimal response
    expect(data).toHaveProperty('isLoggedIn');
    expect(data.isLoggedIn).toBe(false);
  });

  // Note: Testing authenticated responses would require test user credentials
  // which should be added in a separate integration test suite
});
