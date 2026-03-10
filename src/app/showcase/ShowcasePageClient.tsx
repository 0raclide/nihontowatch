'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { Header } from '@/components/layout/Header';
import { showcaseItemsToDisplayItems } from '@/lib/displayItem';
import type { ShowcaseApiRow } from '@/lib/displayItem';
import type { DisplayItem } from '@/types/displayItem';

type ShowcaseTab = 'community' | 'dealers';

export function ShowcasePageClient() {
  const { t } = useLocale();
  const { currency, exchangeRates } = useCurrency();
  const quickView = useQuickView();
  const { isDealer, isInnerCircle } = useSubscription();
  const canSeeDealerTab = isDealer || isInnerCircle;

  const [activeTab, setActiveTab] = useState<ShowcaseTab>('community');
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // Mobile view toggle (shared localStorage key with browse)
  const [mobileView, setMobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'grid';
    }
    return 'grid';
  });

  // Set listings in QuickView context for J/K navigation
  useEffect(() => {
    if (items.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.setListings(items as any[]);
    }
  }, [items, quickView.setListings]);

  const fetchShowcase = useCallback(async (tab: ShowcaseTab, currentPage: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('tab', tab);
      params.set('page', String(currentPage));
      params.set('limit', '50');

      const res = await fetch(`/api/showcase?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError(t('showcase.empty'));
          setItems([]);
          setTotal(0);
          return;
        }
        throw new Error('Failed to fetch');
      }

      const data: { data: ShowcaseApiRow[]; total: number } = await res.json();
      const mapped = showcaseItemsToDisplayItems(data.data);
      setItems(mapped);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Failed to load showcase');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Initial fetch + refetch on tab/page change
  useEffect(() => {
    fetchShowcase(activeTab, page);
  }, [activeTab, page, fetchShowcase]);

  // Handle QuickView open for showcase items
  const handleItemClick = useCallback((item: DisplayItem) => {
    // Cast to Listing shape for openQuickView (DisplayItem is a superset)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quickView.openQuickView(item as any, {
      source: 'showcase',
      skipFetch: true,
    });
  }, [quickView]);

  const handleTabChange = useCallback((tab: ShowcaseTab) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-serif text-ink">
              {t('showcase.title')}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            <button
              onClick={() => handleTabChange('community')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'community'
                  ? 'border-gold text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t('showcase.tabCommunity')}
            </button>
            {canSeeDealerTab && (
              <button
                onClick={() => handleTabChange('dealers')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'dealers'
                    ? 'border-gold text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t('showcase.tabDealers')}
              </button>
            )}
          </div>

          {/* Error state */}
          {error && !isLoading && items.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p>{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!error && !isLoading && items.length === 0 && (
            <div className="text-center py-16 text-muted">
              <svg className="w-12 h-12 mx-auto mb-4 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>{activeTab === 'dealers' ? t('showcase.emptyDealers') : t('showcase.empty')}</p>
            </div>
          )}

          {/* Grid */}
          {(isLoading || items.length > 0) && (
            <ListingGrid
              listings={[]}
              preMappedItems={items}
              total={total}
              page={page}
              totalPages={Math.ceil(total / 50)}
              onPageChange={setPage}
              mobileView={mobileView}
              currency={currency}
              exchangeRates={exchangeRates}
              isLoading={isLoading}
              onCardClick={handleItemClick}
            />
          )}

        </div>
      </main>
    </div>
  );
}
