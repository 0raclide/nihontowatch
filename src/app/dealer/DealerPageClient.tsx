'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { dealerListingToDisplayItem } from '@/lib/displayItem';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import type { DisplayItem } from '@/types/displayItem';

type Tab = 'available' | 'sold' | 'withdrawn' | 'all';

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'available', labelKey: 'dealer.tabAvailable' },
  { value: 'sold', labelKey: 'dealer.tabSold' },
  { value: 'withdrawn', labelKey: 'dealer.tabWithdrawn' },
  { value: 'all', labelKey: 'dealer.tabAll' },
];

export function DealerPageClient() {
  const { t, locale } = useLocale();
  const quickView = useQuickViewOptional();
  const { currency, exchangeRates } = useCurrency();
  const [tab, setTab] = useState<Tab>('available');
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchListings = useCallback(async (selectedTab: Tab) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/dealer/listings?tab=${selectedTab}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings);
        setTotal(data.total);
      } else if (res.status === 401) {
        setFetchError(t('dealer.sessionExpired'));
      } else {
        setFetchError(t('dealer.fetchError'));
      }
    } catch {
      setFetchError(t('dealer.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchListings(tab);
  }, [tab, fetchListings]);

  const displayItems: DisplayItem[] = useMemo(
    () => listings.map((l) => dealerListingToDisplayItem(l, locale, true)),
    [listings, locale]
  );

  const handleCardClick = useCallback((item: DisplayItem) => {
    if (quickView) {
      quickView.openQuickView(item as unknown as Listing, { source: 'dealer' });
    }
  }, [quickView]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-medium">{t('dealer.myListings')}</h1>
            <p className="text-[12px] text-muted">
              {total} {t('dealer.items')}
            </p>
          </div>
          <Link
            href="/dealer/new"
            className="px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors"
          >
            + {t('dealer.addListing')}
          </Link>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-2">
          {TABS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                tab === value
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted hover:bg-hover'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <p className="text-[13px] text-red-500 dark:text-red-400 mb-3">{fetchError}</p>
            <button
              onClick={() => fetchListings(tab)}
              className="px-4 py-2 rounded-lg bg-surface text-muted text-[13px] font-medium hover:bg-hover transition-colors"
            >
              {t('dealer.retry')}
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="text-[48px] mb-4 opacity-20">刀</div>
            <h2 className="text-[14px] font-medium mb-1">{t('dealer.noListings')}</h2>
            <p className="text-[12px] text-muted mb-4">{t('dealer.noListingsDesc')}</p>
            <Link
              href="/dealer/new"
              className="px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors"
            >
              {t('dealer.addFirstListing')}
            </Link>
          </div>
        ) : (
          <ListingGrid
            listings={[]}
            preMappedItems={displayItems}
            total={total}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            isLoading={false}
            currency={currency}
            exchangeRates={exchangeRates}
            onCardClick={handleCardClick}
          />
        )}
      </div>

      {/* Mobile FAB */}
      <Link
        href="/dealer/new"
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gold text-white shadow-lg flex items-center justify-center text-2xl lg:hidden hover:bg-gold/90 transition-colors z-40"
        aria-label={t('dealer.addListing')}
      >
        +
      </Link>
    </div>
  );
}
