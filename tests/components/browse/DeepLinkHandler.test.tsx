import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { DeepLinkHandler } from '@/components/browse/DeepLinkHandler';

// Track QuickView calls
const mockOpenQuickView = vi.fn();
const mockSetListings = vi.fn();

// Control searchParams per test
let mockSearchParamValues: Record<string, string | null> = {};

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamValues[key] ?? null,
  }),
}));

vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => ({
    openQuickView: mockOpenQuickView,
    setListings: mockSetListings,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createApiResponse(id: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        listing: {
          id,
          title: `Listing ${id}`,
          dealers: { id: 1, name: 'Test Dealer', domain: 'test.com' },
        },
      }),
  };
}

describe('DeepLinkHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamValues = {};
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('single listing (?listing=)', () => {
    it('fetches and opens a single listing', async () => {
      mockSearchParamValues = { listing: '123' };
      mockFetch.mockResolvedValueOnce(createApiResponse(123));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/listing/123');
        expect(mockOpenQuickView).toHaveBeenCalledTimes(1);
      });

      const listing = mockOpenQuickView.mock.calls[0][0];
      expect(listing.id).toBe(123);
      // Verify dealer mapping (plural → singular)
      expect(listing.dealer).toEqual({ id: 1, name: 'Test Dealer', domain: 'test.com' });
    });

    it('does nothing for non-numeric listing param', () => {
      mockSearchParamValues = { listing: 'abc' };
      render(<DeepLinkHandler />);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch failure gracefully', async () => {
      mockSearchParamValues = { listing: '999' };
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      expect(mockOpenQuickView).not.toHaveBeenCalled();
    });
  });

  describe('multi-listing (?listings=)', () => {
    it('fetches all listings in parallel and opens carousel', async () => {
      mockSearchParamValues = { listings: '100,200,300' };
      mockFetch
        .mockResolvedValueOnce(createApiResponse(100))
        .mockResolvedValueOnce(createApiResponse(200))
        .mockResolvedValueOnce(createApiResponse(300));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockSetListings).toHaveBeenCalledTimes(1);
        expect(mockOpenQuickView).toHaveBeenCalledTimes(1);
      });

      // setListings receives all 3 listings
      const listings = mockSetListings.mock.calls[0][0];
      expect(listings).toHaveLength(3);
      expect(listings[0].id).toBe(100);
      expect(listings[1].id).toBe(200);
      expect(listings[2].id).toBe(300);

      // openQuickView is called with the first listing
      expect(mockOpenQuickView.mock.calls[0][0].id).toBe(100);
    });

    it('takes priority over singular ?listing= param', async () => {
      mockSearchParamValues = { listing: '999', listings: '100' };
      mockFetch.mockResolvedValueOnce(createApiResponse(100));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/listing/100');
        expect(mockSetListings).toHaveBeenCalled();
      });

      // Should NOT fetch the singular listing
      expect(mockFetch).not.toHaveBeenCalledWith('/api/listing/999');
    });

    it('filters out failed fetches (deleted listings)', async () => {
      mockSearchParamValues = { listings: '100,404,200' };
      mockFetch
        .mockResolvedValueOnce(createApiResponse(100))
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce(createApiResponse(200));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockSetListings).toHaveBeenCalled();
      });

      const listings = mockSetListings.mock.calls[0][0];
      expect(listings).toHaveLength(2);
      expect(listings[0].id).toBe(100);
      expect(listings[1].id).toBe(200);
    });

    it('does not open QuickView when all fetches fail', async () => {
      mockSearchParamValues = { listings: '404,405' };
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      // Small delay to ensure the async function has completed
      await new Promise((r) => setTimeout(r, 50));
      expect(mockOpenQuickView).not.toHaveBeenCalled();
      expect(mockSetListings).not.toHaveBeenCalled();
    });

    it('stores alert context in sessionStorage when alert_search present', async () => {
      mockSearchParamValues = { listings: '100', alert_search: 'Juyo Katana' };
      mockFetch.mockResolvedValueOnce(createApiResponse(100));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockOpenQuickView).toHaveBeenCalled();
      });

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'quickview_alert_context',
        JSON.stringify({ searchName: 'Juyo Katana', totalMatches: 1 })
      );
    });

    it('does not store alert context when alert_search absent', async () => {
      mockSearchParamValues = { listings: '100' };
      mockFetch.mockResolvedValueOnce(createApiResponse(100));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockOpenQuickView).toHaveBeenCalled();
      });

      expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('ignores non-numeric IDs in the list', async () => {
      mockSearchParamValues = { listings: '100,abc,200' };
      mockFetch
        .mockResolvedValueOnce(createApiResponse(100))
        .mockResolvedValueOnce(createApiResponse(200));

      render(<DeepLinkHandler />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/listing/100');
      expect(mockFetch).toHaveBeenCalledWith('/api/listing/200');
    });

    it('handles empty listings param gracefully', () => {
      mockSearchParamValues = { listings: '' };
      render(<DeepLinkHandler />);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it('renders nothing (null)', () => {
    const { container } = render(<DeepLinkHandler />);
    expect(container.innerHTML).toBe('');
  });
});
