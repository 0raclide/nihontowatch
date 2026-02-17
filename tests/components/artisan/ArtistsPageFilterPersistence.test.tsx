/**
 * Tests for artist directory filter persistence via history.state.
 *
 * The /artists page uses native History.prototype.replaceState (bypassing Next.js)
 * to avoid Suspense/loading.tsx flashes. To survive back/forward navigation,
 * filters are stored in window.history.state._artistFilters alongside Next.js's
 * internal routing data. These tests ensure:
 *
 * 1. Filter changes write _artistFilters into history.state
 * 2. On mount, _artistFilters is read from history.state (back-nav restoration)
 * 3. On mount without _artistFilters, initialFilters are used (fresh visit)
 * 4. popstate events restore filters from event.state._artistFilters
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
  sort: 'total_items' as const,
  notable: true,
};

const ELITE_FILTERS = {
  type: 'smith' as const,
  sort: 'elite_factor' as const,
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

describe('ArtistsPageClient — history.state filter persistence', () => {
  // =========================================================================
  // GOLDEN TEST 1: Filter change stores _artistFilters in history.state
  // =========================================================================
  it('stores _artistFilters in history.state when sort changes', async () => {
    render(<ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />);

    // Wait for initial fetch to complete
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Trigger sort change via the sidebar callback
    expect(capturedOnFilterChange).toBeTruthy();
    act(() => {
      capturedOnFilterChange!('sort', 'elite_factor');
    });

    // replaceState should have been called with _artistFilters in state
    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();

    const [stateArg, , urlArg] = lastCall;
    expect(stateArg._artistFilters).toBeDefined();
    expect(stateArg._artistFilters.sort).toBe('elite_factor');
    expect(stateArg._artistFilters.type).toBe('smith');
    expect(urlArg).toBe('/artists?sort=elite_factor');
  });

  // =========================================================================
  // GOLDEN TEST 2: Filter change stores all filter dimensions
  // =========================================================================
  it('stores school, era, type, and notable in history.state', async () => {
    render(<ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Change type to tosogu
    act(() => { capturedOnFilterChange!('type', 'tosogu'); });

    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    const stored = lastCall[0]._artistFilters;
    expect(stored.type).toBe('tosogu');
    // type switch clears school/province/era
    expect(stored.school).toBeUndefined();
    expect(stored.province).toBeUndefined();
    expect(stored.era).toBeUndefined();
  });

  // =========================================================================
  // GOLDEN TEST 3: On mount, restores from history.state (back-nav)
  // =========================================================================
  it('restores filters from history.state._artistFilters on mount', async () => {
    // Simulate back-nav: history.state has _artistFilters from a previous visit
    window.history.replaceState(
      { _artistFilters: ELITE_FILTERS },
      '',
      '/artists?sort=elite_factor'
    );

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    // The sidebar should reflect the restored sort, not initialFilters
    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('elite_factor');
    });

    // Fetch should have been called with the restored sort
    await waitFor(() => {
      const fetchUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toContain('sort=elite_factor');
    });
  });

  // =========================================================================
  // GOLDEN TEST 4: On mount without _artistFilters, uses initialFilters
  // =========================================================================
  it('uses initialFilters when history.state has no _artistFilters (fresh visit)', async () => {
    // Clean history state — no _artistFilters
    window.history.replaceState({}, '', '/artists');

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('total_items');
    });

    await waitFor(() => {
      const fetchUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toContain('sort=total_items');
    });
  });

  // =========================================================================
  // GOLDEN TEST 5: popstate event restores filters (back/forward without remount)
  // =========================================================================
  it('restores filters on popstate event with _artistFilters', async () => {
    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Simulate back-navigation: popstate fires with stored filters
    act(() => {
      const event = new PopStateEvent('popstate', {
        state: { _artistFilters: ELITE_FILTERS },
      });
      window.dispatchEvent(event);
    });

    // Component should sync to the restored filters
    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('elite_factor');
    });

    // Should fetch with restored sort
    await waitFor(() => {
      const lastFetchUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[0] as string;
      expect(lastFetchUrl).toContain('sort=elite_factor');
    });
  });

  // =========================================================================
  // GOLDEN TEST 6: popstate without _artistFilters is a no-op
  // =========================================================================
  it('does not crash or reset on popstate without _artistFilters', async () => {
    // Start with elite_factor via history.state
    window.history.replaceState(
      { _artistFilters: ELITE_FILTERS },
      '',
      '/artists?sort=elite_factor'
    );

    render(
      <ArtistsPageClient initialFilters={DEFAULT_FILTERS} initialPage={1} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-sort').textContent).toBe('elite_factor');
    });

    const fetchCountBefore = fetchMock.mock.calls.length;

    // popstate without _artistFilters (e.g., navigating to a non-artist page)
    act(() => {
      const event = new PopStateEvent('popstate', { state: {} });
      window.dispatchEvent(event);
    });

    // Should not change sort or trigger a new fetch
    expect(screen.getByTestId('current-sort').textContent).toBe('elite_factor');
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

    // replaceState should have been called (URL update), NOT router.replace
    // Verify it used History.prototype.replaceState (native), not Next.js router
    const searchReplaceCall = replaceStateSpy.mock.calls.find(
      (c: unknown[]) => String(c[2]).includes('q=masamune')
    );
    expect(searchReplaceCall).toBeDefined();

    // Verify _artistFilters includes the search query
    const stateArg = searchReplaceCall![0] as { _artistFilters: { q?: string } };
    expect(stateArg._artistFilters.q).toBe('masamune');
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
  // GOLDEN TEST 9: Default sort (total_items) omitted from URL
  // =========================================================================
  it('omits sort param from URL when set to default (total_items)', async () => {
    // Start with elite_factor
    window.history.replaceState(
      { _artistFilters: ELITE_FILTERS },
      '',
      '/artists?sort=elite_factor'
    );

    render(<ArtistsPageClient initialFilters={ELITE_FILTERS} initialPage={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Change back to default sort
    act(() => { capturedOnFilterChange!('sort', 'total_items'); });

    const calls = replaceStateSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    // URL should be bare /artists (no sort param for default)
    expect(lastCall[2]).toBe('/artists');
    // But history.state should still have the filters
    expect(lastCall[0]._artistFilters.sort).toBe('total_items');
  });
});
