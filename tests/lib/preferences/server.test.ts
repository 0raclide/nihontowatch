/**
 * Server-side Preferences Tests
 *
 * Tests the showAllPrices preference integration with getUserSubscription()
 * and effective min price computation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before any imports
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Define mock clients
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock('@/types/subscription', () => ({
  isTrialModeActive: vi.fn(() => false),
}));

import { getUserSubscription } from '@/lib/subscription/server';
import { LISTING_FILTERS } from '@/lib/constants';

// Helper to create a chainable Supabase query builder
function createMockQueryBuilder(data: unknown = null, error: unknown = null) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue({ data, error });

  return builder;
}

describe('getUserSubscription showAllPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns showAllPrices: true for anonymous users', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(true);
    expect(result.userId).toBeNull();
  });

  it('returns showAllPrices: true when preference is not set', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const profileBuilder = createMockQueryBuilder({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      role: 'user',
      preferences: null,
    });

    mockServiceClient.from.mockReturnValue(profileBuilder);

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(true);
  });

  it('returns showAllPrices: true when preference is undefined (not explicitly set)', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-124' } },
      error: null,
    });

    const profileBuilder = createMockQueryBuilder({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      role: 'user',
      preferences: { someOtherPref: 'value' },
    });

    mockServiceClient.from.mockReturnValue(profileBuilder);

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(true);
  });

  it('returns showAllPrices: true when preference is enabled', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-456' } },
      error: null,
    });

    const profileBuilder = createMockQueryBuilder({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      role: 'user',
      preferences: { showAllPrices: true },
    });

    mockServiceClient.from.mockReturnValue(profileBuilder);

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(true);
  });

  it('returns showAllPrices: false when preference is explicitly false', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-789' } },
      error: null,
    });

    const profileBuilder = createMockQueryBuilder({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      role: 'user',
      preferences: { showAllPrices: false },
    });

    mockServiceClient.from.mockReturnValue(profileBuilder);

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(false);
  });

  it('returns showAllPrices from preferences for admin users', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });

    const profileBuilder = createMockQueryBuilder({
      subscription_tier: 'free',
      subscription_status: 'inactive',
      role: 'admin',
      preferences: { showAllPrices: true },
    });

    mockServiceClient.from.mockReturnValue(profileBuilder);

    const result = await getUserSubscription();
    expect(result.isAdmin).toBe(true);
    expect(result.showAllPrices).toBe(true);
  });

  it('returns showAllPrices: true on error', async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

    const result = await getUserSubscription();
    expect(result.showAllPrices).toBe(true);
  });
});

describe('Effective min price computation', () => {
  it('MIN_PRICE_JPY constant is a positive number', () => {
    expect(LISTING_FILTERS.MIN_PRICE_JPY).toBeGreaterThan(0);
    expect(LISTING_FILTERS.MIN_PRICE_JPY).toBe(100000);
  });

  it('showAllPrices=true should produce minPrice=0', () => {
    const showAllPrices = true;
    const minPrice = showAllPrices ? 0 : LISTING_FILTERS.MIN_PRICE_JPY;
    expect(minPrice).toBe(0);
  });

  it('showAllPrices=false should produce minPrice=100000', () => {
    const showAllPrices = false;
    const minPrice = showAllPrices ? 0 : LISTING_FILTERS.MIN_PRICE_JPY;
    expect(minPrice).toBe(100000);
  });
});
