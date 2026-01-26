import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import {
  NewSinceLastVisitProvider,
  useNewSinceLastVisit,
  useShouldShowNewItemsBanner,
} from '@/contexts/NewSinceLastVisitContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { NEW_SINCE_LAST_VISIT } from '@/lib/constants';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useAuth
vi.mock('@/lib/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    isAdmin: false,
  })),
}));

// Mock hasFunctionalConsent
vi.mock('@/lib/consent', () => ({
  hasFunctionalConsent: vi.fn(() => true), // Default to true for tests
}));

import { useAuth } from '@/lib/auth/AuthContext';
import { hasFunctionalConsent } from '@/lib/consent';
const mockUseAuth = vi.mocked(useAuth);
const mockHasFunctionalConsent = vi.mocked(hasFunctionalConsent);

// Test consumer component
function TestConsumer() {
  const {
    count,
    daysSince,
    isFirstVisit,
    isDismissed,
    isLoading,
    lastVisitAt,
    dismiss,
    recordVisit,
    refresh,
  } = useNewSinceLastVisit();

  const shouldShow = useShouldShowNewItemsBanner();

  return (
    <div>
      <span data-testid="count">{count ?? 'null'}</span>
      <span data-testid="days-since">{daysSince ?? 'null'}</span>
      <span data-testid="is-first-visit">{isFirstVisit ? 'yes' : 'no'}</span>
      <span data-testid="is-dismissed">{isDismissed ? 'yes' : 'no'}</span>
      <span data-testid="is-loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="last-visit-at">{lastVisitAt ?? 'null'}</span>
      <span data-testid="should-show">{shouldShow ? 'yes' : 'no'}</span>

      <button data-testid="dismiss" onClick={dismiss}>
        Dismiss
      </button>
      <button data-testid="record-visit" onClick={recordVisit}>
        Record Visit
      </button>
      <button data-testid="refresh" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}

describe('NewSinceLastVisitContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading state', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      expect(screen.getByTestId('is-loading').textContent).toBe('yes');
    });

    it('returns null count for logged-out users', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('count').textContent).toBe('null');
    });
  });

  describe('logged-in user', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });
    });

    it('fetches count on mount for logged-in users', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            count: 47,
            isLoggedIn: true,
            isFirstVisit: false,
            lastVisitAt: '2024-01-01T00:00:00Z',
            daysSince: 5,
          }),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/user/new-items-count');
      expect(screen.getByTestId('count').textContent).toBe('47');
      expect(screen.getByTestId('days-since').textContent).toBe('5');
    });

    it('handles first visit (no last_visit_at)', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            count: null,
            isLoggedIn: true,
            isFirstVisit: true,
          }),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('is-first-visit').textContent).toBe('yes');
      expect(screen.getByTestId('count').textContent).toBe('null');
    });
  });

  describe('dismiss functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            count: 10,
            isLoggedIn: true,
            isFirstVisit: false,
            lastVisitAt: '2024-01-01T00:00:00Z',
            daysSince: 3,
          }),
      });
    });

    it('dismisses banner and stores in sessionStorage', async () => {
      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('is-dismissed').textContent).toBe('no');

      fireEvent.click(screen.getByTestId('dismiss'));

      expect(screen.getByTestId('is-dismissed').textContent).toBe('yes');
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'nihontowatch_new_items_dismissed',
        'true'
      );
    });

    it('restores dismissed state from sessionStorage', async () => {
      sessionStorageMock.store['nihontowatch_new_items_dismissed'] = 'true';

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-dismissed').textContent).toBe('yes');
      });
    });
  });

  describe('record visit', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });
    });

    it('calls update-last-visit API when recording visit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              count: 10,
              isLoggedIn: true,
              isFirstVisit: false,
              lastVisitAt: '2024-01-01T00:00:00Z',
              daysSince: 3,
            }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              count: 0,
              isLoggedIn: true,
              isFirstVisit: false,
              lastVisitAt: new Date().toISOString(),
              daysSince: 0,
            }),
        });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('record-visit'));
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/user/update-last-visit', {
        method: 'POST',
      });
    });
  });

  describe('consent gating', () => {
    it('does not fetch count if user lacks functional consent', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        isLoading: false,
      } as never);

      // User has NOT given functional consent
      mockHasFunctionalConsent.mockReturnValue(false);

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      // Should NOT have made API call
      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('count').textContent).toBe('null');
    });

    it('fetches count if user has functional consent', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        isLoading: false,
      } as never);

      // User HAS given functional consent
      mockHasFunctionalConsent.mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isLoggedIn: true,
          count: 25,
          daysSince: 2,
          isFirstVisit: false,
          lastVisitAt: '2024-01-01T00:00:00Z',
        }),
      } as Response);

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('25');
      });

      // Should have made API call
      expect(mockFetch).toHaveBeenCalledWith('/api/user/new-items-count');
    });

    it('does not record visit if user lacks functional consent', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        isLoading: false,
      } as never);

      // User has NOT given functional consent
      mockHasFunctionalConsent.mockReturnValue(false);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      // Click record visit button
      fireEvent.click(screen.getByTestId('record-visit'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should NOT have made API call
      expect(mockFetch).not.toHaveBeenCalledWith('/api/user/update-last-visit', expect.anything());
    });
  });

  describe('useShouldShowNewItemsBanner', () => {
    it('returns true for logged-out users (teaser)', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('should-show').textContent).toBe('yes');
    });

    it('returns false when dismissed', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      sessionStorageMock.store['nihontowatch_new_items_dismissed'] = 'true';

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('should-show').textContent).toBe('no');
      });
    });

    it('returns false for first visit', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      // Explicitly set functional consent to true for this test
      mockHasFunctionalConsent.mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            count: null,
            isLoggedIn: true,
            isFirstVisit: true,
          }),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('should-show').textContent).toBe('no');
    });

    it('returns true when count >= MIN_ITEMS_THRESHOLD', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            count: NEW_SINCE_LAST_VISIT.MIN_ITEMS_THRESHOLD,
            isLoggedIn: true,
            isFirstVisit: false,
            lastVisitAt: '2024-01-01T00:00:00Z',
            daysSince: 3,
          }),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('should-show').textContent).toBe('yes');
    });

    it('returns false when count is 0', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' } as never,
        isLoading: false,
        isAdmin: false,
        profile: null,
        session: null,
        signInWithEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
      });

      // Explicitly set functional consent to true for this test
      mockHasFunctionalConsent.mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            count: 0,
            isLoggedIn: true,
            isFirstVisit: false,
            lastVisitAt: '2024-01-01T00:00:00Z',
            daysSince: 3,
          }),
      });

      render(
        <NewSinceLastVisitProvider>
          <TestConsumer />
        </NewSinceLastVisitProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('no');
      });

      expect(screen.getByTestId('should-show').textContent).toBe('no');
    });
  });
});
