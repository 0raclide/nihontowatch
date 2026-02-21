'use client';

import { useLocale } from '@/i18n/LocaleContext';

/**
 * Simple language toggle: shows the *other* language as the label.
 *   EN locale → shows "日本語" (click to switch to JA)
 *   JA locale → shows "EN" (click to switch to EN)
 */
export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'ja' : 'en')}
      className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
      aria-label={locale === 'en' ? 'Switch to Japanese' : 'Switch to English'}
    >
      {locale === 'en' ? '日本語' : 'EN'}
    </button>
  );
}

/**
 * Mobile variant — slightly larger touch target, used in MobileNavDrawer.
 */
export function MobileLocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'ja' : 'en')}
      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-text-secondary hover:bg-hover rounded-lg transition-colors"
      aria-label={locale === 'en' ? 'Switch to Japanese' : 'Switch to English'}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      {locale === 'en' ? '日本語に切り替え' : 'Switch to English'}
    </button>
  );
}
