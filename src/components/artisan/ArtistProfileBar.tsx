'use client';

import { useRouter } from 'next/navigation';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';

/**
 * Simplified mobile bottom bar for artist profile pages.
 * Provides navigation to /artists, /browse, and the nav menu.
 */
export function ArtistProfileBar() {
  const router = useRouter();
  const { openNavDrawer } = useMobileUI();
  const { t } = useLocale();

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-cream/95 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="navigation"
        aria-label={t('artist.profileNavLabel')}
      >
        <div className="flex items-center h-16">
          {/* Artists */}
          <button
            onClick={() => router.push('/artists')}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">{t('nav.artists')}</span>
          </button>

          {/* Browse */}
          <button
            onClick={() => router.push('/browse')}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-9.75 5.25-9.75-5.25 4.179-2.25" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">{t('nav.browse')}</span>
          </button>

          {/* Menu */}
          <button
            onClick={openNavDrawer}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">{t('nav.menu')}</span>
          </button>
        </div>
      </nav>

      {/* Spacer */}
      <div
        className="lg:hidden flex-shrink-0"
        style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        aria-hidden="true"
      />
    </>
  );
}
