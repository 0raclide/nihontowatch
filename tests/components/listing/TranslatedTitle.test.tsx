/**
 * Tests for TranslatedTitle locale-aware rendering.
 *
 * JA locale: Shows original title, skips auto-translate.
 * EN locale: Shows title_en if cached, fetches translation for Japanese titles.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranslatedTitle } from '@/components/listing/TranslatedTitle';
import type { Listing } from '@/types';

// ---- Mocks ----

// Will be overridden per describe block
let mockLocale = 'en';
let mockT = (key: string) => key;

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({ locale: mockLocale, setLocale: () => {}, t: mockT }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// ---- Helpers ----

function baseListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    title: '備前国長船住祐定作',
    item_type: 'katana',
    price_currency: 'JPY',
    images: [],
    first_seen_at: '2026-01-01',
    last_scraped_at: '2026-01-01',
    scrape_count: 1,
    status: 'available',
    is_available: true,
    is_sold: false,
    page_exists: true,
    dealer_id: 1,
    ...overrides,
  };
}

describe('TranslatedTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('EN locale', () => {
    beforeEach(() => {
      mockLocale = 'en';
      mockT = (key: string) => {
        if (key === 'listing.untitled') return 'Untitled';
        return key;
      };
    });

    it('shows title_en when available', () => {
      const listing = baseListing({
        title: '備前国長船住祐定作',
        title_en: 'Katana: Bizen Osafune Sukesada',
      });
      render(<TranslatedTitle listing={listing} />);
      expect(screen.getByRole('heading')).toHaveTextContent('Katana: Bizen Osafune Sukesada');
    });

    it('shows original title when no title_en and no Japanese', () => {
      const listing = baseListing({ title: 'Fine Katana', title_en: undefined });
      render(<TranslatedTitle listing={listing} />);
      expect(screen.getByRole('heading')).toHaveTextContent('Fine Katana');
    });

    it('fetches translation for Japanese title without cached translation', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ translation: 'Translated Title' }),
      });

      const listing = baseListing({ title: '備前国長船住祐定作', title_en: undefined });
      render(<TranslatedTitle listing={listing} />);

      // Should have called fetch for translation
      expect(mockFetch).toHaveBeenCalledWith('/api/translate', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('does not fetch translation when title_en exists', () => {
      const listing = baseListing({
        title: '備前国長船住祐定作',
        title_en: 'Katana: Bizen Osafune Sukesada',
      });
      render(<TranslatedTitle listing={listing} />);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null when no title', () => {
      const listing = baseListing({ title: '' });
      const { container } = render(<TranslatedTitle listing={listing} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('JA locale', () => {
    beforeEach(() => {
      mockLocale = 'ja';
      mockT = (key: string) => {
        if (key === 'listing.untitled') return '無題';
        return key;
      };
    });

    it('shows original Japanese title, not title_en', () => {
      const listing = baseListing({
        title: '備前国長船住祐定作',
        title_en: 'Katana: Bizen Osafune Sukesada',
      });
      render(<TranslatedTitle listing={listing} />);
      expect(screen.getByRole('heading')).toHaveTextContent('備前国長船住祐定作');
    });

    it('does not fetch translation', () => {
      const listing = baseListing({
        title: '備前国長船住祐定作',
        title_en: undefined,
      });
      render(<TranslatedTitle listing={listing} />);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('shows original English title when title has no Japanese', () => {
      const listing = baseListing({ title: 'Fine Katana by Sukesada' });
      render(<TranslatedTitle listing={listing} />);
      expect(screen.getByRole('heading')).toHaveTextContent('Fine Katana by Sukesada');
    });

    it('shows untitled label in Japanese when no title', () => {
      const listing = baseListing({ title: null as any });
      const { container } = render(<TranslatedTitle listing={listing} />);
      // Returns null when no title
      expect(container.innerHTML).toBe('');
    });
  });
});
