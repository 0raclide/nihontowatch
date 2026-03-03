'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { DealerBottomBar } from '@/components/dealer/DealerBottomBar';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { dealerListingToDisplayItem } from '@/lib/displayItem';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import type { DisplayItem } from '@/types/displayItem';

type Tab = 'inventory' | 'available' | 'sold';

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'inventory', labelKey: 'dealer.tabInventory' },
  { value: 'available', labelKey: 'dealer.tabForSale' },
  { value: 'sold', labelKey: 'dealer.tabSold' },
];

export function DealerPageClient() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const quickView = useQuickViewOptional();
  const { currency, exchangeRates } = useCurrency();
  const [tab, setTab] = useState<Tab>('inventory');
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [dealerNameJa, setDealerNameJa] = useState<string | null>(null);

  const displayName = locale === 'ja' && dealerNameJa ? dealerNameJa : dealerName;

  const fetchListings = useCallback(async (selectedTab: Tab) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/dealer/listings?tab=${selectedTab}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings);
        setTotal(data.total);
        if (data.dealer_name) setDealerName(data.dealer_name);
        if (data.dealer_name_ja !== undefined) setDealerNameJa(data.dealer_name_ja);
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

  const handleAddClick = useCallback(() => {
    router.push('/dealer/new');
  }, [router]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Sub-header: shop name + tabs + add (desktop), shop name only (mobile) */}
      <div className="sticky top-0 lg:top-[var(--header-visible-h,80px)] z-30 bg-cream/95 backdrop-blur-sm border-b border-border/30 transition-[top] duration-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-medium">
              {displayName || t('dealer.myListings')}
            </h1>
            <p className="text-[12px] text-muted">
              {total} {t('dealer.items')}
            </p>
          </div>
          <Link
            href="/dealer/new"
            className="hidden lg:inline-flex px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors"
          >
            + {t('dealer.addListing')}
          </Link>
        </div>

        {/* Desktop tabs */}
        <div className="hidden lg:flex max-w-5xl mx-auto px-4 gap-1 pb-2">
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
      <div className="max-w-5xl mx-auto pb-36 lg:pb-0">
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

      {/* Mobile: dealer toolbar (tabs + add) stacked above global nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
        <DealerBottomBar
          activeTab={tab}
          onTabChange={setTab}
          onAddClick={handleAddClick}
        />
        <BottomTabBar contained />
      </div>
    </div>
  );
}
