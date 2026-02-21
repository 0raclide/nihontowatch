/**
 * Shared locale mock for vitest.
 *
 * Usage in test files:
 *   import { setupLocaleMock } from '../helpers/mockLocale';
 *   setupLocaleMock();          // defaults to 'en'
 *   setupLocaleMock('ja');      // renders Japanese strings
 *
 * The `async` factory with `await import()` is required because vitest's
 * mock factories run before module resolution, and the `@/` alias needs
 * dynamic import to resolve correctly.
 */
import { vi } from 'vitest';
import type { Locale } from '@/i18n';

export function setupLocaleMock(locale: Locale = 'en') {
  vi.mock('@/i18n/LocaleContext', async () => {
    const localeFile = locale === 'ja' ? '@/i18n/locales/ja.json' : '@/i18n/locales/en.json';
    const strings = await import(localeFile).then(m => m.default);
    const fallback = locale !== 'en'
      ? await import('@/i18n/locales/en.json').then(m => m.default)
      : null;
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
    return {
      useLocale: () => ({ locale, setLocale: () => {}, t }),
      LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
    };
  });
}
