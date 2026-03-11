'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { CollectionFilters, CollectionFacets } from '@/types/collection';
import type { CollectionItemRow } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { SortableCollectionGrid } from '@/components/collection/SortableCollectionGrid';
import { AddItemCard } from '@/components/collection/AddItemCard';
import { CollectionBottomBar } from '@/components/collection/CollectionBottomBar';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { collectionRowsToDisplayItems, dealerListingToDisplayItem } from '@/lib/displayItem';
import { Header } from '@/components/layout/Header';

// Tab types for dealer users
type CollectionTab = 'collection' | 'available' | 'hold' | 'sold';

// =============================================================================
// Constants
// =============================================================================

const EMPTY_FACETS: CollectionFacets = {
  itemTypes: [],
  certifications: [],
  historicalPeriods: [],
  signatureStatuses: [],
  statuses: [],
  conditions: [],
  folders: [],
};

/** Fade-in duration for grid content (ms) */
const FADE_IN_DURATION = 400;

// =============================================================================
// Component
// =============================================================================

export function CollectionPageClient() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const { currency, exchangeRates } = useCurrency();
  const quickView = useQuickView();
  const { isDealer } = useSubscription();

  // Tab state for dealer users (collection | available | hold | sold)
  const [activeTab, setActiveTab] = useState<CollectionTab>('collection');

  // Dealer listings state (for non-collection tabs)
  const [dealerListings, setDealerListings] = useState<DisplayItem[]>([]);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [isDealerLoading, setIsDealerLoading] = useState(false);

  const [items, setItemsState] = useState<CollectionItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CollectionFacets>(EMPTY_FACETS);
  const [artisanNames, setArtisanNames] = useState<Record<string, { name_romaji?: string | null; name_kanji?: string | null; school?: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fade-in state — starts invisible, fades in once data loads
  const [contentVisible, setContentVisible] = useState(false);

  // Mobile view toggle (shared localStorage key with browse)
  const [mobileView, setMobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'grid';
    }
    return 'grid';
  });

  // Filters — always custom sort, no user-facing filter UI for now
  const [filters] = useState<CollectionFilters>(() => ({
    sort: 'custom' as const,
    page: 1,
    limit: 100,
  }));

  // Desktop detection for drag-and-drop (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fade in content once data loads
  useEffect(() => {
    if (!isLoading && !contentVisible) {
      // Small delay so the browser paints the grid before fading in
      const timer = setTimeout(() => setContentVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading, contentVisible]);

  // Adapt collection items to DisplayItem shape for ListingCard
  const adaptedItems = useMemo(
    () => collectionRowsToDisplayItems(items, artisanNames),
    [items, artisanNames]
  );

  // Adapt collection items for QuickView navigation — preserves ALL JSONB sections
  // (sayagaki, koshirae, provenance, kiwame, kanto_hibisho, etc.) that the DisplayItem
  // mapper drops. openQuickView prefers listings[] over the passed listing arg, so these
  // must carry the full data for buildContentStream's section indicators to work.
  const quickViewListings = useMemo(
    () => items.map(item => ({
      ...item,
      id: item.item_uuid,
      url: '',
      dealer_id: 0,
      first_seen_at: item.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)),
    [items]
  );

  // Set adapted listings in QuickView context for J/K navigation
  useEffect(() => {
    if (quickViewListings.length > 0) {
      quickView.setListings(quickViewListings);
    }
  }, [quickViewListings, quickView.setListings]);

  // Fetch collection items
  const fetchItems = useCallback(async (currentFilters: CollectionFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (currentFilters.category) params.set('category', currentFilters.category);
      if (currentFilters.itemType) params.set('type', currentFilters.itemType);
      if (currentFilters.certType) params.set('cert', currentFilters.certType);
      if (currentFilters.era) params.set('era', currentFilters.era);
      if (currentFilters.meiType) params.set('meiType', currentFilters.meiType);
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.condition) params.set('condition', currentFilters.condition);
      if (currentFilters.sort && currentFilters.sort !== 'custom') params.set('sort', currentFilters.sort);
      if (currentFilters.page && currentFilters.page > 1) params.set('page', String(currentFilters.page));

      const res = await fetch(`/api/collection/items?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(t('collection.fetchFailed'));
      }

      const data: { data: CollectionItemRow[]; total: number; facets: CollectionFacets; artisanNames?: Record<string, { name_romaji?: string | null; name_kanji?: string | null; school?: string | null }> } = await res.json();
      setItemsState(data.data);
      setTotal(data.total);
      setFacets(data.facets);
      setArtisanNames(data.artisanNames || {});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(t('collection.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Fetch dealer listings for dealer tabs (available/hold/sold)
  const fetchDealerListings = useCallback(async (tab: CollectionTab) => {
    if (tab === 'collection') return;
    setIsDealerLoading(true);
    try {
      const res = await fetch(`/api/dealer/listings?tab=${tab}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const mapped = (data.listings || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l: any) => dealerListingToDisplayItem(l, locale, true)
      );
      setDealerListings(mapped);
      setDealerTotal(data.total ?? mapped.length);
    } catch {
      setDealerListings([]);
      setDealerTotal(0);
    } finally {
      setIsDealerLoading(false);
    }
  }, [locale]);

  // Handle tab switch
  const handleTabChange = useCallback((tab: CollectionTab) => {
    setActiveTab(tab);
    if (tab === 'collection') {
      fetchItems(filters);
    } else {
      fetchDealerListings(tab);
    }
  }, [fetchItems, fetchDealerListings, filters]);

  // Listen for promote/delist/status-change events to refresh the current tab
  useEffect(() => {
    const handlePromoted = () => {
      if (activeTab === 'collection') fetchItems(filters);
      else if (activeTab === 'available') fetchDealerListings('available');
    };
    const handleDelisted = () => {
      if (activeTab === 'available' || activeTab === 'hold') fetchDealerListings(activeTab);
      else if (activeTab === 'collection') fetchItems(filters);
    };
    const handleStatusChanged = () => {
      if (activeTab === 'collection') fetchItems(filters);
      else fetchDealerListings(activeTab);
    };
    window.addEventListener('collection-item-promoted', handlePromoted);
    window.addEventListener('dealer-listing-delisted', handleDelisted);
    window.addEventListener('dealer-listing-status-changed', handleStatusChanged);
    return () => {
      window.removeEventListener('collection-item-promoted', handlePromoted);
      window.removeEventListener('dealer-listing-delisted', handleDelisted);
      window.removeEventListener('dealer-listing-status-changed', handleStatusChanged);
    };
  }, [activeTab, filters, fetchItems, fetchDealerListings]);

  // Track whether deep link has been handled to prevent re-opening on re-renders
  const deepLinkHandledRef = useRef(false);

  // Initial fetch + check for listing import prefill
  useEffect(() => {
    fetchItems(filters);

    // Check if we arrived via "I Own This" from browse QuickView
    // Redirect to full-page add form (sessionStorage prefill is consumed there)
    const addParam = searchParams.get('add');
    if (addParam === 'listing') {
      window.location.href = '/vault/add';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link: ?item=UUID → auto-open QuickView after items load
  useEffect(() => {
    if (deepLinkHandledRef.current || isLoading || items.length === 0) return;
    const itemId = searchParams.get('item');
    if (!itemId) return;

    const match = items.find(i => i.item_uuid === itemId);
    if (match) {
      deepLinkHandledRef.current = true;
      quickView.openCollectionQuickView(match, 'view');
    }
  }, [items, isLoading, searchParams, quickView]);

  // Register refresh callback for QuickView saves
  useEffect(() => {
    quickView.setOnCollectionSaved(() => fetchItems(filters));
    return () => quickView.setOnCollectionSaved(null);
  }, [filters, fetchItems, quickView]);

  // Mobile view toggle
  const handleMobileViewChange = useCallback((view: 'grid' | 'gallery') => {
    setMobileView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nihontowatch-mobile-view', view);
    }
  }, []);

  // Card click → open collection QuickView (receives DisplayItem from ListingGrid, looks up original CollectionItem)
  const handleCardClick = useCallback((displayItem: DisplayItem) => {
    const original = items.find(i => i.item_uuid === displayItem.id);
    if (original) {
      quickView.openCollectionQuickView(original, 'view');
    }
  }, [items, quickView]);

  // Add button — navigate to full-page form
  const handleAddClick = useCallback(() => {
    window.location.href = '/vault/add';
  }, []);

  // Drag-and-drop reorder handler (custom sort, desktop only)
  const handleReorder = useCallback((activeId: string, overId: string) => {
    // Find indices in items array
    const oldIndex = items.findIndex(i => i.item_uuid === activeId);
    const newIndex = items.findIndex(i => i.item_uuid === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder — splice in local state
    const reordered = [...items];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setItemsState(reordered);

    // Build sort_order assignments
    const reorderPayload = reordered.map((item, idx) => ({
      id: item.id,
      sort_order: idx + 1,
    }));

    // Persist in background — rollback on failure
    fetch('/api/collection/items/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderPayload }),
    }).then(res => {
      if (!res.ok) {
        console.error('Reorder failed, rolling back');
        fetchItems(filters);
      }
    }).catch(() => {
      console.error('Reorder network error, rolling back');
      fetchItems(filters);
    });
  }, [items, filters, fetchItems]);

  // Whether drag is enabled (custom sort + desktop + collection tab)
  const isDragEnabled = filters.sort === 'custom' && isDesktop && activeTab === 'collection';

  // Determine active count for the pieces label
  const activeCount = activeTab === 'collection' ? total : dealerTotal;
  const activeLoading = activeTab === 'collection' ? isLoading : isDealerLoading;

  return (
    <div className="min-h-screen bg-surface transition-colors">
      <Header />

      <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-4 pb-24 lg:pb-8">
        {/* Dealer tabs */}
        {isDealer && (
          <div className="flex gap-1 mb-3 lg:mb-4 overflow-x-auto scrollbar-hide">
            {([
              { key: 'collection' as CollectionTab, label: t('collection.tabCollection') },
              { key: 'available' as CollectionTab, label: t('collection.tabForSale') },
              { key: 'hold' as CollectionTab, label: t('collection.tabOnHold') },
              { key: 'sold' as CollectionTab, label: t('collection.tabSold') },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-gold text-white'
                    : 'bg-surface-elevated text-muted hover:text-ink border border-border/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Subtle item count + mobile view toggle */}
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted/50 tabular-nums">
            {activeLoading
              ? '\u00A0'
              : activeCount === 1
                ? t('vault.piece')
                : t('vault.pieces', { count: activeCount })
            }
          </span>
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

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-[13px] text-error">
            {error}
            <button onClick={() => fetchItems(filters)} className="ml-2 underline hover:no-underline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Grid — compact vault cards with fade-in */}
        <div
          className="flex-1 min-w-0 vault-compact-grid transition-opacity"
          style={{
            opacity: contentVisible ? 1 : 0,
            transitionDuration: `${FADE_IN_DURATION}ms`,
          }}
        >
          {activeTab === 'collection' ? (
            <>
              {isDragEnabled ? (
                <SortableCollectionGrid
                  items={adaptedItems}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  onReorder={handleReorder}
                  onCardClick={handleCardClick}
                  appendSlot={<AddItemCard onClick={handleAddClick} />}
                />
              ) : (
                <ListingGrid
                  listings={[]}
                  preMappedItems={adaptedItems}
                  total={total}
                  page={1}
                  totalPages={1}
                  onPageChange={() => {}}
                  isLoading={isLoading}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  mobileView={mobileView}
                  onCardClick={handleCardClick}
                  appendSlot={<AddItemCard onClick={handleAddClick} />}
                />
              )}
            </>
          ) : (
            <ListingGrid
              listings={[]}
              preMappedItems={dealerListings}
              total={dealerTotal}
              page={1}
              totalPages={1}
              onPageChange={() => {}}
              isLoading={isDealerLoading}
              currency={currency}
              exchangeRates={exchangeRates}
              mobileView={mobileView}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <CollectionBottomBar
        onAddClick={handleAddClick}
      />
    </div>
  );
}
