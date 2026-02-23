/**
 * MobileSearchSheet Component Tests
 *
 * Tests the mobile search sheet component functionality including:
 * - Search submission and navigation
 * - Quick search button clicks
 * - Activity tracking for search events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileSearchSheet } from '@/components/layout/MobileSearchSheet';
import { MobileUIProvider } from '@/contexts/MobileUIContext';

// Mock router with trackable push
const mockPush = vi.fn();
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
    getAll: () => [],
    has: () => false,
    keys: () => [],
    values: () => [],
    entries: () => [],
    toString: () => '',
  }),
  usePathname: () => mockPathname,
}));

// Mock activity tracker
const mockTrackSearch = vi.fn();
vi.mock('@/components/activity/ActivityProvider', () => ({
  useActivityOptional: () => ({
    trackSearch: mockTrackSearch,
    trackFilterChange: vi.fn(),
    trackPageView: vi.fn(),
    trackListingView: vi.fn(),
    trackFavoriteAction: vi.fn(),
    trackAlertAction: vi.fn(),
    trackExternalLinkClick: vi.fn(),
  }),
}));

// Mock the Drawer component
vi.mock('@/components/ui/Drawer', () => ({
  Drawer: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="drawer">{children}</div> : null,
}));

// Mock useLocale for i18n
vi.mock('@/i18n/LocaleContext', async () => {
  const strings = await import('@/i18n/locales/en.json').then(m => m.default);
  const t = (key: string) => (strings as Record<string, string>)[key] ?? key;
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock MobileUIContext to control drawer state
const mockCloseSearch = vi.fn();
vi.mock('@/contexts/MobileUIContext', async () => {
  const actual = await vi.importActual('@/contexts/MobileUIContext');
  return {
    ...actual,
    useMobileUI: () => ({
      searchOpen: true, // Always open for testing
      closeSearch: mockCloseSearch,
      openSearch: vi.fn(),
      openNavDrawer: vi.fn(),
      filterDrawerOpen: false,
      navDrawerOpen: false,
    }),
  };
});

describe('MobileSearchSheet Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockTrackSearch.mockClear();
    mockCloseSearch.mockClear();
    mockPathname = '/';
  });

  describe('Search Form Submission', () => {
    it('tracks search event when form is submitted', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'katana' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      // Should track the search
      expect(mockTrackSearch).toHaveBeenCalledTimes(1);
      expect(mockTrackSearch).toHaveBeenCalledWith('katana');
    });

    it('navigates to search results on submit', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'wakizashi' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockPush).toHaveBeenCalledWith('/?q=wakizashi');
    });

    it('closes the search sheet after submit', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'tanto' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockCloseSearch).toHaveBeenCalled();
    });

    it('does not track or navigate on empty search', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockTrackSearch).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('trims whitespace from search query before tracking', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: '  tsuba  ' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockTrackSearch).toHaveBeenCalledWith('tsuba');
      expect(mockPush).toHaveBeenCalledWith('/?q=tsuba');
    });
  });

  describe('Quick Search Buttons', () => {
    it('tracks search event when quick search is clicked', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      // Find and click a quick search button
      const katanaButton = screen.getByRole('button', { name: 'Katana' });
      fireEvent.click(katanaButton);

      expect(mockTrackSearch).toHaveBeenCalledTimes(1);
      expect(mockTrackSearch).toHaveBeenCalledWith('Katana');
    });

    it('navigates on quick search click', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const wakizashiButton = screen.getByRole('button', { name: 'Wakizashi' });
      fireEvent.click(wakizashiButton);

      expect(mockPush).toHaveBeenCalledWith('/?q=Wakizashi');
    });

    it('closes the sheet on quick search click', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const tantoButton = screen.getByRole('button', { name: 'Tanto' });
      fireEvent.click(tantoButton);

      expect(mockCloseSearch).toHaveBeenCalled();
    });

    it('tracks different quick search terms correctly', () => {
      const { unmount } = render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      // Test first quick search button
      const juyo = screen.getByRole('button', { name: 'Juyo' });
      fireEvent.click(juyo);
      expect(mockTrackSearch).toHaveBeenCalledWith('Juyo');

      // Unmount and remount to test another button
      unmount();
      mockTrackSearch.mockClear();

      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const tsuba = screen.getByRole('button', { name: 'Tsuba' });
      fireEvent.click(tsuba);
      expect(mockTrackSearch).toHaveBeenCalledWith('Tsuba');
    });
  });

  describe('Activity Tracker Resilience', () => {
    it('still navigates when activity tracker is null', () => {
      // Override the mock to return null
      vi.doMock('@/components/activity/ActivityProvider', () => ({
        useActivityOptional: () => null,
      }));

      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'yari' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      // Should still navigate even without tracker
      expect(mockPush).toHaveBeenCalledWith('/?q=yari');
    });
  });

  describe('UI Elements', () => {
    it('renders search input', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search swords, smiths, dealers/i)).toBeInTheDocument();
    });

    it('renders quick search buttons', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      // Check for expected quick search terms
      expect(screen.getByRole('button', { name: 'Katana' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Wakizashi' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tanto' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tsuba' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Juyo' })).toBeInTheDocument();
    });

    it('renders search tips section', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByText('Search Tips')).toBeInTheDocument();
    });

    it('has clear button that clears input', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      // Clear button should appear
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Artist Page Context', () => {
    beforeEach(() => {
      mockPathname = '/artists';
    });

    it('shows artist placeholder on /artists', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search artists by name, kanji, or code/i)).toBeInTheDocument();
    });

    it('shows artist placeholder on /artists/[slug]', () => {
      mockPathname = '/artists/masamune-MAS590';
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search artists by name, kanji, or code/i)).toBeInTheDocument();
    });

    it('navigates to /artists?q= on form submit', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search artists by name, kanji, or code/i);
      fireEvent.change(searchInput, { target: { value: 'Soshu' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockPush).toHaveBeenCalledWith('/artists?q=Soshu');
    });

    it('navigates to /artists?q= on quick search click', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const masamuneButton = screen.getByRole('button', { name: 'Masamune' });
      fireEvent.click(masamuneButton);

      expect(mockPush).toHaveBeenCalledWith('/artists?q=Masamune');
    });

    it('shows artist quick searches instead of listing quick searches', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      // Artist terms should be present
      expect(screen.getByRole('button', { name: 'Masamune' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Muramasa' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Soshu' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bizen' })).toBeInTheDocument();

      // Listing terms should NOT be present
      expect(screen.queryByRole('button', { name: 'Katana' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Wakizashi' })).not.toBeInTheDocument();
    });

    it('shows "Popular Artists" heading instead of "Popular Searches"', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByText('Popular Artists')).toBeInTheDocument();
      expect(screen.queryByText('Popular Searches')).not.toBeInTheDocument();
    });

    it('shows artist search tips', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      expect(screen.getByText(/by name/i)).toBeInTheDocument();
      expect(screen.getByText(/by school/i)).toBeInTheDocument();
      expect(screen.getByText(/by code/i)).toBeInTheDocument();
    });

    it('form action is /artists on artist pages', () => {
      render(
        <MobileUIProvider>
          <MobileSearchSheet />
        </MobileUIProvider>
      );

      const form = screen.getByRole('search');
      expect(form).toHaveAttribute('action', '/artists');
    });
  });
});
