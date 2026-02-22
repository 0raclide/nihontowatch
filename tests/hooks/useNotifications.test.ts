/**
 * Tests for useNotifications hook
 *
 * Tests cover:
 * - Returns empty state when user is null
 * - Fetches on mount when user is logged in
 * - Polls only when hasSavedSearches is true (fix #1)
 * - Stops polling when hasSavedSearches is false
 * - markAsRead writes to localStorage and clears unreadCount
 * - Resets all state on logout
 * - Cleans up intervals on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// =============================================================================
// localStorage mock (Node 22+ provides a partial localStorage that lacks .clear())
// =============================================================================
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock useAuth before importing the hook
const mockUser = { id: 'user-1', email: 'test@example.com' };
let currentUser: typeof mockUser | null = null;

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    isLoading: false,
    isAdmin: false,
    profile: null,
  }),
}));

import { useNotifications } from '@/hooks/useNotifications';

// =============================================================================
// HELPERS
// =============================================================================

function mockFetchResponse(data: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('useNotifications', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    currentUser = null;
    originalFetch = globalThis.fetch;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------------
  // Logged out
  // ---------------------------------------------------------------------------

  describe('logged out', () => {
    it('returns empty state when user is null', () => {
      currentUser = null;
      const { result } = renderHook(() => useNotifications());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.hasSavedSearches).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('does not fetch when user is null', () => {
      currentUser = null;
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      renderHook(() => useNotifications());

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Initial fetch
  // ---------------------------------------------------------------------------

  describe('initial fetch', () => {
    it('fetches notifications on mount when logged in', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [{ id: 'n-1', searchName: 'Test' }],
        unreadCount: 1,
        hasSavedSearches: true,
      });

      const { result } = renderHook(() => useNotifications());

      // Wait for fetch to resolve
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
        '/api/notifications/recent'
      );
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.hasSavedSearches).toBe(true);
    });

    it('includes since param from localStorage', async () => {
      currentUser = mockUser;
      localStorage.setItem('lastSavedPageVisit', '2026-02-20T00:00:00.000Z');
      globalThis.fetch = mockFetchResponse({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: false,
      });

      renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('since=');
      expect(url).toContain('2026-02-20');
    });
  });

  // ---------------------------------------------------------------------------
  // Polling behavior (fix #1)
  // ---------------------------------------------------------------------------

  describe('polling', () => {
    it('starts polling after initial fetch when hasSavedSearches is true', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: true,
      });

      renderHook(() => useNotifications());

      // Initial fetch
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Advance 60 seconds — should poll again
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      // Another 60 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('does NOT poll when hasSavedSearches is false', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: false,
      });

      renderHook(() => useNotifications());

      // Initial fetch
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Advance 5 minutes — should NOT poll again
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300_000);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('stops polling on unmount', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: true,
      });

      const { unmount } = renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      unmount();

      // Advance time — should not poll after unmount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsRead
  // ---------------------------------------------------------------------------

  describe('markAsRead', () => {
    it('writes to localStorage and clears unreadCount', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [{ id: 'n-1' }],
        unreadCount: 3,
        hasSavedSearches: true,
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.unreadCount).toBe(3);

      act(() => {
        result.current.markAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      expect(localStorage.getItem('lastSavedPageVisit')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  describe('logout', () => {
    it('resets all state when user becomes null', async () => {
      currentUser = mockUser;
      globalThis.fetch = mockFetchResponse({
        notifications: [{ id: 'n-1' }],
        unreadCount: 2,
        hasSavedSearches: true,
      });

      const { result, rerender } = renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.unreadCount).toBe(2);
      expect(result.current.hasSavedSearches).toBe(true);

      // Simulate logout
      currentUser = null;
      rerender();

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.hasSavedSearches).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    it('does not crash when fetch fails', async () => {
      currentUser = mockUser;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should remain in default state, not throw
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('does not crash when response is not ok', async () => {
      currentUser = mockUser;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.notifications).toEqual([]);
    });
  });
});
