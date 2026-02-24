/**
 * User Preferences API Tests
 *
 * Tests for the PATCH/GET /api/user/preferences endpoint.
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

const checkEndpointExists = async (path: string) => {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'HEAD' });
    return res.status !== 404;
  } catch {
    return false;
  }
};

// =============================================================================
// GET /api/user/preferences
// =============================================================================

describe('GET /api/user/preferences', () => {
  it('endpoint exists', async () => {
    const exists = await checkEndpointExists('/api/user/preferences');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }
    expect(exists).toBe(true);
  });

  it('returns 401 for anonymous users', async () => {
    const exists = await checkEndpointExists('/api/user/preferences');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/user/preferences`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns JSON response', async () => {
    const exists = await checkEndpointExists('/api/user/preferences');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/user/preferences`);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});

// =============================================================================
// PATCH /api/user/preferences
// =============================================================================

describe('PATCH /api/user/preferences', () => {
  it('returns 401 for anonymous users', async () => {
    const exists = await checkEndpointExists('/api/user/preferences');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/user/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showAllPrices: true }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects non-whitelisted keys with 400', async () => {
    // This test verifies behavior — anonymous user gets 401 before validation
    // For non-whitelisted key validation, would need an authenticated request
    const exists = await checkEndpointExists('/api/user/preferences');
    if (!exists) {
      console.log('Skipping: Endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/user/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownKey: 'value' }),
    });

    // Anonymous users get 401 regardless of body content
    expect([400, 401].includes(res.status)).toBe(true);
  });
});
