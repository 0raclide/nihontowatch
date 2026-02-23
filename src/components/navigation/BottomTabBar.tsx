'use client';

import { memo } from 'react';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';

interface BottomTabBarProps {
  activeFilterCount?: number;
  /**
   * When true, renders as a flex child (for contained-scroll layouts)
   * instead of position:fixed. Eliminates iOS Safari viewport-resize jump.
   */
  contained?: boolean;
}

/**
 * Bottom navigation bar for mobile
 * - Search: Opens search sheet
 * - Filters: Opens filter drawer
 * - Menu: Opens navigation drawer
 */
export const BottomTabBar = memo(function BottomTabBar({
  activeFilterCount = 0,
  contained = false,
}: BottomTabBarProps) {
  const { openSearch, openFilterDrawer, openNavDrawer } = useMobileUI();
  const { t } = useLocale();

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className={`lg:hidden bg-cream/95 backdrop-blur-sm border-t border-border ${
          contained
            ? 'shrink-0'
            : 'fixed bottom-0 inset-x-0 z-40'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="navigation"
        aria-label={t('nav.mainNavigation')}
      >
        <div className="flex items-center h-16">
          {/* Search */}
          <button
            onClick={openSearch}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">{t('nav.search')}</span>
          </button>

          {/* Filters */}
          <button
            onClick={openFilterDrawer}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors relative"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 font-medium">{t('filter.filters')}</span>
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

      {/* Spacer only needed in fixed-position mode */}
      {!contained && (
        <div
          className="lg:hidden flex-shrink-0"
          style={{
            height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
});
