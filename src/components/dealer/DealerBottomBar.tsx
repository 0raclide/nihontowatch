'use client';

import { useLocale } from '@/i18n/LocaleContext';

type Tab = 'inventory' | 'available' | 'hold' | 'sold';

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'inventory', labelKey: 'dealer.tabInventory' },
  { value: 'available', labelKey: 'dealer.tabForSale' },
  { value: 'hold', labelKey: 'dealer.tabOnHold' },
  { value: 'sold', labelKey: 'dealer.tabSold' },
];

interface DealerBottomBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddClick: () => void;
}

export function DealerBottomBar({ activeTab, onTabChange, onAddClick }: DealerBottomBarProps) {
  const { t } = useLocale();

  return (
    <div className="bg-surface/95 backdrop-blur-sm border-t border-border/30">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          {TABS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => onTabChange(value)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                activeTab === value
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted hover:bg-hover'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1 px-4 py-1.5 text-[12px] font-medium text-white bg-gold rounded-lg hover:bg-gold/90 transition-colors active:scale-[0.98]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('dealer.addListing')}
        </button>
      </div>
    </div>
  );
}
