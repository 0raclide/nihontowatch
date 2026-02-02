/**
 * Trial Mode Tests
 *
 * CRITICAL: These tests ensure trial mode correctly unlocks all features.
 * When NEXT_PUBLIC_TRIAL_MODE=true:
 * 1. All users get access to all features (no paywall)
 * 2. No data delay for any user (isDelayed=false)
 * 3. DataDelayBanner is hidden
 *
 * When trial mode is OFF:
 * 1. Normal feature gating applies
 * 2. Free users see 72h delayed data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// TRIAL MODE DETECTION TESTS
// =============================================================================

describe('isTrialModeActive', () => {
  const originalEnv = process.env.NEXT_PUBLIC_TRIAL_MODE;

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_TRIAL_MODE;
    } else {
      process.env.NEXT_PUBLIC_TRIAL_MODE = originalEnv;
    }
    vi.resetModules();
  });

  it('returns true when NEXT_PUBLIC_TRIAL_MODE=true', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    vi.resetModules();

    const { isTrialModeActive } = await import('@/types/subscription');
    expect(isTrialModeActive()).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_TRIAL_MODE=false', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    const { isTrialModeActive } = await import('@/types/subscription');
    expect(isTrialModeActive()).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_TRIAL_MODE is not set', async () => {
    delete process.env.NEXT_PUBLIC_TRIAL_MODE;
    vi.resetModules();

    const { isTrialModeActive } = await import('@/types/subscription');
    expect(isTrialModeActive()).toBe(false);
  });

  it('returns false for other string values', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'yes';
    vi.resetModules();

    const { isTrialModeActive } = await import('@/types/subscription');
    expect(isTrialModeActive()).toBe(false);
  });
});

// =============================================================================
// FEATURE ACCESS IN TRIAL MODE
// =============================================================================

describe('canAccessFeature in trial mode', () => {
  const originalEnv = process.env.NEXT_PUBLIC_TRIAL_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_TRIAL_MODE;
    } else {
      process.env.NEXT_PUBLIC_TRIAL_MODE = originalEnv;
    }
    vi.resetModules();
  });

  it('CRITICAL: free tier gets ALL features when trial mode is active', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    vi.resetModules();

    const { canAccessFeature } = await import('@/types/subscription');

    // All features should be accessible for free tier
    expect(canAccessFeature('free', 'fresh_data')).toBe(true);
    expect(canAccessFeature('free', 'setsumei_translation')).toBe(true);
    expect(canAccessFeature('free', 'inquiry_emails')).toBe(true);
    expect(canAccessFeature('free', 'saved_searches')).toBe(true);
    expect(canAccessFeature('free', 'search_alerts')).toBe(true);
    expect(canAccessFeature('free', 'private_listings')).toBe(true);
    expect(canAccessFeature('free', 'artist_stats')).toBe(true);
    expect(canAccessFeature('free', 'export_data')).toBe(true);
  });

  it('free tier is restricted when trial mode is OFF', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    const { canAccessFeature } = await import('@/types/subscription');

    // Free tier should NOT have access to paid features
    expect(canAccessFeature('free', 'fresh_data')).toBe(false);
    expect(canAccessFeature('free', 'setsumei_translation')).toBe(false);
    expect(canAccessFeature('free', 'inquiry_emails')).toBe(false);
    expect(canAccessFeature('free', 'saved_searches')).toBe(false);
    expect(canAccessFeature('free', 'search_alerts')).toBe(false);
    expect(canAccessFeature('free', 'private_listings')).toBe(false);
  });

  it('paid tiers still work correctly when trial mode is OFF', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    const { canAccessFeature } = await import('@/types/subscription');

    // Enthusiast should have enthusiast features
    expect(canAccessFeature('enthusiast', 'fresh_data')).toBe(true);
    expect(canAccessFeature('enthusiast', 'setsumei_translation')).toBe(true);

    // Connoisseur should have all features
    expect(canAccessFeature('connoisseur', 'private_listings')).toBe(true);
    expect(canAccessFeature('connoisseur', 'artist_stats')).toBe(true);
  });
});

// =============================================================================
// DATA DELAY IN TRIAL MODE
// =============================================================================

describe('getUserSubscription isDelayed in trial mode', () => {
  let mockCreateClient: ReturnType<typeof vi.fn>;
  let mockCreateServiceClient: ReturnType<typeof vi.fn>;
  let mockAuthClient: {
    auth: { getUser: ReturnType<typeof vi.fn> };
    from: ReturnType<typeof vi.fn>;
  };
  let mockServiceClient: {
    from: ReturnType<typeof vi.fn>;
  };

  const originalEnv = process.env.NEXT_PUBLIC_TRIAL_MODE;

  beforeEach(() => {
    vi.resetModules();

    // Create mock clients
    mockAuthClient = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    };

    mockServiceClient = {
      from: vi.fn(),
    };

    mockCreateClient = vi.fn().mockResolvedValue(mockAuthClient);
    mockCreateServiceClient = vi.fn().mockReturnValue(mockServiceClient);

    // Mock the supabase module
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: mockCreateClient,
      createServiceClient: mockCreateServiceClient,
    }));
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_TRIAL_MODE;
    } else {
      process.env.NEXT_PUBLIC_TRIAL_MODE = originalEnv;
    }
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('CRITICAL: anonymous users get isDelayed=false in trial mode', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        from: vi.fn(),
      }),
      createServiceClient: vi.fn().mockReturnValue({ from: vi.fn() }),
    }));

    const { getUserSubscription } = await import('@/lib/subscription/server');
    const result = await getUserSubscription();

    expect(result.tier).toBe('free');
    expect(result.isDelayed).toBe(false); // CRITICAL: No delay in trial mode
    expect(result.userId).toBeNull();
  });

  it('CRITICAL: free tier users get isDelayed=false in trial mode', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    vi.resetModules();

    const userId = 'free-user-123';

    // Re-mock after resetModules
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId, email: 'free@test.com' } },
            error: null,
          }),
        },
        from: vi.fn(),
      }),
      createServiceClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'user', subscription_tier: 'free', subscription_status: 'inactive' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));

    const { getUserSubscription } = await import('@/lib/subscription/server');
    const result = await getUserSubscription();

    expect(result.tier).toBe('free');
    expect(result.isDelayed).toBe(false); // CRITICAL: No delay in trial mode
  });

  it('anonymous users get isDelayed=true when trial mode is OFF', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        from: vi.fn(),
      }),
      createServiceClient: vi.fn().mockReturnValue({ from: vi.fn() }),
    }));

    const { getUserSubscription } = await import('@/lib/subscription/server');
    const result = await getUserSubscription();

    expect(result.tier).toBe('free');
    expect(result.isDelayed).toBe(true); // Delay applies when trial is off
  });
});

// =============================================================================
// REGRESSION GUARD: Trial mode code presence
// =============================================================================

describe('REGRESSION GUARD: Trial mode implementation', () => {
  it('subscription types exports isTrialModeActive', async () => {
    const subscriptionModule = await import('@/types/subscription');
    expect(typeof subscriptionModule.isTrialModeActive).toBe('function');
  });

  it('canAccessFeature checks trial mode first', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/types/subscription.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must check trial mode at the start of canAccessFeature
    expect(content).toContain('isTrialModeActive()');
    expect(content).toContain('NEXT_PUBLIC_TRIAL_MODE');
  });

  it('server subscription util checks trial mode for isDelayed', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/lib/subscription/server.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must import and use isTrialModeActive
    expect(content).toContain('isTrialModeActive');
    // Must use it in isDelayed logic
    expect(content).toContain('isTrialModeActive() ? false');
  });

  it('DataDelayBanner checks trial mode', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/components/subscription/DataDelayBanner.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must check trial mode to hide banner
    expect(content).toContain('isTrialModeActive');
  });
});

// =============================================================================
// TOGGLE BEHAVIOR: Verify easy on/off
// =============================================================================

describe('Trial mode toggle behavior', () => {
  it('can be toggled by changing env var (simulated)', async () => {
    // First, trial mode OFF
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    const { canAccessFeature } = await import('@/types/subscription');
    expect(canAccessFeature('free', 'fresh_data')).toBe(false);

    // Now, trial mode ON
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    vi.resetModules();

    // Re-import to get fresh module with new env
    const freshModule = await import('@/types/subscription');
    expect(freshModule.canAccessFeature('free', 'fresh_data')).toBe(true);

    // Back to OFF
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'false';
    vi.resetModules();

    const offModule = await import('@/types/subscription');
    expect(offModule.canAccessFeature('free', 'fresh_data')).toBe(false);
  });
});
