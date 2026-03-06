'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { DealerMobileBar } from '@/components/dealer/DealerMobileBar';
import { dealerListingToDisplayItem } from '@/lib/displayItem';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useLocale } from '@/i18n/LocaleContext';
import { computeListingCompleteness, type DealerIntelligenceAPIResponse } from '@/lib/dealer/intelligence';
import type { Listing } from '@/types';
import type { DisplayItem } from '@/types/displayItem';

type Tab = 'inventory' | 'available' | 'hold' | 'sold';

type TabCounts = Record<Tab, number>;

const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'inventory', labelKey: 'dealer.tabInventory' },
  { value: 'available', labelKey: 'dealer.tabForSale' },
  { value: 'hold', labelKey: 'dealer.tabOnHold' },
  { value: 'sold', labelKey: 'dealer.tabSold' },
];

/** Map API status string → tab key for optimistic count updates */
function statusToTab(status: string): Tab | null {
  switch (status) {
    case 'AVAILABLE': return 'available';
    case 'HOLD': return 'hold';
    case 'SOLD': return 'sold';
    case 'INVENTORY':
    case 'WITHDRAWN': return 'inventory';
    default: return null;
  }
}

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
  const [tabCounts, setTabCounts] = useState<TabCounts | null>(null);

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

  // Fetch tab counts once on mount
  useEffect(() => {
    fetch('/api/dealer/listings/counts')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTabCounts(data); })
      .catch(() => {});
  }, []);

  const fetchListings = useCallback(async (selectedTab: Tab) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/dealer/listings?tab=${selectedTab}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings);
        setTotal(data.total);
        // Sync the active tab's count from the authoritative total
        setTabCounts(prev => prev ? { ...prev, [selectedTab]: data.total } : null);
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

  // Intelligence data from API (heat + interested collectors — loaded async)
  const [intelligenceData, setIntelligenceData] = useState<DealerIntelligenceAPIResponse['listings'] | null>(null);

  // Fetch intelligence data after listings load (progressive enhancement)
  useEffect(() => {
    if (listings.length === 0) {
      setIntelligenceData(null);
      return;
    }
    const ids = listings.map(l => l.id).join(',');
    fetch(`/api/dealer/listings/intelligence?listingIds=${ids}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DealerIntelligenceAPIResponse | null) => {
        if (data) setIntelligenceData(data.listings);
      })
      .catch(() => {}); // Fail silently — indicators just won't show heat/interested
  }, [listings]);

  // Listen for dealer status changes (from QuickView) and update counts optimistically
  useEffect(() => {
    const handler = (e: Event) => {
      const { listingId, newStatus } = (e as CustomEvent).detail;
      setListings(prev => prev.filter(l => l.id !== listingId));
      setTotal(prev => Math.max(0, prev - 1));

      // Optimistic count update: -1 from current tab, +1 to destination tab
      const destTab = statusToTab(newStatus);
      if (destTab) {
        setTabCounts(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            [tab]: Math.max(0, prev[tab] - 1),
            [destTab]: prev[destTab] + 1,
          };
        });
      }
    };
    window.addEventListener('dealer-listing-status-changed', handler);
    return () => window.removeEventListener('dealer-listing-status-changed', handler);
  }, [tab]);

  const displayItems: DisplayItem[] = useMemo(
    () => listings.map((l) => {
      const item = dealerListingToDisplayItem(l, locale, true);
      // Client-side completeness (instant, no API wait)
      const completeness = computeListingCompleteness(l);
      const apiData = intelligenceData?.[l.id as number];
      return {
        ...item,
        dealer: {
          ...item.dealer!,
          intelligence: {
            completeness: { score: completeness.score, total: completeness.total },
            heatTrend: apiData?.engagement?.heatTrend,
            interestedCollectors: apiData?.interestedCollectors,
            estimatedPosition: apiData?.scorePreview?.estimatedPosition,
            totalListings: apiData?.scorePreview?.totalListings,
            rankBucket: apiData?.scorePreview?.rankBucket,
          },
        },
      };
    }),
    [listings, locale, intelligenceData]
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
              {/* Settings + View toggle — phone only */}
              <div className="flex items-center gap-0.5 sm:hidden">
                <Link
                  href="/dealer/profile"
                  className="p-1.5 rounded text-muted/50 hover:text-gold transition-colors"
                  aria-label={t('dealer.profileSettings')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              </div>
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
          <div className="hidden lg:flex items-center gap-2">
            <Link
              href="/dealer/profile"
              className="p-2 text-muted hover:text-gold transition-colors"
              title={t('dealer.profileSettings')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <Link
              href="/dealer/new"
              className="inline-flex px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-medium hover:bg-gold/90 transition-colors"
            >
              + {t('dealer.addListing')}
            </Link>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden lg:flex max-w-5xl mx-auto px-4 gap-1 pb-2">
          {TABS.map(({ value, labelKey }) => {
            const count = tabCounts?.[value];
            return (
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
                {count != null && (
                  <span className={`ml-1 ${tab === value ? 'text-gold/60' : 'text-muted/50'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 pb-20 lg:pb-0">
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

      {/* Mobile: single bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
        <DealerMobileBar
          activeTab={tab}
          onTabChange={setTab}
          onAddClick={handleAddClick}
          tabCounts={tabCounts}
        />
      </div>
    </div>
  );
}
