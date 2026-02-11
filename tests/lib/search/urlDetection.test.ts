import { describe, it, expect } from 'vitest';
import { detectUrlQuery } from '@/lib/search/urlDetection';

describe('detectUrlQuery', () => {
  describe('detects valid URLs', () => {
    it('detects full HTTPS URL with path', () => {
      const result = detectUrlQuery('https://ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php');
      expect(result).toBe('ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php');
    });

    it('detects full HTTP URL', () => {
      const result = detectUrlQuery('http://aoijapan.com/katana-123');
      expect(result).toBe('aoijapan.com/katana-123');
    });

    it('detects URL without protocol', () => {
      const result = detectUrlQuery('ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php');
      expect(result).toBe('ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php');
    });

    it('detects URL with www prefix', () => {
      const result = detectUrlQuery('www.aoijapan.com/katana-123');
      expect(result).toBe('aoijapan.com/katana-123');
    });

    it('detects HTTPS URL with www prefix', () => {
      const result = detectUrlQuery('https://www.nihonto.com/items/sword-42');
      expect(result).toBe('nihonto.com/items/sword-42');
    });

    it('detects domain-only input', () => {
      const result = detectUrlQuery('choshuya.co.jp');
      expect(result).toBe('choshuya.co.jp');
    });

    it('detects domain with simple TLD', () => {
      const result = detectUrlQuery('aoijapan.com');
      expect(result).toBe('aoijapan.com');
    });

    it('strips trailing slashes', () => {
      const result = detectUrlQuery('https://aoijapan.com/katana/');
      expect(result).toBe('aoijapan.com/katana');
    });

    it('detects URL with port number', () => {
      const result = detectUrlQuery('localhost:3000/listing/123');
      // localhost alone doesn't have two TLD segments, so this should not match
      expect(result).toBeNull();
    });

    it('detects real dealer URLs', () => {
      expect(detectUrlQuery('https://www.nipponto.co.jp/swords/KA303421.htm')).toBe(
        'nipponto.co.jp/swords/KA303421.htm'
      );
      expect(detectUrlQuery('https://sanmei.com/contents/media/S24666_Files/S24666.htm')).toBe(
        'sanmei.com/contents/media/S24666_Files/S24666.htm'
      );
      expect(detectUrlQuery('https://www.e-sword.jp/sale/2024/2411_1927katana.htm')).toBe(
        'e-sword.jp/sale/2024/2411_1927katana.htm'
      );
    });

    it('detects subdomain URLs', () => {
      const result = detectUrlQuery('ginza.choshuya.co.jp');
      expect(result).toBe('ginza.choshuya.co.jp');
    });

    it('detects URL with query parameters', () => {
      const result = detectUrlQuery('https://example.com/item?id=123&lang=en');
      expect(result).toBe('example.com/item?id=123&lang=en');
    });
  });

  describe('rejects non-URL input', () => {
    it('returns null for plain text query', () => {
      expect(detectUrlQuery('katana juyo')).toBeNull();
    });

    it('returns null for single word', () => {
      expect(detectUrlQuery('katana')).toBeNull();
    });

    it('returns null for artisan codes', () => {
      expect(detectUrlQuery('MAS590')).toBeNull();
      expect(detectUrlQuery('OWA009')).toBeNull();
      expect(detectUrlQuery('NS-Ko-Bizen')).toBeNull();
    });

    it('returns null for Japanese text', () => {
      expect(detectUrlQuery('備前国住長船')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectUrlQuery('')).toBeNull();
    });

    it('returns null for short input', () => {
      expect(detectUrlQuery('ab')).toBeNull();
      expect(detectUrlQuery('abc')).toBeNull();
    });

    it('returns null for numeric filter syntax', () => {
      expect(detectUrlQuery('cm>70')).toBeNull();
      expect(detectUrlQuery('nagasa>65.5')).toBeNull();
    });

    it('returns null for multi-word queries with URL-like words', () => {
      expect(detectUrlQuery('katana from aoijapan.com')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
      expect(detectUrlQuery(null as unknown as string)).toBeNull();
      expect(detectUrlQuery(undefined as unknown as string)).toBeNull();
    });
  });
});
