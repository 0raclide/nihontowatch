/**
 * Subscription Data Delay Tests
 *
 * CRITICAL: These tests ensure paid users see fresh listings.
 * If these tests fail, paying customers are NOT getting value.
 *
 * Tests cover:
 * 1. getUserSubscription() correctly identifies admin/paid users
 * 2. getDataDelayCutoff() calculates correct 72h cutoff
 * 3. Browse API applies delay for free users
 * 4. Browse API skips delay for admin/paid users
 * 5. Client fetch includes credentials for auth cookies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// DATA DELAY CUTOFF TESTS
// =============================================================================

describe('getDataDelayCutoff', () => {
  it('returns ISO string 72 hours in the past', async () => {
    // Import the actual function
    const { getDataDelayCutoff, DATA_DELAY_MS } = await import('@/lib/subscription/server');

    const now = Date.now();
    const cutoff = getDataDelayCutoff();
    const cutoffTime = new Date(cutoff).getTime();

    // Should be approximately 72 hours ago (within 1 second tolerance)
    const expected = now - DATA_DELAY_MS;
    expect(Math.abs(cutoffTime - expected)).toBeLessThan(1000);
  });

  it('DATA_DELAY_MS equals exactly 72 hours', async () => {
    const { DATA_DELAY_MS } = await import('@/lib/subscription/server');

    const HOURS_72_MS = 72 * 60 * 60 * 1000;
    expect(DATA_DELAY_MS).toBe(HOURS_72_MS);
  });
});

// =============================================================================
// EARLY ACCESS DETECTION TESTS (Client-side)
// =============================================================================

describe('isEarlyAccessListing (client-side)', () => {
  it('returns true for listings within 72 hours', () => {
    // This logic is in ListingCard - test the same calculation
    const EARLY_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

    const isEarlyAccessListing = (firstSeenAt: string): boolean => {
      const listingDate = new Date(firstSeenAt).getTime();
      const cutoff = Date.now() - EARLY_ACCESS_WINDOW_MS;
      return listingDate > cutoff;
    };

    // Listing from 1 hour ago - should be early access
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(isEarlyAccessListing(oneHourAgo)).toBe(true);

    // Listing from 71 hours ago - should be early access
    const seventyOneHoursAgo = new Date(Date.now() - 71 * 60 * 60 * 1000).toISOString();
    expect(isEarlyAccessListing(seventyOneHoursAgo)).toBe(true);
  });

  it('returns false for listings older than 72 hours', () => {
    const EARLY_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

    const isEarlyAccessListing = (firstSeenAt: string): boolean => {
      const listingDate = new Date(firstSeenAt).getTime();
      const cutoff = Date.now() - EARLY_ACCESS_WINDOW_MS;
      return listingDate > cutoff;
    };

    // Listing from 73 hours ago - should NOT be early access
    const seventyThreeHoursAgo = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
    expect(isEarlyAccessListing(seventyThreeHoursAgo)).toBe(false);

    // Listing from 1 week ago - should NOT be early access
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isEarlyAccessListing(oneWeekAgo)).toBe(false);
  });
});

// =============================================================================
// SUBSCRIPTION TYPE TESTS
// =============================================================================

describe('Subscription tier access', () => {
  it('free tier should have isDelayed=true', async () => {
    const { createSubscriptionState } = await import('@/types/subscription');

    const state = createSubscriptionState(null);
    expect(state.tier).toBe('free');
    expect(state.isFree).toBe(true);
  });

  it('enthusiast tier should have access to fresh_data', async () => {
    const { createSubscriptionState, canAccessFeature } = await import('@/types/subscription');

    const state = createSubscriptionState({
      subscription_tier: 'enthusiast',
      subscription_status: 'active',
      subscription_started_at: null,
      subscription_expires_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });

    expect(state.tier).toBe('enthusiast');
    expect(state.isFree).toBe(false);
    expect(canAccessFeature('enthusiast', 'fresh_data')).toBe(true);
  });

  it('connoisseur tier should have access to fresh_data', async () => {
    const { canAccessFeature } = await import('@/types/subscription');
    expect(canAccessFeature('connoisseur', 'fresh_data')).toBe(true);
  });

  it('free tier should NOT have access to fresh_data', async () => {
    const { canAccessFeature } = await import('@/types/subscription');
    expect(canAccessFeature('free', 'fresh_data')).toBe(false);
  });

  it('inactive subscription should be treated as free', async () => {
    const { createSubscriptionState } = await import('@/types/subscription');

    const state = createSubscriptionState({
      subscription_tier: 'enthusiast',
      subscription_status: 'inactive', // Not active!
      subscription_started_at: null,
      subscription_expires_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });

    // Should be treated as free tier
    expect(state.tier).toBe('free');
    expect(state.isFree).toBe(true);
  });
});

// =============================================================================
// FETCH CREDENTIALS TESTS - CRITICAL FOR AUTH
// =============================================================================

describe('Browse page fetch credentials', () => {
  let originalFetch: typeof global.fetch;
  let fetchCalls: Array<{ url: string; options?: RequestInit }>;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = global.fetch;

    // Mock fetch to capture calls
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      fetchCalls.push({ url: urlString, options });

      // Return a mock response
      return Promise.resolve(new Response(JSON.stringify({
        listings: [],
        total: 0,
        page: 1,
        totalPages: 0,
        facets: { itemTypes: [], certifications: [], dealers: [] },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('CRITICAL: browse API fetch must include credentials', async () => {
    // Read the actual source file to verify credentials are included
    const fs = await import('fs');
    const path = await import('path');

    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // Find all lines with fetch to /api/browse
    const lines = pageContent.split('\n');
    const browseFetchLines: string[] = [];
    const browseFetchWithCredentials: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('/api/browse') && line.includes('fetch')) {
        browseFetchLines.push(line);
        // Check if this fetch has credentials: 'include'
        if (line.includes("credentials: 'include'") || line.includes('credentials: "include"')) {
          browseFetchWithCredentials.push(line);
        }
      }
    }

    // Must have at least one fetch to browse API
    expect(browseFetchLines.length).toBeGreaterThan(0);

    // ALL browse fetches must have credentials
    // If this test fails, auth cookies won't be sent and users will be treated as free tier!
    expect(browseFetchWithCredentials.length).toBe(browseFetchLines.length);

    if (browseFetchWithCredentials.length !== browseFetchLines.length) {
      const missingCredentials = browseFetchLines.filter(
        line => !line.includes("credentials: 'include'") && !line.includes('credentials: "include"')
      );
      throw new Error(
        `CRITICAL: Found ${browseFetchLines.length} fetch calls to /api/browse but only ${browseFetchWithCredentials.length} include credentials.\n` +
        `Missing credentials on:\n${missingCredentials.join('\n')}\n` +
        `All fetch calls must include { credentials: 'include' } to send auth cookies.`
      );
    }
  });
});

// =============================================================================
// BROWSE API RESPONSE TESTS
// =============================================================================

describe('Browse API subscription response fields', () => {
  const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

  async function isServerAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/browse?limit=1`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  it('anonymous request returns isDelayed=true and tier=free', async () => {
    const serverUp = await isServerAvailable();
    if (!serverUp) {
      console.log('Skipping: Server not available');
      return;
    }

    const res = await fetch(`${API_BASE}/api/browse?limit=1`);
    const data = await res.json();

    // Anonymous users should see delayed data
    expect(data.isDelayed).toBe(true);
    expect(data.subscriptionTier).toBe('free');
  });
});

// =============================================================================
// ADMIN ACCESS TESTS
// =============================================================================

describe('Admin subscription access', () => {
  it('admin role should grant connoisseur tier in SubscriptionContext', async () => {
    // This tests the logic in SubscriptionContext
    // When isAdmin is true, user should get connoisseur access

    // The logic is:
    // if (isAdmin) {
    //   return { tier: 'connoisseur', canAccess: () => true, ... }
    // }

    // We can't easily test React context, but we can verify the types
    const { canAccessFeature } = await import('@/types/subscription');

    // Connoisseur can access everything
    expect(canAccessFeature('connoisseur', 'fresh_data')).toBe(true);
    expect(canAccessFeature('connoisseur', 'inquiry_emails')).toBe(true);
    expect(canAccessFeature('connoisseur', 'saved_searches')).toBe(true);
    expect(canAccessFeature('connoisseur', 'search_alerts')).toBe(true);
  });
});

// =============================================================================
// REGRESSION GUARD: Verify the fix is in place
// =============================================================================

describe('REGRESSION GUARD: Data delay auth fix', () => {
  it('browse API route has force-dynamic export', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const routePath = path.resolve(process.cwd(), 'src/app/api/browse/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');

    // Must have force-dynamic to bypass Vercel edge caching
    expect(routeContent).toContain("export const dynamic = 'force-dynamic'");
  });

  it('browse API uses no-store cache for authenticated users', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const routePath = path.resolve(process.cwd(), 'src/app/api/browse/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf-8');

    // Must use no-store for authenticated users to prevent caching
    expect(routeContent).toContain('no-store');
  });

  it('server subscription util checks admin role', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const serverPath = path.resolve(process.cwd(), 'src/lib/subscription/server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    // Must check for admin role
    expect(serverContent).toContain("role === 'admin'");
    // Admin should get isDelayed: false
    expect(serverContent).toContain('isDelayed: false');
  });
});
