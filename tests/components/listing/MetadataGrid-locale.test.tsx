/**
 * Tests for MetadataGrid locale-aware rendering.
 *
 * - getArtisanInfo(locale) integration in MetadataGrid component
 * - mei_type localization via td('meiType', ...)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Locale mock ----

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

import { MetadataGrid } from '@/components/listing/MetadataGrid';
import type { Listing } from '@/types';

function baseListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    title: 'Test Katana',
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

describe('MetadataGrid locale awareness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mei_type localization', () => {
    it('EN locale: shows "Signed" for mei_type "mei"', () => {
      mockLocale = 'en';
      const listing = baseListing({ mei_type: 'mei', smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('Signed')).toBeInTheDocument();
    });

    it('EN locale: shows "Unsigned" for mei_type "mumei"', () => {
      mockLocale = 'en';
      const listing = baseListing({ mei_type: 'mumei', smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('Unsigned')).toBeInTheDocument();
    });

    it('JA locale: shows "在銘" for mei_type "mei"', () => {
      mockLocale = 'ja';
      const listing = baseListing({ mei_type: 'mei', smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('在銘')).toBeInTheDocument();
    });

    it('JA locale: shows "無銘" for mei_type "mumei"', () => {
      mockLocale = 'ja';
      const listing = baseListing({ mei_type: 'mumei', smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('無銘')).toBeInTheDocument();
    });

    it('passes through unknown mei_type values unchanged', () => {
      mockLocale = 'en';
      const listing = baseListing({ mei_type: 'gimei', smith: 'Test', school: 'Test' });
      render(<MetadataGrid listing={listing} />);
      // No meiType.gimei key, so it falls through to raw value
      expect(screen.getByText('gimei')).toBeInTheDocument();
    });
  });

  describe('artisan display by locale', () => {
    it('EN locale: shows romanized smith name', () => {
      mockLocale = 'en';
      const listing = baseListing({ smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText(/Masamune/)).toBeInTheDocument();
    });

    it('EN locale: filters out Japanese smith name', () => {
      mockLocale = 'en';
      const listing = baseListing({ smith: '正宗', school: 'Soshu', title_en: undefined });
      render(<MetadataGrid listing={listing} />);
      // Japanese smith should be filtered out (no title_en to extract romaji)
      // Only school should show
      const smithSection = screen.queryByText('正宗');
      expect(smithSection).toBeNull();
    });

    it('JA locale: shows original Japanese smith name', () => {
      mockLocale = 'ja';
      const listing = baseListing({ smith: '正宗', school: '相州' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText(/正宗/)).toBeInTheDocument();
      expect(screen.getByText(/相州/)).toBeInTheDocument();
    });

    it('JA locale: shows Japanese school for tosogu', () => {
      mockLocale = 'ja';
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: '信家',
        tosogu_school: '京透',
      });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText(/信家/)).toBeInTheDocument();
      expect(screen.getByText(/京透/)).toBeInTheDocument();
    });
  });

  describe('metadata label localization', () => {
    it('EN locale: shows "Smith" label', () => {
      mockLocale = 'en';
      const listing = baseListing({ smith: 'Masamune', school: 'Soshu' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('Smith')).toBeInTheDocument();
    });

    it('JA locale: shows "刀工" label', () => {
      mockLocale = 'ja';
      const listing = baseListing({ smith: '正宗', school: '相州' });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('刀工')).toBeInTheDocument();
    });

    it('EN locale: shows "Maker" label for tosogu', () => {
      mockLocale = 'en';
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: 'Nobuie',
      });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('Maker')).toBeInTheDocument();
    });

    it('JA locale: shows "作者" label for tosogu', () => {
      mockLocale = 'ja';
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: '信家',
      });
      render(<MetadataGrid listing={listing} />);
      expect(screen.getByText('作者')).toBeInTheDocument();
    });
  });
});
