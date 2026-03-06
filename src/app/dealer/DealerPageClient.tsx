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

type Tab = 'inventory' | 'available' | 'hold' | 'sold';

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'inventory', labelKey: 'dealer.tabInventory' },
  { value: 'available', labelKey: 'dealer.tabForSale' },
  { value: 'hold', labelKey: 'dealer.tabOnHold' },
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

  // Mobile view toggle (shared localStorage key with browse)
  const [mobileView, setMobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'grid';
    }
    return 'grid';
  });

  const handleMobileViewChange = useCallback((view: 'grid' | 'gallery') => {
    setMobileView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nihontowatch-mobile-view', view);
    }
  }, []);

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

  // Listen for dealer status changes (from QuickView) and remove the listing from the current tab
  useEffect(() => {
    const handler = (e: Event) => {
      const { listingId } = (e as CustomEvent).detail;
      setListings(prev => prev.filter(l => l.id !== listingId));
      setTotal(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('dealer-listing-status-changed', handler);
    return () => window.removeEventListener('dealer-listing-status-changed', handler);
  }, []);

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
    <div className="min-h-screen bg-surface">
      {/* Sub-header: shop name + tabs + add (desktop), shop name centered (mobile) */}
      <div className="sticky top-0 lg:top-[var(--header-visible-h,80px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border/30 transition-[top] duration-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Mobile: centered name + item count + view toggle */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-[16px] font-medium">
              {displayName || t('dealer.myListings')}
            </h1>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="text-[12px] text-muted">
                {total} {t('dealer.items')}
              </span>
              {/* View toggle — phone only */}
              <div className="flex items-center gap-0.5 sm:hidden">
                <button
                  onClick={() => handleMobileViewChange('gallery')}
                  className={`p-1.5 rounded transition-colors ${mobileView === 'gallery' ? 'text-gold' : 'text-muted/50'}`}
                  aria-label="Gallery view"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="3" y="4" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMobileViewChange('grid')}
                  className={`p-1.5 rounded transition-colors ${mobileView === 'grid' ? 'text-gold' : 'text-muted/50'}`}
                  aria-label="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="10" y="2.5" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="2.5" y="10" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="10" y="10" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            </div>
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
      <div className="max-w-5xl mx-auto px-4 pb-36 lg:pb-0">
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
            mobileView={mobileView}
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
