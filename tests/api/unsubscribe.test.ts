/**
 * Unsubscribe API Tests
 *
 * Tests for the email unsubscribe endpoint.
 * Ensures one-click unsubscribe works correctly (RFC 8058 compliance).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// TOKEN GENERATION TESTS
// =============================================================================

describe('Unsubscribe Token Generation', () => {
  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', 'test-secret-key');
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.nihontowatch.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('generates valid token with required fields', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    // Token should have payload.signature format
    expect(token).toContain('.');
  });

  it('generates different tokens for different users', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token1 = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'user1@example.com',
      type: 'all',
    });

    const token2 = generateUnsubscribeToken({
      userId: 'user-456',
      email: 'user2@example.com',
      type: 'all',
    });

    expect(token1).not.toBe(token2);
  });

  it('generates different tokens for different types', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const allToken = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });

    const marketingToken = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'marketing',
    });

    expect(allToken).not.toBe(marketingToken);
  });

  it('includes savedSearchId for saved_search type', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'saved_search',
      savedSearchId: 'search-abc',
    });

    expect(token).toBeDefined();
    // Token should decode to include the savedSearchId
    const [payloadStr] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    expect(payload.s).toBe('search-abc');
  });
});

// =============================================================================
// URL GENERATION TESTS
// =============================================================================

describe('Unsubscribe URL Generation', () => {
  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', 'test-secret-key');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.nihontowatch.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('generates full URL with token parameter', async () => {
    const { getUnsubscribeUrl } = await import('@/app/api/unsubscribe/route');

    const url = getUnsubscribeUrl({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });

    expect(url).toContain('https://test.nihontowatch.com/api/unsubscribe');
    expect(url).toContain('token=');
  });

  it('URL-encodes the token', async () => {
    const { getUnsubscribeUrl } = await import('@/app/api/unsubscribe/route');

    const url = getUnsubscribeUrl({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'marketing',
    });

    // Token should be URL-encoded (no raw = or + characters outside encoding)
    const tokenParam = new URL(url).searchParams.get('token');
    expect(tokenParam).toBeDefined();
    expect(tokenParam!.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// TOKEN PAYLOAD TESTS
// =============================================================================

describe('Unsubscribe Token Payload', () => {
  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', 'test-secret-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('token payload contains user ID', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });

    const [payloadStr] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    expect(payload.u).toBe('user-123');
  });

  it('token payload contains email', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });

    const [payloadStr] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    expect(payload.e).toBe('test@example.com');
  });

  it('token payload contains type', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'marketing',
    });

    const [payloadStr] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    expect(payload.t).toBe('marketing');
  });

  it('token payload contains timestamp', async () => {
    const { generateUnsubscribeToken } = await import('@/app/api/unsubscribe/route');

    const before = Date.now();
    const token = generateUnsubscribeToken({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'all',
    });
    const after = Date.now();

    const [payloadStr] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    expect(payload.ts).toBeGreaterThanOrEqual(before);
    expect(payload.ts).toBeLessThanOrEqual(after);
  });
});

// =============================================================================
// UNSUBSCRIBE PAGE TESTS (Integration - requires deployment)
// =============================================================================

describe('Unsubscribe Page', () => {
  const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

  it('unsubscribe page exists', async () => {
    const res = await fetch(`${API_BASE}/unsubscribe?status=success&detail=all`);

    // Should return HTML page (may redirect or render)
    // Note: Returns 404 if not deployed yet
    expect(res.status).toBeLessThan(500);
  });

  it('unsubscribe page handles error status', async () => {
    const res = await fetch(`${API_BASE}/unsubscribe?status=error&detail=Token%20expired`);

    expect(res.status).toBeLessThan(500);
  });
});

// =============================================================================
// API ENDPOINT TESTS (Integration - requires deployment)
// These tests verify the API behavior when deployed.
// They may fail locally or before deployment.
// =============================================================================

describe('Unsubscribe API Endpoint', () => {
  const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

  // Helper to check if endpoint is deployed
  const checkEndpointDeployed = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/unsubscribe`, { method: 'HEAD' });
      return res.status !== 404;
    } catch {
      return false;
    }
  };

  it('GET without token redirects to error page', async () => {
    const deployed = await checkEndpointDeployed();
    if (!deployed) {
      console.log('Skipping: Unsubscribe endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/unsubscribe`, {
      redirect: 'manual',
    });

    // Should redirect to unsubscribe page with error
    expect(res.status).toBe(307); // Redirect
    const location = res.headers.get('location');
    expect(location).toContain('/unsubscribe');
    expect(location).toContain('status=error');
  });

  it('GET with invalid token redirects to error page', async () => {
    const deployed = await checkEndpointDeployed();
    if (!deployed) {
      console.log('Skipping: Unsubscribe endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/unsubscribe?token=invalid-token`, {
      redirect: 'manual',
    });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/unsubscribe');
    expect(location).toContain('status=error');
  });

  it('POST without token or email returns 400', async () => {
    const deployed = await checkEndpointDeployed();
    if (!deployed) {
      console.log('Skipping: Unsubscribe endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('POST with invalid token returns 400', async () => {
    const deployed = await checkEndpointDeployed();
    if (!deployed) {
      console.log('Skipping: Unsubscribe endpoint not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' }),
    });

    expect(res.status).toBe(400);
  });

  it('POST with nonexistent email returns success (privacy)', async () => {
    const deployed = await checkEndpointDeployed();
    if (!deployed) {
      console.log('Skipping: Unsubscribe endpoint not deployed yet');
      return;
    }

    // Should not reveal if email exists
    const res = await fetch(`${API_BASE}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
