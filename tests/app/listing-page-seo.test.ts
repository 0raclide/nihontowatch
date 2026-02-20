/**
 * SEO tests for the listing detail page /listing/[id]
 *
 * Critical behaviors tested:
 * 1. Missing listings return proper HTTP 404 (not soft 404)
 * 2. Sold items get noindex meta tag
 * 3. Available items get index: true
 * 4. Share proxy /s/[id] gets noindex to prevent duplicate content
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: vi.fn(() => mockSupabaseClient),
}));

describe('Listing Page SEO Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notFound() for missing listings', () => {
    it('should call notFound() when listing does not exist', async () => {
      const { notFound } = await import('next/navigation');

      // Mock Supabase to return no data
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      // Import the page component
      const { default: ListingPage } = await import(
        '@/app/listing/[id]/page'
      );

      // Call the page with a non-existent listing ID
      await expect(
        ListingPage({ params: Promise.resolve({ id: '99999999' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(notFound).toHaveBeenCalled();
    });

    it('should call notFound() for invalid listing ID format', async () => {
      const { notFound } = await import('next/navigation');

      // Import the page component
      const { default: ListingPage } = await import(
        '@/app/listing/[id]/page'
      );

      // Call with invalid ID
      await expect(
        ListingPage({ params: Promise.resolve({ id: 'invalid-id' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(notFound).toHaveBeenCalled();
    });
  });

  describe('robots meta tag — all listings indexed (sold archive)', () => {
    it('should set index: true for sold items (archive SEO equity)', async () => {
      // Mock a sold listing
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 123,
                title: 'Test Katana',
                price_value: 1000000,
                price_currency: 'JPY',
                item_type: 'katana',
                cert_type: 'Juyo',
                smith: 'Masamune',
                tosogu_maker: null,
                og_image_url: null,
                is_sold: true,
                is_available: false,
                dealers: { name: 'Test Dealer', domain: 'test.com' },
              },
              error: null,
            }),
          }),
        }),
      });

      const { generateMetadata } = await import('@/app/listing/[id]/page');

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '123' }),
      });

      expect(metadata.robots).toEqual({ index: true, follow: true });
    });

    it('should set index: true for unavailable items (archive SEO equity)', async () => {
      // Mock an unavailable listing
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 124,
                title: 'Test Wakizashi',
                price_value: 500000,
                price_currency: 'JPY',
                item_type: 'wakizashi',
                cert_type: null,
                smith: null,
                tosogu_maker: null,
                og_image_url: null,
                is_sold: false,
                is_available: false, // Not available
                dealers: { name: 'Test Dealer', domain: 'test.com' },
              },
              error: null,
            }),
          }),
        }),
      });

      const { generateMetadata } = await import('@/app/listing/[id]/page');

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '124' }),
      });

      expect(metadata.robots).toEqual({ index: true, follow: true });
    });

    it('should set index: true for available items', async () => {
      // Mock an available listing
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 125,
                title: 'Available Tanto',
                price_value: 300000,
                price_currency: 'JPY',
                item_type: 'tanto',
                cert_type: 'Hozon',
                smith: 'Sukesada',
                tosogu_maker: null,
                og_image_url: null,
                is_sold: false,
                is_available: true, // Available
                dealers: { name: 'Good Dealer', domain: 'good.com' },
              },
              error: null,
            }),
          }),
        }),
      });

      const { generateMetadata } = await import('@/app/listing/[id]/page');

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '125' }),
      });

      expect(metadata.robots).toEqual({ index: true, follow: true });
    });
  });

  describe('metadata description for sold items', () => {
    it('should say "Previously listed" for sold items instead of "Available"', async () => {
      // Mock a sold listing
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 126,
                title: 'Sold Katana',
                price_value: 2000000,
                price_currency: 'JPY',
                item_type: 'katana',
                cert_type: 'Tokubetsu Juyo',
                smith: 'Famous Smith',
                tosogu_maker: null,
                og_image_url: null,
                is_sold: true,
                is_available: false,
                dealers: { name: 'Premium Dealer', domain: 'premium.com' },
              },
              error: null,
            }),
          }),
        }),
      });

      const { generateMetadata } = await import('@/app/listing/[id]/page');

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '126' }),
      });

      expect(metadata.description).toContain('Previously listed');
      expect(metadata.description).not.toContain('Available from');
    });

    it('should say "Available from" for available items', async () => {
      // Mock an available listing
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 127,
                title: 'For Sale Katana',
                price_value: 1500000,
                price_currency: 'JPY',
                item_type: 'katana',
                cert_type: 'Juyo',
                smith: 'Another Smith',
                tosogu_maker: null,
                og_image_url: null,
                is_sold: false,
                is_available: true,
                dealers: { name: 'Active Dealer', domain: 'active.com' },
              },
              error: null,
            }),
          }),
        }),
      });

      const { generateMetadata } = await import('@/app/listing/[id]/page');

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '127' }),
      });

      expect(metadata.description).toContain('Available from');
      expect(metadata.description).not.toContain('Previously listed');
    });
  });
});

describe('Share Proxy SEO - noindex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have noindex to prevent duplicate content with /listing/[id]', async () => {
    // Mock a listing for the share proxy
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 128,
              title: 'Shared Katana',
              title_en: 'Shared Katana EN',
              price_value: 1000000,
              price_currency: 'JPY',
              item_type: 'katana',
              cert_type: 'Juyo',
              smith: 'Smith Name',
              tosogu_maker: null,
              og_image_url: 'https://example.com/og.png',
              dealers: { name: 'Dealer Name', domain: 'dealer.com' },
            },
            error: null,
          }),
        }),
      }),
    });

    const { generateMetadata } = await import('@/app/s/[id]/page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '128' }),
      searchParams: Promise.resolve({ v: 'abc123' }),
    });

    // Share proxy should have noindex to prevent duplicate content
    expect(metadata.robots).toEqual({ index: false, follow: true });

    // But should still have canonical pointing to the real listing
    expect(metadata.alternates?.canonical).toContain('/listing/128');
  });
});
