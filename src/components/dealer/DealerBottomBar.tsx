'use client';

import { useRouter } from 'next/navigation';
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
  tabCounts?: Record<Tab, number> | null;
}

export function DealerBottomBar({ activeTab, onTabChange, onAddClick, tabCounts }: DealerBottomBarProps) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <div className="bg-surface/95 backdrop-blur-sm border-t border-border/30">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => router.push('/dealer/profile')}
          className="p-1.5 text-muted hover:text-gold transition-colors shrink-0"
          aria-label={t('dealer.profileSettings')}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          {TABS.map(({ value, labelKey }) => {
            const count = tabCounts?.[value];
            return (
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
                {count != null && (
                  <span className={`ml-0.5 ${activeTab === value ? 'text-gold/60' : 'text-muted/50'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
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
