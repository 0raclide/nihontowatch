import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewSinceLastVisitBanner } from '@/components/browse/NewSinceLastVisitBanner';

// Mock the hooks
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/NewSinceLastVisitContext', () => ({
  useNewSinceLastVisit: vi.fn(),
  useShouldShowNewItemsBanner: vi.fn(),
}));

// Mock LoginModal component to avoid Next.js router issues in tests
vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div data-testid="login-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
  ),
}));

// Mock ConsentContext
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(),
}));

// Mock hasFunctionalConsent helper
vi.mock('@/lib/consent', () => ({
  hasFunctionalConsent: vi.fn(),
}));

import { useAuth } from '@/lib/auth/AuthContext';
import {
  useNewSinceLastVisit,
  useShouldShowNewItemsBanner,
} from '@/contexts/NewSinceLastVisitContext';
import { useConsent } from '@/contexts/ConsentContext';
import { hasFunctionalConsent } from '@/lib/consent';

const mockUseAuth = vi.mocked(useAuth);
const mockUseNewSinceLastVisit = vi.mocked(useNewSinceLastVisit);
const mockUseShouldShowNewItemsBanner = vi.mocked(useShouldShowNewItemsBanner);
const mockUseConsent = vi.mocked(useConsent);
const mockHasFunctionalConsent = vi.mocked(hasFunctionalConsent);

describe('NewSinceLastVisitBanner', () => {
  const mockDismiss = vi.fn();
  const mockOpenPreferences = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock values
    mockUseNewSinceLastVisit.mockReturnValue({
      count: null,
      daysSince: null,
      isFirstVisit: false,
      isDismissed: false,
      isLoading: false,
      lastVisitAt: null,
      dismiss: mockDismiss,
      recordVisit: vi.fn(),
      refresh: vi.fn(),
    });

    // Mock consent context
    mockUseConsent.mockReturnValue({
      openPreferences: mockOpenPreferences,
      closePreferences: vi.fn(),
      closeBanner: vi.fn(),
      hasConsent: vi.fn(),
      acceptAll: vi.fn(),
      rejectNonEssential: vi.fn(),
      updateConsent: vi.fn(),
      resetConsent: vi.fn(),
      hasConsented: false,
      consent: null,
      showBanner: false,
      showPreferences: false,
    } as never);

    // Default: user has functional consent (tests can override)
    mockHasFunctionalConsent.mockReturnValue(true);
  });

  describe('when shouldShow is false', () => {
    it('renders nothing', () => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(false);
      mockUseAuth.mockReturnValue({ user: null } as never);

      const { container } = render(<NewSinceLastVisitBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('consent upsell (logged-in without functional consent)', () => {
    beforeEach(() => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(true);
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as never);
      // User is logged in but has NOT consented to functional cookies
      mockHasFunctionalConsent.mockReturnValue(false);
    });

    it('renders consent upsell banner', () => {
      render(<NewSinceLastVisitBanner />);

      // Text appears twice (desktop + mobile versions)
      const texts = screen.getAllByText(/enable personalization/i);
      expect(texts.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    });

    it('opens preferences modal when clicking enable', () => {
      render(<NewSinceLastVisitBanner />);

      const enableButton = screen.getByRole('button', { name: /enable/i });
      fireEvent.click(enableButton);

      expect(mockOpenPreferences).toHaveBeenCalledTimes(1);
    });

    it('uses purple styling for consent upsell', () => {
      const { container } = render(<NewSinceLastVisitBanner />);

      const banner = container.firstChild as HTMLElement;
      expect(banner?.className).toContain('bg-purple');
    });

    it('has dismiss button', () => {
      render(<NewSinceLastVisitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('calls dismiss when clicking dismiss button', () => {
      render(<NewSinceLastVisitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('logged-out user teaser', () => {
    beforeEach(() => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(true);
      mockUseAuth.mockReturnValue({ user: null } as never);
    });

    it('renders login teaser for logged-out users', () => {
      render(<NewSinceLastVisitBanner />);

      // There are two text variants (desktop/mobile), check at least one exists
      const texts = screen.getAllByText(/log in to track new items/i);
      expect(texts.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('opens login modal when clicking login button', () => {
      render(<NewSinceLastVisitBanner />);

      // Modal should not be visible initially
      expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();

      // Click the login button
      const loginButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(loginButton);

      // Modal should now be visible
      expect(screen.getByTestId('login-modal')).toBeInTheDocument();
    });

    it('has dismiss button', () => {
      render(<NewSinceLastVisitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('calls dismiss when clicking dismiss button', () => {
      render(<NewSinceLastVisitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it('uses blue styling for teaser', () => {
      const { container } = render(<NewSinceLastVisitBanner />);

      // The outermost div has the blue background styling
      const banner = container.firstChild as HTMLElement;
      expect(banner?.className).toContain('bg-blue');
    });
  });

  describe('logged-in user with new items', () => {
    beforeEach(() => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(true);
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as never);
    });

    it('renders new items count', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 47,
        daysSince: 3,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/47 new items/i)).toBeInTheDocument();
    });

    it('shows "X days ago" for days > 1', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 10,
        daysSince: 5,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/5 days ago/i)).toBeInTheDocument();
    });

    it('shows "yesterday" for daysSince = 1', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 10,
        daysSince: 1,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/yesterday/i)).toBeInTheDocument();
    });

    it('shows "today" for daysSince = 0', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 5,
        daysSince: 0,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: new Date().toISOString(),
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/today/i)).toBeInTheDocument();
    });

    it('shows "30+ days ago" for daysSince > 30', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 100,
        daysSince: 45,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/30\+ days ago/i)).toBeInTheDocument();
    });

    it('scrolls to top and dismisses when clicking view new items', () => {
      const scrollToMock = vi.fn();
      window.scrollTo = scrollToMock;

      mockUseNewSinceLastVisit.mockReturnValue({
        count: 10,
        daysSince: 3,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      const viewButton = screen.getByRole('button', { name: /view new items/i });
      fireEvent.click(viewButton);

      expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      expect(mockDismiss).toHaveBeenCalled();
    });

    it('uses emerald/green styling for logged-in banner', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 10,
        daysSince: 3,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      const { container } = render(<NewSinceLastVisitBanner />);

      // The outermost div has the emerald background styling
      const banner = container.firstChild as HTMLElement;
      expect(banner?.className).toContain('bg-emerald');
    });

    it('handles singular "item" when count is 1', () => {
      mockUseNewSinceLastVisit.mockReturnValue({
        count: 1,
        daysSince: 1,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: false,
        lastVisitAt: '2024-01-01T00:00:00Z',
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      render(<NewSinceLastVisitBanner />);

      expect(screen.getByText(/1 new item(?!s)/)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders nothing while loading', () => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(true);
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as never);
      mockUseNewSinceLastVisit.mockReturnValue({
        count: null,
        daysSince: null,
        isFirstVisit: false,
        isDismissed: false,
        isLoading: true,
        lastVisitAt: null,
        dismiss: mockDismiss,
        recordVisit: vi.fn(),
        refresh: vi.fn(),
      });

      const { container } = render(<NewSinceLastVisitBanner />);
      expect(container.firstChild).toBeNull();
    });
  });
});
