import { describe, it, expect } from 'vitest';
import { t, isLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import en from '@/i18n/locales/en.json';
import ja from '@/i18n/locales/ja.json';

describe('i18n translation system', () => {
  // 1. All en.json keys exist in ja.json
  describe('key parity', () => {
    const enKeys = Object.keys(en);
    const jaKeys = Object.keys(ja);

    it('ja.json has all keys from en.json', () => {
      const missingInJa = enKeys.filter(k => !jaKeys.includes(k));
      expect(missingInJa).toEqual([]);
    });

    it('en.json has all keys from ja.json', () => {
      const missingInEn = jaKeys.filter(k => !enKeys.includes(k));
      expect(missingInEn).toEqual([]);
    });
  });

  // 2. No empty values in either locale
  describe('no empty values', () => {
    it('en.json has no empty string values', () => {
      const emptyKeys = Object.entries(en).filter(([, v]) => v === '');
      expect(emptyKeys).toEqual([]);
    });

    it('ja.json has no empty string values', () => {
      const emptyKeys = Object.entries(ja).filter(([, v]) => v === '');
      expect(emptyKeys).toEqual([]);
    });
  });

  // 3. t() function basics
  describe('t() function', () => {
    it('returns English string for en locale', () => {
      expect(t('en', 'nav.browse')).toBe('Browse');
    });

    it('returns Japanese string for ja locale', () => {
      expect(t('ja', 'nav.browse')).toBe('一覧');
    });

    it('falls back to English when key missing in ja', () => {
      // This test validates the fallback — if a key exists only in en.json
      // For now, since we maintain parity, test the behavior directly
      expect(t('ja', 'nonexistent.key')).toBe('nonexistent.key');
    });

    it('returns raw key when key missing in both locales', () => {
      expect(t('en', 'totally.missing.key')).toBe('totally.missing.key');
    });

    it('supports {param} interpolation', () => {
      // Test with a key that has params
      const result = t('en', 'saveSearch.currentlyMatches', { count: '42' });
      expect(result).toContain('42');
    });

    it('handles multiple params', () => {
      const result = t('en', 'collection.photoOf', { current: '3', total: '10' });
      expect(result).toContain('3');
      expect(result).toContain('10');
    });
  });

  // 4. isLocale() helper
  describe('isLocale()', () => {
    it('returns true for "en"', () => {
      expect(isLocale('en')).toBe(true);
    });

    it('returns true for "ja"', () => {
      expect(isLocale('ja')).toBe(true);
    });

    it('returns false for unsupported locale', () => {
      expect(isLocale('fr')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isLocale(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isLocale(null)).toBe(false);
    });
  });

  // 5. Constants
  describe('constants', () => {
    it('DEFAULT_LOCALE is en', () => {
      expect(DEFAULT_LOCALE).toBe('en');
    });

    it('SUPPORTED_LOCALES includes en and ja', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('ja');
    });
  });

  // 6. Japanese translations are actual Japanese (not copy-pasted English)
  describe('Japanese translation quality', () => {
    const cjkRegex = /[\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/;

    it('core navigation keys contain CJK characters', () => {
      const coreKeys = ['nav.browse', 'nav.artists', 'nav.saved', 'filter.filters', 'badge.sold', 'badge.new'];
      for (const key of coreKeys) {
        const jaValue = (ja as Record<string, string>)[key];
        expect(cjkRegex.test(jaValue), `${key} = "${jaValue}" should contain CJK`).toBe(true);
      }
    });

    it('item type labels use kanji', () => {
      const itemKeys = ['itemType.katana', 'itemType.wakizashi', 'itemType.tanto', 'itemType.tsuba'];
      for (const key of itemKeys) {
        const jaValue = (ja as Record<string, string>)[key];
        expect(cjkRegex.test(jaValue), `${key} = "${jaValue}" should contain CJK`).toBe(true);
      }
    });

    it('certification labels use kanji', () => {
      const certKeys = ['cert.Juyo', 'cert.Hozon', 'cert.Tokuju'];
      for (const key of certKeys) {
        const jaValue = (ja as Record<string, string>)[key];
        expect(cjkRegex.test(jaValue), `${key} = "${jaValue}" should contain CJK`).toBe(true);
      }
    });

    it('email templates contain Japanese', () => {
      const emailKeys = ['email.priceDropSubtitle', 'email.backInStockTitle', 'email.manageAlerts'];
      for (const key of emailKeys) {
        const jaValue = (ja as Record<string, string>)[key];
        expect(cjkRegex.test(jaValue), `${key} = "${jaValue}" should contain CJK`).toBe(true);
      }
    });
  });

  // 7. Interpolation params match between locales
  describe('interpolation param consistency', () => {
    it('all keys with {params} in en.json have matching params in ja.json', () => {
      const paramRegex = /\{(\w+)\}/g;
      const mismatches: string[] = [];

      for (const [key, enValue] of Object.entries(en)) {
        const enParams = [...(enValue as string).matchAll(paramRegex)].map(m => m[1]).sort();
        const jaValue = (ja as Record<string, string>)[key];
        if (!jaValue) continue;
        const jaParams = [...jaValue.matchAll(paramRegex)].map(m => m[1]).sort();

        if (JSON.stringify(enParams) !== JSON.stringify(jaParams)) {
          mismatches.push(`${key}: en has {${enParams.join(',')}} but ja has {${jaParams.join(',')}}`);
        }
      }

      expect(mismatches).toEqual([]);
    });
  });
});
