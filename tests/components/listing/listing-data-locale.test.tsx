/**
 * Tests for listing data localization across ListingCard and QuickViewContent.
 *
 * ListingCard: locale-aware cleanedTitle source (title_en for EN, title for JA)
 * QuickViewContent: artisan kanji display for JA locale
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Locale mock (EN default) ----

let mockLocale = 'en';

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const ja = await import('@/i18n/locales/ja.json').then(m => m.default);
  return {
    useLocale: () => {
      const strings = mockLocale === 'ja' ? ja : en;
      const fallback = mockLocale !== 'en' ? en : null;
      const t = (key: string, params?: Record<string, string | number>) => {
        let value: string = (strings as Record<string, string>)[key]
          ?? (fallback as Record<string, string> | null)?.[key]
          ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return value;
      };
      return { locale: mockLocale, setLocale: () => {}, t };
    },
  };
});

// ---- ListingCard mocks ----

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="listing-image" {...props} />
  ),
}));

vi.mock('@/components/activity/ActivityProvider', () => ({
  useActivityOptional: () => null,
}));

vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => null,
}));

vi.mock('@/lib/viewport', () => ({
  useViewportTrackingOptional: () => null,
}));

vi.mock('@/hooks/useImagePreloader', () => ({
  useImagePreloader: () => ({
    preloadListing: () => {},
    cancelPreloads: () => {},
  }),
}));

vi.mock('@/lib/freshness', () => ({
  getMarketTimeDisplay: () => null,
}));

vi.mock('@/lib/images', () => ({
  getAllImages: (listing: { images?: string[] | null; stored_images?: string[] | null }) =>
    listing.stored_images?.length ? listing.stored_images : (listing.images || []),
  getCachedValidation: () => undefined,
  isRenderFailed: () => false,
  setRenderFailed: () => {},
  dealerDoesNotPublishImages: () => false,
  getPlaceholderKanji: (itemType: string | null) => itemType === 'tsuba' ? '鍔' : '刀',
}));

// ---- Import after mocks ----

import { ListingCard } from '@/components/browse/ListingCard';

// ---- Test data ----

const mockListing = {
  id: '1',
  url: 'https://example.com/listing/1',
  title: '備前国長船住祐定作',
  title_en: 'Bizen Osafune Sukesada',
  item_type: 'katana',
  price_value: 1500000,
  price_currency: 'JPY',
  smith: 'Sukesada',
  tosogu_maker: null,
  school: 'Osafune',
  tosogu_school: null,
  cert_type: 'Juyo',
  images: ['https://example.com/image1.jpg'],
  first_seen_at: '2024-01-01',
  dealer_earliest_seen_at: '2023-01-01',
  status: 'available',
  is_available: true,
  is_sold: false,
  dealer_id: 1,
  dealers: { id: 1, name: 'Aoi Art', domain: 'aoijapan.com' },
};

const defaultProps = {
  listing: mockListing,
  currency: 'JPY' as const,
  exchangeRates: null,
  priority: false,
};

describe('ListingCard locale-aware title', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EN locale', () => {
    beforeEach(() => {
      mockLocale = 'en';
    });

    it('uses title_en for cleanedTitle when available (shown when itemType is unknown)', () => {
      // cleanedTitle only displays as heading when itemType normalizes to empty
      const listing = {
        ...mockListing,
        item_type: 'unknown',
        title: '備前国長船住祐定作',
        title_en: 'Bizen Osafune Sukesada',
      };
      render(<ListingCard {...defaultProps} listing={listing} />);
      // The heading should show the English title, not the Japanese one
      expect(screen.getByText(/Bizen Osafune Sukesada/)).toBeInTheDocument();
    });

    it('falls back to original title when no title_en (unknown type)', () => {
      const listing = { ...mockListing, item_type: 'unknown', title_en: undefined, title: 'Katana by Sukesada' };
      render(<ListingCard {...defaultProps} listing={listing} />);
      // Title appears in heading and may also appear in artisan row
      expect(screen.getAllByText(/Sukesada/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('JA locale', () => {
    beforeEach(() => {
      mockLocale = 'ja';
    });

    it('uses original Japanese title for cleanedTitle (shown when itemType is unknown)', () => {
      // cleanedTitle only displays as heading when itemType normalizes to empty
      // For recognized types like 'katana', the heading shows itemType instead
      const listing = {
        ...mockListing,
        item_type: 'unknown',
        title: '備前国長船住祐定作',
        title_en: 'Bizen Osafune Sukesada',
      };
      render(<ListingCard {...defaultProps} listing={listing} />);
      // The heading should show the Japanese title, not the English one
      expect(screen.getByText(/備前国長船住祐定作/)).toBeInTheDocument();
    });

    it('EN title_en should not appear in heading when JA locale and unknown type', () => {
      const listing = {
        ...mockListing,
        item_type: 'unknown',
        title: '備前国長船住祐定作',
        title_en: 'Bizen Osafune Sukesada',
      };
      render(<ListingCard {...defaultProps} listing={listing} />);
      // Should show Japanese title, not English
      const allText = document.body.textContent || '';
      expect(allText).toContain('備前国長船住祐定作');
      expect(allText).not.toContain('Bizen Osafune Sukesada');
    });
  });
});

describe('ListingCard artisan display name locale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JA locale with artisan_name_kanji', () => {
    beforeEach(() => {
      mockLocale = 'ja';
    });

    it('shows kanji artisan name when locale is ja', () => {
      const listing = {
        ...mockListing,
        artisan_id: 'SUK001',
        artisan_display_name: 'Sukesada',
        artisan_name_kanji: '祐定',
        artisan_confidence: 'HIGH',
      };
      render(<ListingCard {...defaultProps} listing={listing} />);
      expect(screen.getByText('祐定')).toBeInTheDocument();
    });
  });

  describe('EN locale with artisan_name_kanji', () => {
    beforeEach(() => {
      mockLocale = 'en';
    });

    it('shows romaji artisan name when locale is en', () => {
      const listing = {
        ...mockListing,
        artisan_id: 'SUK001',
        artisan_display_name: 'Sukesada',
        artisan_name_kanji: '祐定',
        artisan_confidence: 'HIGH',
      };
      render(<ListingCard {...defaultProps} listing={listing} />);
      expect(screen.getByText('Sukesada')).toBeInTheDocument();
    });
  });
});
