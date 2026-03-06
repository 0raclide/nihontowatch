/**
 * DealerIntelligence QuickView Panel Tests
 *
 * Tests the full intelligence panel in QuickView:
 * - Loading state shows skeleton
 * - All 4 sections render with data
 * - Inventory tab shows "Tracked when listed"
 * - Sold tab shows "Performance Summary"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DealerIntelligence } from '@/components/listing/quickview-slots/DealerIntelligence';

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: () => {},
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'dealer.intel.completeness': 'Completeness',
        'dealer.intel.feedPreview': 'Feed Preview',
        'dealer.intel.engagement30d': 'Engagement (30 days)',
        'dealer.intel.performance': 'Performance Summary',
        'dealer.intel.trackedWhenListed': 'Tracked when listed',
        'dealer.intel.estimatedScore': 'Estimated score when listed',
        'dealer.intel.views': 'Views',
        'dealer.intel.favorites': 'Favorites',
        'dealer.intel.clicks': 'Clicks',
        'dealer.intel.quality': 'Quality',
        'dealer.intel.freshness': 'Freshness',
        'dealer.intel.hot': 'Hot',
        'dealer.intel.warm': 'Active',
        'dealer.intel.cool': 'Quiet',
        'dealer.intel.top10': 'Top 10%',
        'dealer.intel.top25': 'Top 25%',
        'dealer.intel.top50': 'Top 50%',
        'dealer.intel.below': 'Below average',
        'dealer.intel.images': 'Photos',
        'dealer.intel.price': 'Price',
        'dealer.intel.attribution': 'Attribution',
        'dealer.intel.measurements': 'Measurements',
        'dealer.intel.description': 'Description',
        'dealer.intel.cert': 'Certification',
        'dealer.intel.tipImages': 'Add photos for better visibility',
        'dealer.intel.tipPrice': 'Add a price',
        'dealer.intel.tipAttribution': 'Add attribution',
        'dealer.intel.tipMeasurements': 'Add measurements',
        'dealer.intel.tipDescription': 'Add a description',
        'dealer.intel.tipCert': 'Add certification',
        'dealer.intel.interested': `${params?.count ?? 0} collectors interested`,
      };
      return map[key] || key;
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockIntelligenceResponse = {
  listings: {
    123: {
      completeness: {
        score: 4,
        total: 6,
        items: [
          { key: 'images', filled: true, tipKey: 'dealer.intel.tipImages', labelKey: 'dealer.intel.images' },
          { key: 'price', filled: true, tipKey: 'dealer.intel.tipPrice', labelKey: 'dealer.intel.price' },
          { key: 'attribution', filled: true, tipKey: 'dealer.intel.tipAttribution', labelKey: 'dealer.intel.attribution' },
          { key: 'measurements', filled: false, tipKey: 'dealer.intel.tipMeasurements', labelKey: 'dealer.intel.measurements' },
          { key: 'description', filled: true, tipKey: 'dealer.intel.tipDescription', labelKey: 'dealer.intel.description' },
          { key: 'certification', filled: false, tipKey: 'dealer.intel.tipCert', labelKey: 'dealer.intel.cert' },
        ],
      },
      scorePreview: {
        quality: 85,
        freshness: 1.2,
        estimatedScore: 102,
        rankBucket: 'top25',
      },
      engagement: {
        views: 42,
        favorites: 3,
        clicks: 7,
        quickviews: 15,
        heatScore: 52,
        heatTrend: 'hot',
      },
      interestedCollectors: 5,
    },
  },
  percentiles: { p10: 200, p25: 100, p50: 50 },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('DealerIntelligence', () => {
  it('shows loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<DealerIntelligence listingId={123} tab="available" />);
    expect(screen.getByTestId('dealer-intelligence-skeleton')).toBeTruthy();
  });

  it('renders all 4 sections with data for available tab', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntelligenceResponse),
    });

    render(<DealerIntelligence listingId={123} tab="available" />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-intelligence')).toBeTruthy();
    });

    // Section 1: Completeness
    expect(screen.getByText('Completeness')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByText('Add measurements')).toBeTruthy(); // tip for unfilled

    // Section 2: Feed Preview
    expect(screen.getByText('Feed Preview')).toBeTruthy();
    expect(screen.getByText('Top 25%')).toBeTruthy();

    // Section 3: Engagement
    expect(screen.getByText('Engagement (30 days)')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy(); // views
    expect(screen.getByText('3')).toBeTruthy();  // favorites
    expect(screen.getByText('7')).toBeTruthy();  // clicks

    // Section 4: Interested collectors
    expect(screen.getByText('5 collectors interested')).toBeTruthy();
  });

  it('shows "Tracked when listed" for inventory tab', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        listings: {
          456: {
            ...mockIntelligenceResponse.listings[123],
            engagement: null,
            interestedCollectors: 2,
          },
        },
        percentiles: { p10: 200, p25: 100, p50: 50 },
      }),
    });

    render(<DealerIntelligence listingId={456} tab="inventory" />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-intelligence')).toBeTruthy();
    });

    expect(screen.getByText('Tracked when listed')).toBeTruthy();
    expect(screen.getByText('Estimated score when listed')).toBeTruthy();
  });

  it('shows "Performance Summary" for sold tab', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntelligenceResponse),
    });

    render(<DealerIntelligence listingId={123} tab="sold" />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-intelligence')).toBeTruthy();
    });

    expect(screen.getByText('Performance Summary')).toBeTruthy();
    // Interested collectors hidden for sold
    expect(screen.queryByText('5 collectors interested')).toBeNull();
  });

  it('renders nothing when API fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { container } = render(<DealerIntelligence listingId={999} tab="available" />);

    await waitFor(() => {
      expect(screen.queryByTestId('dealer-intelligence-skeleton')).toBeNull();
    });

    expect(screen.queryByTestId('dealer-intelligence')).toBeNull();
  });

  it('calls API with correct listing ID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: {}, percentiles: { p10: 0, p25: 0, p50: 0 } }),
    });

    render(<DealerIntelligence listingId={789} tab="available" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/dealer/listings/intelligence?listingIds=789');
    });
  });
});
