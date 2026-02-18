/**
 * Tests for artist directory filter persistence via URL params.
 *
 * The /artists page uses native History.prototype.replaceState (bypassing Next.js)
 * to avoid Suspense/loading.tsx flashes. To survive back/forward navigation,
 * filters are encoded in the URL query string. On mount, the component reads
 * window.location.search to detect stale initialFilters (from cached RSC payload)
 * and re-fetches with the correct params. These tests ensure:
 *
 * 1. Filter changes update the URL via replaceState
 * 2. On mount with URL params, the component uses them over initialFilters
 * 3. On mount without URL params, initialFilters are used (fresh visit)
 * 4. popstate events restore filters from the URL
 * 5. Search (typing in search bar) still works (no navigation triggered)
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be before component import
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/contexts/MobileUIContext', () => ({
  useMobileUI: () => ({ openNavDrawer: vi.fn() }),
}));

// Expose onFilterChange so tests can trigger sort/filter changes
let capturedOnFilterChange: ((key: string, value: string | boolean) => void) | null = null;
let capturedOnSearchInput: ((value: string) => void) | null = null;
let capturedOnSearchSubmit: ((e: React.FormEvent) => void) | null = null;

vi.mock('@/components/artisan/ArtistFilterSidebar', () => ({
  ArtistFilterSidebar: (props: {
    filters: Record<string, unknown>;
    onFilterChange: (key: string, value: string | boolean) => void;
    onSearchInput: (value: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    [k: string]: unknown;
  }) => {
    capturedOnFilterChange = props.onFilterChange;
    capturedOnSearchInput = props.onSearchInput;
    capturedOnSearchSubmit = props.onSearchSubmit;
    return (
      <div data-testid="filter-sidebar">
        <span data-testid="current-sort">{String(props.filters?.sort)}</span>
        <span data-testid="current-type">{String(props.filters?.type)}</span>
        <span data-testid="current-q">{String(props.filters?.q ?? '')}</span>
      </div>
    );
  },
}));

vi.mock('@/components/ui/Drawer', () => ({
  Drawer: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="drawer">{children}</div> : null,
}));

vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => {},
}));

vi.mock('@/lib/artisan/displayName', () => ({
  getArtisanDisplayParts: (name: string | null) => ({ prefix: null, name: name || 'Unknown' }),
}));

vi.mock('@/lib/artisan/eraPeriods', () => ({
  eraToBroadPeriod: (era: string | null) => era,
}));

import { ArtistsPageClient } from '@/app/artists/ArtistsPageClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS = {
  type: 'smith' as const,
  sort: 'elite_factor' as const,
  notable: true,
};

const TOTAL_ITEMS_FILTERS = {
  type: 'smith' as const,
  sort: 'total_items' as const,
  notable: true,
};

function makeApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    artists: [
      {
        code: 'MAS590',
        name_romaji: 'Masamune',
        name_kanji: '正宗',
        entity_type: 'smith',
        school: 'Soshu',
        province: 'Sagami',
        era: 'Kamakura',
        total_items: 150,
        percentile: 99,
        elite_factor: 42.5,
        kokuho_count: 0,
        jubun_count: 0,
        jubi_count: 0,
        gyobutsu_count: 0,
        tokuju_count: 5,
        juyo_count: 20,
        available_count: 3,
        is_school_code: false,
        slug: 'masamune-MAS590',
        cover_image: null,
      },
    ],
    pagination: { page: 1, pageSize: 50, totalPages: 1, totalCount: 1 },
    facets: { schools: [], provinces: [], eras: [], totals: { smiths: 100, tosogu: 50 } },
    lastUpdated: new Date().toISOString(),
    attributedItemCount: 5000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let replaceStateSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedOnFilterChange = null;
  capturedOnSearchInput = null;
  capturedOnSearchSubmit = null;

  // Spy on native History.prototype.replaceState (what the component calls)
  replaceStateSpy = vi.spyOn(History.prototype, 'replaceState');

  // Mock fetch — return valid API response
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeApiResponse()),
  });
  global.fetch = fetchMock;

  // Reset history state to clean slate
  window.history.replaceState({}, '', '/artists');
});

afterEach(() => {
  replaceStateSpy.mockRestore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ArtistsPageClient — URL-based filter persistence', () => {
  // =========================================================================
  // GOLDEN TEST 1: Filter change updates URL via replaceState
  // =========================================================================
  it('updates URL via replaceState when sort changes', async () => {
    render(<ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />);

    // Wait for initial fetch to complete
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Trigger sort change via the sidebar callback
    expect(capturedOnFilterChange).toBeTruthy();
    act(() => {
      capturedOnFilterChange!('sort', 'total_items');
    });

    // replaceState should have been called with the correct URL
    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();

    const [, , urlArg] = lastCall;
    expect(urlArg).toBe('/artists?sort=total_items');
  });

  // =========================================================================
  // GOLDEN TEST 2: Filter change updates URL with type param
  // =========================================================================
  it('updates URL with type param when type changes', async () => {
    render(<ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Change type to tosogu
    act(() => { capturedOnFilterChange!('type', 'tosogu'); });

    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    const url = String(lastCall[2]);
    expect(url).toContain('type=tosogu');
    // type switch clears school/province/era — they should not appear in URL
    expect(url).not.toContain('school=');
    expect(url).not.toContain('province=');
    expect(url).not.toContain('era=');
  });

  // =========================================================================
  // GOLDEN TEST 3: On mount, restores from URL params (back-nav)
  // =========================================================================
  it('restores filters from URL params on mount (back-nav scenario)', async () => {
    // Simulate back-nav: URL has sort=total_items from a previous replaceState
    window.history.replaceState({}, '', '/artists?sort=total_items');

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    // The sidebar should reflect the restored sort, not initialFilters
    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('total_items');
    });

    // Fetch should have been called with the restored sort
    await waitFor(() => {
      const fetchUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toContain('sort=total_items');
    });
  });

  // =========================================================================
  // GOLDEN TEST 4: On mount without URL params, uses initialFilters
  // =========================================================================
  it('uses initialFilters when URL has no params (fresh visit)', async () => {
    // Clean URL — no params
    window.history.replaceState({}, '', '/artists');

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('elite_factor');
    });

    await waitFor(() => {
      const fetchUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toContain('sort=elite_factor');
    });
  });

  // =========================================================================
  // GOLDEN TEST 5: popstate event restores filters from URL
  // =========================================================================
  it('restores filters on popstate event (reads URL params)', async () => {
    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Simulate back-navigation: browser changes URL, then fires popstate
    // In jsdom we must manually set the URL before dispatching popstate
    window.history.replaceState({}, '', '/artists?sort=total_items');

    act(() => {
      const event = new PopStateEvent('popstate', { state: {} });
      window.dispatchEvent(event);
    });

    // Component should sync to the restored filters
    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('total_items');
    });

    // Should fetch with restored sort
    await waitFor(() => {
      const lastFetchUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[0] as string;
      expect(lastFetchUrl).toContain('sort=total_items');
    });
  });

  // =========================================================================
  // GOLDEN TEST 6: popstate with same URL is a no-op
  // =========================================================================
  it('does not crash or re-fetch on popstate when URL matches current filters', async () => {
    // Start with total_items via URL
    window.history.replaceState({}, '', '/artists?sort=total_items');

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('total_items');
    });

    const fetchCountBefore = fetchMock.mock.calls.length;

    // popstate with same URL — should be a no-op
    act(() => {
      const event = new PopStateEvent('popstate', { state: {} });
      window.dispatchEvent(event);
    });

    // Should not change sort or trigger a new fetch
    expect(screen.getByTestId('current-sort').textContent).toBe('total_items');
    expect(fetchMock.mock.calls.length).toBe(fetchCountBefore);
  });

  // =========================================================================
  // GOLDEN TEST 7: Search works without triggering navigation
  // =========================================================================
  it('search triggers client-side fetch, not router navigation', async () => {
    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Simulate typing in search via the sidebar callback
    expect(capturedOnSearchInput).toBeTruthy();
    act(() => {
      capturedOnSearchInput!('masamune');
    });

    // Wait for debounce (300ms) + fetch
    await waitFor(() => {
      const allFetchUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
      const searchFetch = allFetchUrls.find((url: string) => url.includes('q=masamune'));
      expect(searchFetch).toBeDefined();
    }, { timeout: 1000 });

    // replaceState should have been called with URL containing q=masamune
    const searchReplaceCall = replaceStateSpy.mock.calls.find(
      (c: unknown[]) => String(c[2]).includes('q=masamune')
    );
    expect(searchReplaceCall).toBeDefined();
  });

  // =========================================================================
  // GOLDEN TEST 8: URL is correct after sort change
  // =========================================================================
  it('URL reflects sort param after change', async () => {
    render(<ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => { capturedOnFilterChange!('sort', 'name'); });

    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[2]).toBe('/artists?sort=name');
  });

  // =========================================================================
  // GOLDEN TEST 9: Default sort (elite_factor) omitted from URL
  // =========================================================================
  it('omits sort param from URL when set to default (elite_factor)', async () => {
    // Start with total_items via URL
    window.history.replaceState({}, '', '/artists?sort=total_items');

    render(<ArtistsPageClient initialFilters={TOTAL_ITEMS_FILTERS} initialPage={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Change back to default sort
    act(() => { capturedOnFilterChange!('sort', 'elite_factor'); });

    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    // URL should be bare /artists (no sort param for default)
    expect(lastCall[2]).toBe('/artists');
  });
});
