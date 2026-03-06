'use client';

import { useState, useRef, useEffect } from 'react';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useLocale } from '@/i18n/LocaleContext';

type Tab = 'inventory' | 'available' | 'hold' | 'sold';

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'inventory', labelKey: 'dealer.tabInventory' },
  { value: 'available', labelKey: 'dealer.tabForSale' },
  { value: 'hold', labelKey: 'dealer.tabOnHold' },
  { value: 'sold', labelKey: 'dealer.tabSold' },
];

interface DealerMobileBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddClick: () => void;
  tabCounts?: Record<Tab, number> | null;
}

export function DealerMobileBar({ activeTab, onTabChange, onAddClick, tabCounts }: DealerMobileBarProps) {
  const { openNavDrawer } = useMobileUI();
  const { t } = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close sheet on outside click
  useEffect(() => {
    if (!sheetOpen) return;
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSheetOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sheetOpen]);

  const activeLabel = t(TABS.find(tab => tab.value === activeTab)?.labelKey || 'dealer.statusFilter');
  const activeCount = tabCounts?.[activeTab];

  return (
    <nav
      className="lg:hidden bg-cream/95 backdrop-blur-sm border-t border-border shrink-0 relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
    >
      {/* Status pill sheet */}
      {sheetOpen && (
        <div
          ref={sheetRef}
          className="absolute bottom-full left-0 right-0 bg-surface border-t border-border/30 shadow-lg px-4 py-3"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map(({ value, labelKey }) => {
              const count = tabCounts?.[value];
              return (
                <button
                  key={value}
                  onClick={() => { onTabChange(value); setSheetOpen(false); }}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    activeTab === value
                      ? 'bg-gold/10 text-gold'
                      : 'text-muted hover:bg-hover'
                  }`}
                >
                  {t(labelKey)}
                  {count != null && (
                    <span className={`ml-1 ${activeTab === value ? 'text-gold/60' : 'text-muted/50'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center h-16">
        {/* Add */}
        <button
          onClick={onAddClick}
          className="flex flex-col items-center justify-center flex-1 h-full text-gold active:text-gold/70 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[11px] mt-1 font-medium">{t('dealer.add')}</span>
        </button>

        {/* Status selector */}
        <button
          onClick={() => setSheetOpen(prev => !prev)}
          className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
        >
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-medium">{activeLabel}</span>
            {activeCount != null && (
              <span className="text-[12px] text-muted/60">{activeCount}</span>
            )}
            <svg className={`w-3.5 h-3.5 text-muted/50 transition-transform ${sheetOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <span className="text-[11px] mt-0.5 font-medium text-muted/50">{t('dealer.statusFilter')}</span>
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
  );
}
