/**
 * Tests for TranslatedDescription locale-aware rendering.
 *
 * JA locale: Shows original Japanese description first, toggle label = "翻訳を表示".
 * EN locale: Shows English translation first, toggle label = "Show original".
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslatedDescription } from '@/components/listing/TranslatedDescription';
import type { Listing } from '@/types';

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

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// ---- Helpers ----

function baseListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    title: 'Test Listing',
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

describe('TranslatedDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('EN locale', () => {
    beforeEach(() => {
      mockLocale = 'en';
    });

    it('shows English translation when description_en exists', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作で、室町時代後期の作品です。',
        description_en: 'This katana was made by Sukesada of Bizen Osafune during the late Muromachi period.',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText(/This katana was made by Sukesada/)).toBeInTheDocument();
    });

    it('shows "Show original" toggle when translation and original differ', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: 'This katana was made by Sukesada.',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText('Show original')).toBeInTheDocument();
    });

    it('clicking "Show original" reveals Japanese text', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: 'This katana was made by Sukesada.',
      });
      render(<TranslatedDescription listing={listing} />);

      fireEvent.click(screen.getByText('Show original'));
      expect(screen.getByText('本刀は備前国長船住祐定の作です。')).toBeInTheDocument();
      expect(screen.getByText('Show translation')).toBeInTheDocument();
    });

    it('shows "Description" header in English', () => {
      const listing = baseListing({ description: 'Some description' });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('returns null when no description', () => {
      const listing = baseListing({ description: undefined });
      const { container } = render(<TranslatedDescription listing={listing} />);
      expect(container.innerHTML).toBe('');
    });

    it('fetches translation for Japanese description without cached translation', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ translation: 'Translated text' }),
      });
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: undefined,
      });
      render(<TranslatedDescription listing={listing} />);
      expect(mockFetch).toHaveBeenCalledWith('/api/translate', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  describe('JA locale', () => {
    beforeEach(() => {
      mockLocale = 'ja';
    });

    it('shows original Japanese description first', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: 'This katana was made by Sukesada.',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText('本刀は備前国長船住祐定の作です。')).toBeInTheDocument();
    });

    it('shows "翻訳を表示" toggle (not "Show original")', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: 'This katana was made by Sukesada.',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText('翻訳を表示')).toBeInTheDocument();
    });

    it('clicking "翻訳を表示" shows English translation', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: 'This katana was made by Sukesada.',
      });
      render(<TranslatedDescription listing={listing} />);

      fireEvent.click(screen.getByText('翻訳を表示'));
      expect(screen.getByText(/This katana was made by Sukesada/)).toBeInTheDocument();
      expect(screen.getByText('原文を表示')).toBeInTheDocument();
    });

    it('shows "説明" header in Japanese', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(screen.getByText('説明')).toBeInTheDocument();
    });

    it('does not fetch translation', () => {
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: undefined,
      });
      render(<TranslatedDescription listing={listing} />);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches EN→JP translation for English description without cached description_ja', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ translation: 'ビゼンの優れた作例。' }),
      });
      const listing = baseListing({
        description: 'A fine example of Bizen workmanship.',
      });
      render(<TranslatedDescription listing={listing} />);
      expect(mockFetch).toHaveBeenCalledWith('/api/translate', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('shows cached description_ja immediately without fetch', () => {
      const listing = baseListing({
        description: 'A fine example of Bizen workmanship.',
        description_ja: 'ビゼンの優れた作例。',
      });
      render(<TranslatedDescription listing={listing} />);
      // JA locale + EN-source → shows JP translation by default (not the English original)
      expect(screen.getByText('ビゼンの優れた作例。')).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('error state localization', () => {
    beforeEach(() => {
      mockLocale = 'en';
    });

    it('shows localized "(Translation unavailable)" on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const listing = baseListing({
        description: '本刀は備前国長船住祐定の作です。',
        description_en: undefined,
      });
      render(<TranslatedDescription listing={listing} />);

      // Wait for fetch to fail
      await vi.waitFor(() => {
        expect(screen.getByText('(Translation unavailable)')).toBeInTheDocument();
      });
    });
  });
});
