/**
 * Tests for MobileAlertBar component
 *
 * Tests cover:
 * - Hidden when no filters are active
 * - Visible when filters are active
 * - Quick-save creates search with instant frequency
 * - Shows success toast after saving
 * - Dismiss persists via sessionStorage
 * - Paywall gating for non-subscribers
 * - Login modal for unauthenticated users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MobileAlertBar } from '@/components/browse/MobileAlertBar';
import type { SavedSearchCriteria } from '@/types';

// =============================================================================
// MOCKS
// =============================================================================

const mockCreateSavedSearch = vi.fn();
let mockUser: { id: string } | null = null;
let mockRequireFeature: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    isAdmin: false,
    profile: null,
  }),
}));

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    requireFeature: mockRequireFeature,
    tier: 'inner_circle',
    canAccessFeature: () => true,
  }),
}));

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then((m) => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return { useLocale: () => ({ locale: 'en', setLocale: () => {}, t }) };
});

vi.mock('@/hooks/useSavedSearches', () => ({
  useSavedSearches: () => ({
    createSavedSearch: mockCreateSavedSearch,
    isCreating: false,
    savedSearches: [],
    isLoading: false,
    error: null,
    fetchSavedSearches: vi.fn(),
    toggleSavedSearch: vi.fn(),
    updateSavedSearch: vi.fn(),
    updateNotificationFrequency: vi.fn(),
    deleteSavedSearch: vi.fn(),
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal">Login Modal</div> : null,
}));

vi.mock('@/lib/tracking/ActivityTracker', () => ({
  useActivityTrackerOptional: () => null,
}));

// =============================================================================
// HELPERS
// =============================================================================

const emptyCriteria: SavedSearchCriteria = {
  tab: 'available',
  itemTypes: [],
  certifications: [],
  dealers: [],
  schools: [],
  sort: 'featured',
};

const filteredCriteria: SavedSearchCriteria = {
  tab: 'available',
  category: 'nihonto',
  itemTypes: ['katana'],
  certifications: ['Juyo'],
  dealers: [],
  schools: [],
  sort: 'featured',
};

// =============================================================================
// TESTS
// =============================================================================

describe('MobileAlertBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1' };
    mockRequireFeature = vi.fn().mockReturnValue(true);
    sessionStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  describe('visibility', () => {
    it('does not render when no filters are active', () => {
      const { container } = render(<MobileAlertBar criteria={emptyCriteria} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when filters are active', () => {
      render(<MobileAlertBar criteria={filteredCriteria} />);
      expect(screen.getByText('Get alerts for this search')).toBeInTheDocument();
    });

    it('renders when only askOnly is set', () => {
      render(
        <MobileAlertBar
          criteria={{ ...emptyCriteria, askOnly: true }}
        />
      );
      expect(screen.getByText('Get alerts for this search')).toBeInTheDocument();
    });

    it('renders when only query is set', () => {
      render(
        <MobileAlertBar
          criteria={{ ...emptyCriteria, query: 'masamune' }}
        />
      );
      expect(screen.getByText('Get alerts for this search')).toBeInTheDocument();
    });

    it('renders when only price range is set', () => {
      render(
        <MobileAlertBar
          criteria={{ ...emptyCriteria, minPrice: 100000 }}
        />
      );
      expect(screen.getByText('Get alerts for this search')).toBeInTheDocument();
    });

    it('does not render when dismissed', () => {
      sessionStorage.setItem('mobileAlertBarDismissed', 'true');

      const { container } = render(
        <MobileAlertBar criteria={filteredCriteria} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Quick-save
  // ---------------------------------------------------------------------------

  describe('quick-save', () => {
    it('creates saved search with instant frequency on tap', async () => {
      mockCreateSavedSearch.mockResolvedValue({ id: 'ss-new' });

      render(<MobileAlertBar criteria={filteredCriteria} />);

      fireEvent.click(screen.getByText('Save'));

      expect(mockCreateSavedSearch).toHaveBeenCalledWith({
        search_criteria: filteredCriteria,
        notification_frequency: 'instant',
      });
    });

    it('shows success toast after saving', async () => {
      mockCreateSavedSearch.mockResolvedValue({ id: 'ss-new' });

      render(<MobileAlertBar criteria={filteredCriteria} />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText("Saved! You'll get instant alerts.")).toBeInTheDocument();
      });
    });

    it('does not save when feature is gated', () => {
      mockRequireFeature.mockReturnValue(false);

      render(<MobileAlertBar criteria={filteredCriteria} />);
      fireEvent.click(screen.getByText('Save'));

      expect(mockCreateSavedSearch).not.toHaveBeenCalled();
    });

    it('shows login modal for unauthenticated users', () => {
      mockUser = null;

      render(<MobileAlertBar criteria={filteredCriteria} />);
      fireEvent.click(screen.getByText('Save'));

      expect(screen.getByTestId('login-modal')).toBeInTheDocument();
      expect(mockCreateSavedSearch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Dismiss
  // ---------------------------------------------------------------------------

  describe('dismiss', () => {
    it('hides bar and writes to sessionStorage on dismiss', () => {
      const { container } = render(
        <MobileAlertBar criteria={filteredCriteria} />
      );

      // Find dismiss button by aria-label
      const dismissBtn = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissBtn);

      // Bar should be gone
      expect(container.querySelector('.lg\\:hidden')).toBeNull();
      expect(sessionStorage.getItem('mobileAlertBarDismissed')).toBe('true');
    });
  });
});
