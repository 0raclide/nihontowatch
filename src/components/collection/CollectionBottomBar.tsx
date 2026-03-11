'use client';

import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';

interface CollectionBottomBarProps {
  activeFilterCount: number;
  onOpenFilters: () => void;
  onAddClick: () => void;
}

export function CollectionBottomBar({
  activeFilterCount,
  onOpenFilters,
  onAddClick,
}: CollectionBottomBarProps) {
  const { openNavDrawer } = useMobileUI();
  const { t } = useLocale();

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-cream/95 backdrop-blur-sm border-t border-border"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center h-16">
          {/* Add Item */}
          <button
            onClick={onAddClick}
            className="flex flex-col items-center justify-center flex-1 h-full text-gold active:text-gold-light transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">{t('collection.add')}</span>
          </button>

          {/* Filters */}
          <button
            onClick={onOpenFilters}
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

      {/* Spacer to prevent content overlap */}
      <div
        className="lg:hidden flex-shrink-0"
        style={{
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-hidden="true"
      />
    </>
  );
}
