'use client';

import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';

interface CollectionBottomBarProps {
  onAddClick: () => void;
}

export function CollectionBottomBar({
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
