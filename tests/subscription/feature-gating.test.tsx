/**
 * Feature Gating Tests
 *
 * CRITICAL: These tests ensure paid features are properly gated.
 * If these tests fail, free users may access paid features.
 *
 * Tests cover:
 * 1. SetsumeiSection shows paywall for free users
 * 2. InquiryModal shows paywall for free users
 * 3. SaveSearchButton shows paywall for free users
 * 4. All features accessible for paid users
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// =============================================================================
// MOCK SETUP - Override the global mock for specific tests
// =============================================================================

// Store the original mock
const mockShowPaywall = vi.fn();
const mockCanAccess = vi.fn();

// We need to re-mock with controllable functions
vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    tier: 'free',
    status: 'inactive',
    isFree: true,
    isPro: false,
    isCollector: false,
    isInnerCircle: false,
    isDealer: false,
    canAccess: mockCanAccess,
    requireFeature: vi.fn(),
    checkout: vi.fn(),
    openPortal: vi.fn(),
    paywallInfo: null,
    showPaywall: mockShowPaywall,
    hidePaywall: vi.fn(),
  }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock auth context
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isLoading: false,
    isAdmin: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock locale context (HighlightedMarkdown in SetsumeiSection calls useLocale)
vi.mock('@/i18n/LocaleContext', async () => {
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t: (key: string) => key }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock currency hook
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JPY',
    exchangeRates: { USD: 0.0067, EUR: 0.0062 },
  }),
  formatPriceWithConversion: () => '¥1,000,000',
}));

// =============================================================================
// TEST DATA
// =============================================================================

const mockJuyoListing = {
  id: 1,
  title: 'Test Katana',
  url: 'https://example.com/listing/1',
  price_value: 1000000,
  price_currency: 'JPY',
  cert_type: 'Juyo',
  item_type: 'katana',
  setsumei_text_en: 'This is a magnificent blade forged by master smith Masamune. The hamon shows a beautiful choji midare pattern with nie and nioi. The jigane displays fine mokume hada with ji-nie throughout. This blade represents the pinnacle of Soshu tradition craftsmanship.',
  setsumei_text_ja: '正宗作の名刀。刃文は丁子乱れ。',
  first_seen_at: new Date().toISOString(),
  dealers: { name: 'Test Dealer' },
};

const mockNonJuyoListing = {
  ...mockJuyoListing,
  cert_type: 'Hozon',
  setsumei_text_en: null,
  setsumei_text_ja: null,
};

// =============================================================================
// SETSUMEI SECTION GATING TESTS
// =============================================================================

describe('SetsumeiSection feature gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows paywall button for free users on Juyo items', async () => {
    // Free user cannot access setsumei translations
    mockCanAccess.mockReturnValue(false);

    const { SetsumeiSection } = await import('@/components/listing/SetsumeiSection');

    render(<SetsumeiSection listing={mockJuyoListing as never} />);

    // Should show "Unlock Full Translation" button
    const unlockButton = screen.getByRole('button', { name: /unlock full translation/i });
    expect(unlockButton).toBeInTheDocument();

    // Click should trigger paywall
    fireEvent.click(unlockButton);
    expect(mockShowPaywall).toHaveBeenCalledWith('setsumei_translation');
  });

  it('shows preview text (not full translation) for free users', async () => {
    mockCanAccess.mockReturnValue(false);

    const { SetsumeiSection } = await import('@/components/listing/SetsumeiSection');

    render(<SetsumeiSection listing={mockJuyoListing as never} />);

    // Should show partial text (preview)
    expect(screen.getByText(/magnificent blade/i)).toBeInTheDocument();

    // Should show "Continue reading" prompt
    expect(screen.getByText(/continue reading/i)).toBeInTheDocument();
  });

  it('shows full translation for paid users', async () => {
    // Paid user can access setsumei translations
    mockCanAccess.mockReturnValue(true);

    const { SetsumeiSection } = await import('@/components/listing/SetsumeiSection');

    render(<SetsumeiSection listing={mockJuyoListing as never} />);

    // Should NOT show unlock button
    expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeInTheDocument();

    // Should show full text (note: "Soshu" is now a glossary term in a button)
    // Check for text that appears at the end of the content, confirming full text is shown
    expect(screen.getByText(/craftsmanship/i)).toBeInTheDocument();
  });

  it('renders nothing for non-Juyo items regardless of subscription', async () => {
    mockCanAccess.mockReturnValue(false);

    const { SetsumeiSection } = await import('@/components/listing/SetsumeiSection');

    const { container } = render(<SetsumeiSection listing={mockNonJuyoListing as never} />);

    // Should render nothing for Hozon items
    expect(container.firstChild).toBeNull();
  });
});

// =============================================================================
// INQUIRY MODAL GATING TESTS
// =============================================================================

describe('InquiryModal feature gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CRITICAL: free users cannot access inquiry without seeing paywall', async () => {
    // This test verifies the gating logic exists in BrowseCTA (inquiry handling moved from QuickViewContent to slot component)
    const fs = await import('fs');
    const path = await import('path');

    const browseCTAPath = path.resolve(process.cwd(), 'src/components/listing/quickview-slots/BrowseCTA.tsx');
    const content = fs.readFileSync(browseCTAPath, 'utf-8');

    // Must check canAccess before showing inquiry modal
    expect(content).toContain("canAccess('inquiry_emails')");
    expect(content).toContain("showPaywall('inquiry_emails')");
  });
});

// =============================================================================
// SAVED SEARCHES GATING TESTS
// =============================================================================

describe('SaveSearchButton feature gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CRITICAL: free users cannot save searches without seeing paywall', async () => {
    // This test verifies the gating logic exists in SaveSearchButton
    const fs = await import('fs');
    const path = await import('path');

    const buttonPath = path.resolve(process.cwd(), 'src/components/browse/SaveSearchButton.tsx');
    const content = fs.readFileSync(buttonPath, 'utf-8');

    // Must check subscription before saving (uses requireFeature which internally calls showPaywall)
    expect(content).toContain("requireFeature('saved_searches')");
  });
});

// =============================================================================
// FEATURE ACCESS MATRIX TESTS
// =============================================================================

describe('Feature access matrix', () => {
  it('free tier should NOT have access to paid features', async () => {
    const { canAccessFeature } = await import('@/types/subscription');

    expect(canAccessFeature('free', 'fresh_data')).toBe(false);
    expect(canAccessFeature('free', 'setsumei_translation')).toBe(false);
    expect(canAccessFeature('free', 'inquiry_emails')).toBe(false);
    expect(canAccessFeature('free', 'saved_searches')).toBe(false);
  });

  it('enthusiast tier should have access to Pro features but not Collector features', async () => {
    const { canAccessFeature } = await import('@/types/subscription');

    expect(canAccessFeature('enthusiast', 'fresh_data')).toBe(true);
    expect(canAccessFeature('enthusiast', 'inquiry_emails')).toBe(true);
    expect(canAccessFeature('enthusiast', 'saved_searches')).toBe(true);
    // Setsumei moved to collector tier
    expect(canAccessFeature('enthusiast', 'setsumei_translation')).toBe(false);
    expect(canAccessFeature('enthusiast', 'artist_stats')).toBe(false);
  });

  it('collector tier should have access to Pro + Collector features', async () => {
    const { canAccessFeature } = await import('@/types/subscription');

    expect(canAccessFeature('collector', 'fresh_data')).toBe(true);
    expect(canAccessFeature('collector', 'setsumei_translation')).toBe(true);
    expect(canAccessFeature('collector', 'inquiry_emails')).toBe(true);
    expect(canAccessFeature('collector', 'saved_searches')).toBe(true);
    expect(canAccessFeature('collector', 'search_alerts')).toBe(true);
    expect(canAccessFeature('collector', 'artist_stats')).toBe(true);
    // Inner circle features not accessible
    expect(canAccessFeature('collector', 'private_listings')).toBe(false);
  });

  it('inner_circle tier should have access to all features', async () => {
    const { canAccessFeature } = await import('@/types/subscription');

    expect(canAccessFeature('inner_circle', 'fresh_data')).toBe(true);
    expect(canAccessFeature('inner_circle', 'setsumei_translation')).toBe(true);
    expect(canAccessFeature('inner_circle', 'inquiry_emails')).toBe(true);
    expect(canAccessFeature('inner_circle', 'saved_searches')).toBe(true);
    expect(canAccessFeature('inner_circle', 'search_alerts')).toBe(true);
    expect(canAccessFeature('inner_circle', 'private_listings')).toBe(true);
  });
});

// =============================================================================
// REGRESSION GUARD: Verify gating code exists
// =============================================================================

describe('REGRESSION GUARD: Feature gating code presence', () => {
  it('SetsumeiSection uses subscription context', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/components/listing/SetsumeiSection.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('useSubscription');
    expect(content).toContain("canAccess('setsumei_translation')");
    expect(content).toContain("showPaywall('setsumei_translation')");
    expect(content).toContain('Unlock Full Translation');
  });

  it('BrowseCTA gates inquiry emails', async () => {
    // Inquiry handling moved from QuickViewContent to BrowseCTA slot component
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/components/listing/quickview-slots/BrowseCTA.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('useSubscription');
    expect(content).toContain("canAccess('inquiry_emails')");
    expect(content).toContain("showPaywall('inquiry_emails')");
  });

  it('SaveSearchButton gates saved searches', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.resolve(process.cwd(), 'src/components/browse/SaveSearchButton.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('useSubscription');
    // Uses requireFeature which internally handles canAccess + showPaywall
    expect(content).toContain("requireFeature('saved_searches')");
  });
});
