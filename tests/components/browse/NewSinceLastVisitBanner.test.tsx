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

import { useAuth } from '@/lib/auth/AuthContext';
import {
  useNewSinceLastVisit,
  useShouldShowNewItemsBanner,
} from '@/contexts/NewSinceLastVisitContext';

const mockUseAuth = vi.mocked(useAuth);
const mockUseNewSinceLastVisit = vi.mocked(useNewSinceLastVisit);
const mockUseShouldShowNewItemsBanner = vi.mocked(useShouldShowNewItemsBanner);

describe('NewSinceLastVisitBanner', () => {
  const mockDismiss = vi.fn();

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
  });

  describe('when shouldShow is false', () => {
    it('renders nothing', () => {
      mockUseShouldShowNewItemsBanner.mockReturnValue(false);
      mockUseAuth.mockReturnValue({ user: null } as never);

      const { container } = render(<NewSinceLastVisitBanner />);
      expect(container.firstChild).toBeNull();
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

    it('links to newest sort view', () => {
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

      const viewLink = screen.getByRole('link', { name: /view new items/i });
      expect(viewLink).toHaveAttribute('href', '/?sort=recent');
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
