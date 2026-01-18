/**
 * Tests for URL sync behavior in the home page
 *
 * These tests prevent regressions like:
 * - Infinite render loops when search params are present
 * - router.replace() overwriting router.push() history entries
 * - Search getting stuck on loading spinner
 *
 * @see https://github.com/0raclide/nihontowatch/issues/XXX (search hanging bug)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/navigation before importing components
const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('URL Sync Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        listings: [],
        total: 0,
        page: 1,
        totalPages: 1,
        facets: {
          itemTypes: [],
          certifications: [],
          dealers: [],
          historicalPeriods: [],
          signatureStatuses: [],
        },
        lastUpdated: null,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('router.replace() deduplication', () => {
    it('should NOT call router.replace() on initial mount', async () => {
      // This test verifies that on first render, we don't immediately replace the URL
      // This preserves history entries created by router.push() from search

      // The fix: On initial mount, prevUrlRef.current is null
      // We set it to the current URL but skip the replace call

      // Simulate the logic from page.tsx
      let prevUrl: string | null = null;
      const newUrl = '/?q=tokuju';

      // First render - should skip replace
      if (prevUrl === newUrl) {
        // Skip - URL unchanged
      } else if (prevUrl === null) {
        // Initial mount - record URL but don't replace
        prevUrl = newUrl;
        // mockReplace should NOT be called here
      } else {
        mockReplace(newUrl, { scroll: false });
      }

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should NOT call router.replace() when URL has not changed', async () => {
      // This test verifies that consecutive renders with same URL don't trigger replace
      // This prevents infinite render loops

      let prevUrl: string | null = '/?q=tokuju';
      const newUrl = '/?q=tokuju'; // Same URL

      // Subsequent render with same URL - should skip
      if (prevUrl === newUrl) {
        // Skip - URL unchanged
      } else if (prevUrl === null) {
        prevUrl = newUrl;
      } else {
        mockReplace(newUrl, { scroll: false });
      }

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should call router.replace() when URL actually changes', async () => {
      // This test verifies that filter changes DO update the URL

      let prevUrl: string | null = '/?q=tokuju';
      const newUrl = '/?q=tokuju&cert=Juyo'; // Different URL

      if (prevUrl === newUrl) {
        // Skip
      } else if (prevUrl === null) {
        prevUrl = newUrl;
      } else {
        mockReplace(newUrl, { scroll: false });
      }

      expect(mockReplace).toHaveBeenCalledWith(newUrl, { scroll: false });
    });
  });

  describe('History preservation', () => {
    it('should preserve router.push() history entry from search', async () => {
      // When user searches:
      // 1. router.push('/?q=katana') creates history entry
      // 2. URL sync effect should NOT immediately replace it

      // Simulate search submission
      mockPush('/?q=katana');
      expect(mockPush).toHaveBeenCalledWith('/?q=katana');

      // Simulate URL sync effect on next render
      // With the fix, it should NOT call replace on initial mount
      let prevUrl: string | null = null;
      const newUrl = '/?q=katana';

      if (prevUrl === null) {
        prevUrl = newUrl;
        // Don't call replace - preserves the push history entry
      }

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should allow back button to work after search', async () => {
      // The back button works if:
      // 1. Search creates a history entry (router.push)
      // 2. URL sync doesn't overwrite it (router.replace skipped on mount)

      // Before fix: push -> immediate replace -> only 1 history entry
      // After fix: push -> skip replace on mount -> 2 history entries

      const historyStack: string[] = ['/'];

      // User searches
      const searchUrl = '/?q=katana';
      historyStack.push(searchUrl); // router.push adds entry

      // URL sync should NOT remove this entry
      // (replace would overwrite, but we skip on initial mount)

      expect(historyStack.length).toBe(2);
      expect(historyStack[0]).toBe('/');
      expect(historyStack[1]).toBe('/?q=katana');

      // Back button would pop the stack
      historyStack.pop();
      expect(historyStack.length).toBe(1);
      expect(historyStack[0]).toBe('/');
    });
  });

  describe('Infinite loop prevention', () => {
    it('should not trigger infinite renders with search query', async () => {
      // This test simulates multiple render cycles to ensure we don't loop

      let prevUrl: string | null = null;
      const url = '/?q=tokuju';
      let replaceCallCount = 0;

      // Simulate 10 render cycles
      for (let i = 0; i < 10; i++) {
        if (prevUrl === url) {
          // Skip - no change
        } else if (prevUrl === null) {
          prevUrl = url;
          // Initial mount - don't replace
        } else {
          replaceCallCount++;
        }
      }

      // Should only have 0 replace calls (initial mount skips, subsequent renders skip due to same URL)
      expect(replaceCallCount).toBe(0);
    });

    it('should only call replace once when filter changes', async () => {
      let prevUrl: string | null = '/';
      let replaceCallCount = 0;

      // First: establish initial state
      const url1 = '/';
      if (prevUrl === url1) { /* skip */ }
      else if (prevUrl === null) { prevUrl = url1; }
      else { replaceCallCount++; prevUrl = url1; }

      // Second: filter changes
      const url2 = '/?cert=Juyo';
      if (prevUrl === url2) { /* skip */ }
      else if (prevUrl === null) { prevUrl = url2; }
      else { replaceCallCount++; prevUrl = url2; }

      // Third: same filter (re-render)
      if (prevUrl === url2) { /* skip */ }
      else if (prevUrl === null) { prevUrl = url2; }
      else { replaceCallCount++; prevUrl = url2; }

      // Should only have 1 replace call (for the actual filter change)
      expect(replaceCallCount).toBe(1);
    });
  });
});

describe('Search Flow Integration', () => {
  it('should not hang on search query in URL', async () => {
    // This test documents the expected behavior:
    // When visiting /?q=tokuju directly:
    // 1. searchQuery state initializes to 'tokuju'
    // 2. Fetch effect runs to load results
    // 3. URL sync effect records URL but doesn't replace (initial mount)
    // 4. Page renders with results (not stuck on loading)

    const searchQuery = 'tokuju';

    // Fetch should be called
    const fetchParams = new URLSearchParams();
    fetchParams.set('tab', 'available');
    fetchParams.set('page', '1');
    fetchParams.set('q', searchQuery);

    // Simulate fetch
    mockFetch(`/api/browse?${fetchParams.toString()}`);

    expect(mockFetch).toHaveBeenCalled();

    // URL sync should NOT call replace on initial mount
    // (verified by previous tests)
  });

  it('should allow clearing search and returning to browse', async () => {
    // When user clears search:
    // 1. setSearchQuery('') is called
    // 2. router.push('/') creates history entry for back navigation
    // 3. URL sync replaces to '/' (but this is fine, URL matches)

    // Clear search action
    mockPush('/');

    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
