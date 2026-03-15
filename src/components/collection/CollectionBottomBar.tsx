'use client';

import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';
import { LedgerTabs, type LedgerTab } from '@/components/dealer/LedgerTabs';

interface CollectionBottomBarProps {
  onAddClick: () => void;
  holdingTabs: LedgerTab<string>[];
  holdingTab: string;
  onHoldingTabChange: (tab: string) => void;
  holdingTabCounts: Record<string, number> | null;
}

export function CollectionBottomBar({
  onAddClick,
  holdingTabs,
  holdingTab,
  onHoldingTabChange,
  holdingTabCounts,
}: CollectionBottomBarProps) {
  const { openNavDrawer } = useMobileUI();
  const { t } = useLocale();

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Holding tabs row */}
        <div className="px-3 pt-2">
          <LedgerTabs
            tabs={holdingTabs}
            activeTab={holdingTab}
            onTabChange={onHoldingTabChange}
            tabCounts={holdingTabCounts}
          />
        </div>
        {/* Add + Menu row */}
        <div className="flex items-center h-12">
          {/* Add Item */}
          <button
            onClick={onAddClick}
            className="flex flex-col items-center justify-center flex-1 h-full text-gold active:text-gold-light transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">{t('collection.add')}</span>
          </button>

          {/* Menu */}
          <button
            onClick={openNavDrawer}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">{t('nav.menu')}</span>
          </button>
        </div>
      </nav>

      {/* Spacer to prevent content overlap */}
      <div
        className="lg:hidden flex-shrink-0"
        style={{
          height: 'calc(140px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-hidden="true"
      />
    </>
  );
}
