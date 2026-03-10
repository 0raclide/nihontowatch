'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { CollectionFilters, CollectionFacets } from '@/types/collection';
import type { CollectionItemRow } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { AddItemCard } from '@/components/collection/AddItemCard';
import { CollectionFilterContent } from '@/components/collection/CollectionFilterContent';
import { CollectionBottomBar } from '@/components/collection/CollectionBottomBar';
import { Drawer } from '@/components/ui/Drawer';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { collectionRowsToDisplayItems, dealerListingToDisplayItem } from '@/lib/displayItem';
import { SORT_OPTIONS } from '@/lib/collection/labels';
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

  // Mobile filter drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Mobile view toggle (shared localStorage key with browse)
  const [mobileView, setMobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'grid';
    }
    return 'grid';
  });

  // Filters from URL or defaults
  const [filters, setFilters] = useState<CollectionFilters>(() => ({
    category: (searchParams.get('category') as CollectionFilters['category']) || undefined,
    itemType: searchParams.get('type') || undefined,
    certType: searchParams.get('cert') || undefined,
    era: searchParams.get('era') || undefined,
    meiType: searchParams.get('meiType') || undefined,
    status: (searchParams.get('status') as CollectionFilters['status']) || undefined,
    condition: (searchParams.get('condition') as CollectionFilters['condition']) || undefined,
    sort: (searchParams.get('sort') as CollectionFilters['sort']) || 'newest',
    page: Number(searchParams.get('page')) || 1,
    limit: 100,
  }));

  // Active filter count for bottom bar badge (category is a mode, not a filter)
  const activeFilterCount = (filters.itemType ? 1 : 0) + (filters.certType ? 1 : 0) +
    (filters.era ? 1 : 0) + (filters.meiType ? 1 : 0) +
    (filters.status ? 1 : 0) + (filters.condition ? 1 : 0);

  // Adapt collection items to DisplayItem shape for ListingCard
  const adaptedItems = useMemo(
    () => collectionRowsToDisplayItems(items, artisanNames),
    [items, artisanNames]
  );

  // Set adapted listings in QuickView context for J/K navigation
  useEffect(() => {
    if (adaptedItems.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.setListings(adaptedItems as any[]);
    }
  }, [adaptedItems, quickView.setListings]);

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
      if (currentFilters.sort && currentFilters.sort !== 'newest') params.set('sort', currentFilters.sort);
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

  // Listen for promote/delist events to refresh the current tab
  useEffect(() => {
    const handlePromoted = () => {
      if (activeTab === 'collection') fetchItems(filters);
      else if (activeTab === 'available') fetchDealerListings('available');
    };
    const handleDelisted = () => {
      if (activeTab === 'available' || activeTab === 'hold') fetchDealerListings(activeTab);
      else if (activeTab === 'collection') fetchItems(filters);
    };
    window.addEventListener('collection-item-promoted', handlePromoted);
    window.addEventListener('dealer-listing-delisted', handleDelisted);
    return () => {
      window.removeEventListener('collection-item-promoted', handlePromoted);
      window.removeEventListener('dealer-listing-delisted', handleDelisted);
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

  // URL sync — update filter params without clobbering non-filter params (e.g. ?item=)
  const syncURL = useCallback((newFilters: CollectionFilters) => {
    const url = new URL(window.location.href);

    // Clear all filter-specific params, then re-set active ones
    const filterKeys = ['category', 'type', 'cert', 'era', 'meiType', 'status', 'condition', 'sort'];
    filterKeys.forEach(k => url.searchParams.delete(k));

    if (newFilters.category) url.searchParams.set('category', newFilters.category);
    if (newFilters.itemType) url.searchParams.set('type', newFilters.itemType);
    if (newFilters.certType) url.searchParams.set('cert', newFilters.certType);
    if (newFilters.era) url.searchParams.set('era', newFilters.era);
    if (newFilters.meiType) url.searchParams.set('meiType', newFilters.meiType);
    if (newFilters.status) url.searchParams.set('status', newFilters.status);
    if (newFilters.condition) url.searchParams.set('condition', newFilters.condition);
    if (newFilters.sort && newFilters.sort !== 'newest') url.searchParams.set('sort', newFilters.sort);

    window.history.replaceState(null, '', url.toString());
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((partial: Partial<CollectionFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...partial, page: 1 };
      syncURL(next);
      fetchItems(next);
      return next;
    });
  }, [syncURL, fetchItems]);

  // Handle sort change (from bottom bar)
  const handleSortChange = useCallback((sort: string) => {
    handleFilterChange({ sort: sort as CollectionFilters['sort'] });
  }, [handleFilterChange]);

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

  return (
    <div className="min-h-screen bg-surface transition-colors">
      <Header />
      <div className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8 pb-24 lg:pb-8">
        {/* Page Header — browse-style on desktop, simple on mobile */}
        <div className="mb-2 lg:mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[22px] lg:text-2xl font-serif text-ink tracking-tight">
              {t('collection.myCollection')}
            </h1>
            <p className="text-[13px] text-muted mt-1">
              {activeTab === 'collection'
                ? (total > 0 ? (total === 1 ? t('collection.itemCount', { count: total }) : t('collection.itemCountPlural', { count: total })) : t('collection.startBuilding'))
                : t('home.itemCount', { count: (isDealerLoading ? '...' : dealerTotal.toLocaleString()) })
              }
            </p>
          </div>

          {/* Desktop: Sort + item count — inline with header */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted/60 font-medium">{t('home.sort')}</span>
              <select
                value={filters.sort || 'newest'}
                onChange={(e) => handleFilterChange({ sort: e.target.value as CollectionFilters['sort'] })}
                className="bg-transparent text-[12px] text-ink font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
                style={{
                  border: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0 center',
                  backgroundSize: '11px',
                }}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-px h-3 bg-border/30" />
            <span className="text-[11px] text-muted tabular-nums">
              {isLoading ? t('common.loading') : t('home.itemCount', { count: total.toLocaleString() })}
            </span>
          </div>
        </div>

        {/* Dealer tabs */}
        {isDealer && (
          <div className="flex gap-1 mb-3 lg:mb-5 overflow-x-auto scrollbar-hide">
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

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4 lg:mb-8" />

        {/* Mobile item count + view toggle */}
        <div className="lg:hidden flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted">
            {isLoading ? t('common.loading') : t('home.itemCount', { count: total.toLocaleString() })}
          </span>
          {/* View toggle — only on phone-sized screens */}
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

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          {/* Filter Sidebar (desktop) — only on collection tab */}
          {activeTab === 'collection' && (
            <div className="hidden lg:block w-[264px] flex-shrink-0">
              <div className="sticky top-24">
                <div
                  className="bg-surface-elevated rounded-2xl border border-border/40 flex flex-col max-h-[calc(100vh-7rem)] overflow-y-auto overflow-x-hidden scrollbar-hide"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
                >
                  <CollectionFilterContent
                    facets={facets}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    totalItems={total}
                  />
                  {/* Bottom fade */}
                  <div className="pointer-events-none h-6 bg-gradient-to-t from-surface-elevated to-transparent -mt-6 relative z-10 rounded-b-2xl" />
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {activeTab === 'collection' ? (
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
      </div>

      {/* Mobile Filter Drawer */}
      <Drawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title={t('collection.filters')}
      >
        <CollectionFilterContent
          facets={facets}
          filters={filters}
          onFilterChange={handleFilterChange}
          totalItems={total}
          onClose={() => setFilterDrawerOpen(false)}
        />
      </Drawer>

      {/* Mobile Bottom Bar */}
      <CollectionBottomBar
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onAddClick={handleAddClick}
        sort={filters.sort || 'newest'}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
