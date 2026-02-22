/**
 * Tests for SaveSearchButton CTA rename (Change 1)
 *
 * Tests cover:
 * - Button shows "Get Alerts" label (not "Save Search")
 * - Button has bell icon (not bookmark)
 * - Button hidden when no filters active
 * - Button visible when filters active
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaveSearchButton } from '@/components/browse/SaveSearchButton';
import type { SavedSearchCriteria } from '@/types';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isLoading: false,
    isAdmin: false,
    profile: null,
  }),
}));

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    requireFeature: vi.fn().mockReturnValue(true),
    tier: 'inner_circle',
    canAccessFeature: () => true,
  }),
}));

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then((m) => m.default);
  const t = (key: string) => (en as Record<string, string>)[key] ?? key;
  return { useLocale: () => ({ locale: 'en', setLocale: () => {}, t }) };
});

vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/browse/SaveSearchModal', () => ({
  SaveSearchModal: () => null,
}));

// =============================================================================
// TESTS
// =============================================================================

const emptyCriteria: SavedSearchCriteria = {
  tab: 'available',
  category: 'all',
  itemTypes: [],
  certifications: [],
  dealers: [],
  schools: [],
  sort: 'featured',
};

const filteredCriteria: SavedSearchCriteria = {
  ...emptyCriteria,
  certifications: ['Juyo'],
};

describe('SaveSearchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when no filters are active', () => {
    const { container } = render(
      <SaveSearchButton criteria={emptyCriteria} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with "Get Alerts" label when filters active', () => {
    render(<SaveSearchButton criteria={filteredCriteria} />);
    expect(screen.getByText('Get Alerts')).toBeInTheDocument();
  });

  it('does NOT show old "Save Search" label', () => {
    render(<SaveSearchButton criteria={filteredCriteria} />);
    expect(screen.queryByText('Save Search')).not.toBeInTheDocument();
  });

  it('has bell icon path (not bookmark)', () => {
    const { container } = render(
      <SaveSearchButton criteria={filteredCriteria} />
    );
    const svg = container.querySelector('svg path');
    expect(svg).toBeTruthy();
    // Bell icon path starts with M15 17h5 (notification bell)
    // Bookmark icon path starts with M5 5a2 2
    const d = svg?.getAttribute('d') || '';
    expect(d).toContain('M15 17h5');
    expect(d).not.toContain('M5 5a2 2');
  });

  it('has "Get Alerts" as title attribute', () => {
    render(<SaveSearchButton criteria={filteredCriteria} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Get Alerts');
  });
});
