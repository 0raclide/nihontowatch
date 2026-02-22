/**
 * Tests for getArtisanInfo() locale awareness.
 *
 * When locale=ja, Japanese names (kanji) should be returned directly.
 * When locale=en, Japanese names should be filtered/romanized via title_en.
 */
import { describe, it, expect } from 'vitest';
import { getArtisanInfo } from '@/components/listing/MetadataGrid';
import type { Listing } from '@/types';

// Helper to create a minimal listing
function baseListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    title: 'テスト刀',
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

describe('getArtisanInfo locale awareness', () => {
  describe('sword (blade) listings', () => {
    it('EN locale: filters out Japanese smith name when no title_en', () => {
      const listing = baseListing({ smith: '正宗', school: 'Soshu' });
      const result = getArtisanInfo(listing, 'en');
      // Japanese smith should be filtered out (no romanization available)
      expect(result.artisan).toBeNull();
      expect(result.school).toBe('Soshu');
    });

    it('EN locale: extracts romanized name from title_en', () => {
      const listing = baseListing({
        smith: '正宗',
        school: 'Soshu',
        title_en: 'Katana: Soshu Masamune',
      });
      const result = getArtisanInfo(listing, 'en');
      expect(result.artisan).toBe('Masamune');
      expect(result.school).toBe('Soshu');
    });

    it('EN locale: returns romanized smith directly when not Japanese', () => {
      const listing = baseListing({ smith: 'Masamune', school: 'Soshu' });
      const result = getArtisanInfo(listing, 'en');
      expect(result.artisan).toBe('Masamune');
      expect(result.school).toBe('Soshu');
    });

    it('EN locale: filters out Japanese school name', () => {
      const listing = baseListing({ smith: 'Masamune', school: '相州' });
      const result = getArtisanInfo(listing, 'en');
      expect(result.school).toBeNull();
    });

    it('JA locale: returns original Japanese smith name', () => {
      const listing = baseListing({ smith: '正宗', school: '相州' });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('正宗');
      expect(result.school).toBe('相州');
    });

    it('JA locale: returns kanji school directly', () => {
      const listing = baseListing({ smith: '国光', school: '来' });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('国光');
      expect(result.school).toBe('来');
    });

    it('JA locale: returns romanized names as-is when no kanji', () => {
      const listing = baseListing({ smith: 'Masamune', school: 'Soshu' });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('Masamune');
      expect(result.school).toBe('Soshu');
    });

    it('JA locale: does not strip school from concatenated kanji (no space separator)', () => {
      // stripSchoolPrefix uses space separator — Japanese names like '来国光' are concatenated
      const listing = baseListing({ smith: '来国光', school: '来' });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('来国光');
      expect(result.school).toBe('来');
    });

    it('JA locale: strips school prefix when space-separated', () => {
      const listing = baseListing({ smith: 'Rai Kunitoshi', school: 'Rai' });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('Kunitoshi');
      expect(result.school).toBe('Rai');
    });
  });

  describe('tosogu (fitting) listings', () => {
    it('EN locale: filters out Japanese maker name when no title_en', () => {
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: '信家',
        tosogu_school: null,
      });
      const result = getArtisanInfo(listing, 'en');
      expect(result.artisan).toBeNull();
      expect(result.artisanLabel).toBe('Maker');
    });

    it('EN locale: extracts romanized maker from title_en', () => {
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: '信家',
        tosogu_school: null,
        title_en: 'Tsuba: Nobuie',
      });
      const result = getArtisanInfo(listing, 'en');
      expect(result.artisan).toBe('Nobuie');
    });

    it('JA locale: returns original Japanese maker name', () => {
      const listing = baseListing({
        item_type: 'tsuba',
        tosogu_maker: '信家',
        tosogu_school: '京透',
      });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.artisan).toBe('信家');
      expect(result.school).toBe('京透');
      expect(result.artisanLabel).toBe('Maker');
    });

    it('JA locale: returns Japanese school for tosogu', () => {
      const listing = baseListing({
        item_type: 'fuchi_kashira',
        tosogu_maker: '後藤',
        tosogu_school: '後藤',
      });
      const result = getArtisanInfo(listing, 'ja');
      expect(result.school).toBe('後藤');
    });
  });

  describe('default locale parameter', () => {
    it('defaults to en when no locale provided', () => {
      const listing = baseListing({ smith: '正宗', school: '相州' });
      const result = getArtisanInfo(listing);
      // Should behave like EN — filter out Japanese names
      expect(result.artisan).toBeNull();
      expect(result.school).toBeNull();
    });
  });

  describe('artisan label', () => {
    it('returns Smith for blade types', () => {
      const listing = baseListing({ item_type: 'katana', smith: 'Test' });
      expect(getArtisanInfo(listing, 'en').artisanLabel).toBe('Smith');
      expect(getArtisanInfo(listing, 'ja').artisanLabel).toBe('Smith');
    });

    it('returns Maker for tosogu types', () => {
      const listing = baseListing({ item_type: 'tsuba', tosogu_maker: 'Test' });
      expect(getArtisanInfo(listing, 'en').artisanLabel).toBe('Maker');
      expect(getArtisanInfo(listing, 'ja').artisanLabel).toBe('Maker');
    });
  });
});
