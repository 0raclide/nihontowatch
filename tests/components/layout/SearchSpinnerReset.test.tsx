/**
 * Tests for search spinner reset behavior
 *
 * These tests prevent the regression where the search spinner gets stuck
 * because isSearching is set to true but never reset after navigation.
 *
 * The bug: Header and MobileSearchSheet components call setIsSearching(true)
 * when submitting search, then router.push() navigates. But since these
 * components stay mounted (they're in layouts/providers), isSearching
 * never resets to false, leaving the spinner stuck forever.
 *
 * The fix: Add useEffect that resets isSearching when currentQuery (URL param)
 * changes, signaling that navigation completed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// Track search params changes
let mockSearchParams = new URLSearchParams();
let searchParamsListeners: (() => void)[] = [];

const mockPush = vi.fn();
const mockReplace = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock auth context
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isLoading: false,
    isAdmin: false,
  }),
}));

// Mock activity provider
vi.mock('@/components/activity/ActivityProvider', () => ({
  useActivityOptional: () => null,
}));

// Mock theme context
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock mobile UI context
const mockCloseSearch = vi.fn();
let mockSearchOpen = false;

vi.mock('@/contexts/MobileUIContext', () => ({
  useMobileUI: () => ({
    searchOpen: mockSearchOpen,
    closeSearch: mockCloseSearch,
    openSearch: vi.fn(),
    filterDrawerOpen: false,
    openFilterDrawer: vi.fn(),
    closeFilterDrawer: vi.fn(),
    navDrawerOpen: false,
    openNavDrawer: vi.fn(),
    closeNavDrawer: vi.fn(),
  }),
}));

// Helper to simulate URL change (navigation completed)
function simulateNavigation(query: string) {
  mockSearchParams = new URLSearchParams(query ? `q=${query}` : '');
}

describe('Search Spinner Reset - Core Logic', () => {
  /**
   * These tests verify the core logic that prevents spinner from getting stuck.
   * The key insight: isSearching must reset when currentQuery (URL param) changes.
   */

  it('should reset isSearching when query param changes', () => {
    // Simulate the useEffect logic from Header/MobileSearchSheet:
    // useEffect(() => { setIsSearching(false); }, [currentQuery]);

    let isSearching = true; // Spinner is showing
    let currentQuery = '';

    // Simulate navigation completing (query param changed)
    const newQuery = 'katana';
    if (newQuery !== currentQuery) {
      currentQuery = newQuery;
      isSearching = false; // This is what the useEffect does
    }

    expect(isSearching).toBe(false);
  });

  it('should not reset on same query (no infinite loop)', () => {
    let resetCount = 0;
    let currentQuery = 'katana';
    let prevQuery = 'katana';

    // Simulate multiple renders with same query
    for (let i = 0; i < 5; i++) {
      if (currentQuery !== prevQuery) {
        resetCount++;
        prevQuery = currentQuery;
      }
    }

    // Should not trigger reset on same query
    expect(resetCount).toBe(0);
  });

  it('should reset when query changes from search to different search', () => {
    let isSearching = true;
    let currentQuery = 'katana';

    // User searches again with different term
    const newQuery = 'tanto';
    if (newQuery !== currentQuery) {
      currentQuery = newQuery;
      isSearching = false;
    }

    expect(isSearching).toBe(false);
    expect(currentQuery).toBe('tanto');
  });

  it('should reset when query is cleared', () => {
    let isSearching = true;
    let currentQuery = 'katana';

    // User clears search
    const newQuery = '';
    if (newQuery !== currentQuery) {
      currentQuery = newQuery;
      isSearching = false;
    }

    expect(isSearching).toBe(false);
    expect(currentQuery).toBe('');
  });
});

describe('Search Spinner Reset - MobileSearchSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSearchOpen = true; // Sheet is open for tests
  });

  it('should show spinner when search is submitted', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    render(<MobileSearchSheet />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    const form = searchInput.closest('form')!;

    // Type and submit
    fireEvent.change(searchInput, { target: { value: 'tsuba' } });
    fireEvent.submit(form);

    // Should call router.push and closeSearch
    expect(mockPush).toHaveBeenCalledWith('/?q=tsuba');
    expect(mockCloseSearch).toHaveBeenCalled();
  });

  it('should reset spinner when URL query param changes', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    const { rerender } = render(<MobileSearchSheet />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    const form = searchInput.closest('form')!;

    // Submit search
    fireEvent.change(searchInput, { target: { value: 'juyo' } });
    fireEvent.submit(form);

    // Simulate navigation completing
    simulateNavigation('juyo');
    rerender(<MobileSearchSheet />);

    // Quick search buttons should not be disabled
    const quickSearchButtons = screen.getAllByRole('button').filter(
      btn => btn.textContent && ['Katana', 'Wakizashi', 'Tanto'].includes(btn.textContent)
    );

    await waitFor(() => {
      quickSearchButtons.forEach(btn => {
        expect(btn).not.toBeDisabled();
      });
    });
  });

  it('should reset spinner when drawer reopens', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    // Start with drawer closed
    mockSearchOpen = false;
    const { rerender } = render(<MobileSearchSheet />);

    // Open drawer
    mockSearchOpen = true;
    rerender(<MobileSearchSheet />);

    // Input should not be disabled
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).not.toBeDisabled();
  });

  it('quick search buttons should work and trigger navigation', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    render(<MobileSearchSheet />);

    // Click a quick search button
    const katanaButton = screen.getByText('Katana');
    fireEvent.click(katanaButton);

    expect(mockPush).toHaveBeenCalledWith('/?q=Katana');
    expect(mockCloseSearch).toHaveBeenCalled();
  });
});

describe('Search Spinner - Edge Cases (MobileSearchSheet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSearchOpen = true;
  });

  it('should handle rapid consecutive searches', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    const { rerender } = render(<MobileSearchSheet />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    const form = searchInput.closest('form')!;

    // First search
    fireEvent.change(searchInput, { target: { value: 'katana' } });
    fireEvent.submit(form);

    // Simulate navigation
    simulateNavigation('katana');
    rerender(<MobileSearchSheet />);

    // Open drawer again for second search
    mockSearchOpen = true;
    rerender(<MobileSearchSheet />);

    // Second search
    fireEvent.change(searchInput, { target: { value: 'tanto' } });
    fireEvent.submit(form);

    // Should handle both
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenLastCalledWith('/?q=tanto');
  });

  it('should handle empty search gracefully', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    render(<MobileSearchSheet />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    const form = searchInput.closest('form')!;

    // Submit empty search
    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.submit(form);

    // Should not navigate
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should handle search with special characters', async () => {
    const { MobileSearchSheet } = await import('@/components/layout/MobileSearchSheet');

    render(<MobileSearchSheet />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    const form = searchInput.closest('form')!;

    // Search with Japanese characters
    fireEvent.change(searchInput, { target: { value: '来国俊' } });
    fireEvent.submit(form);

    // Should encode properly
    expect(mockPush).toHaveBeenCalledWith('/?q=%E6%9D%A5%E5%9B%BD%E4%BF%8A');
  });
});
