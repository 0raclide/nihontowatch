'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItem, CollectionFilters, CollectionFacets, CollectionListResponse } from '@/types/collection';
import type { DisplayItem } from '@/types/displayItem';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { AddItemCard } from '@/components/collection/AddItemCard';
import { CollectionFilterContent } from '@/components/collection/CollectionFilterContent';
import { CollectionBottomBar } from '@/components/collection/CollectionBottomBar';
import { Drawer } from '@/components/ui/Drawer';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { collectionItemsToDisplayItems } from '@/lib/displayItem';

// =============================================================================
// Constants
// =============================================================================

const EMPTY_FACETS: CollectionFacets = {
  itemTypes: [],
  certifications: [],
  statuses: [],
  conditions: [],
  folders: [],
};

// =============================================================================
// Component
// =============================================================================

export function CollectionPageClient() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const { currency, exchangeRates } = useCurrency();
  const quickView = useQuickView();

  const [items, setItemsState] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CollectionFacets>(EMPTY_FACETS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Mobile filter drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Filters from URL or defaults
  const [filters, setFilters] = useState<CollectionFilters>(() => ({
    itemType: searchParams.get('type') || undefined,
    certType: searchParams.get('cert') || undefined,
    status: (searchParams.get('status') as CollectionFilters['status']) || undefined,
    condition: (searchParams.get('condition') as CollectionFilters['condition']) || undefined,
    sort: (searchParams.get('sort') as CollectionFilters['sort']) || 'newest',
    page: Number(searchParams.get('page')) || 1,
    limit: 100,
  }));

  // Active filter count for bottom bar badge
  const activeFilterCount = (filters.itemType ? 1 : 0) + (filters.certType ? 1 : 0) +
    (filters.status ? 1 : 0) + (filters.condition ? 1 : 0);

  // Adapt collection items to DisplayItem shape for ListingCard
  const adaptedItems = useMemo(
    () => collectionItemsToDisplayItems(items),
    [items]
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
      if (currentFilters.itemType) params.set('type', currentFilters.itemType);
      if (currentFilters.certType) params.set('cert', currentFilters.certType);
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

      const data: CollectionListResponse = await res.json();
      setItemsState(data.data);
      setTotal(data.total);
      setFacets(data.facets);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(t('collection.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Track whether deep link has been handled to prevent re-opening on re-renders
  const deepLinkHandledRef = useRef(false);

  // Initial fetch + check for listing import prefill
  useEffect(() => {
    fetchItems(filters);

    // Check if we arrived via "I Own This" from browse QuickView
    const addParam = searchParams.get('add');
    if (addParam === 'listing') {
      try {
        const stored = sessionStorage.getItem('collection_prefill');
        if (stored) {
          const prefill = JSON.parse(stored);
          sessionStorage.removeItem('collection_prefill');
          quickView.openCollectionAddForm(prefill);
          // Clean up URL
          window.history.replaceState(null, '', '/collection');
        }
      } catch {
        // ignore parse errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link: ?item=UUID → auto-open QuickView after items load
  useEffect(() => {
    if (deepLinkHandledRef.current || isLoading || items.length === 0) return;
    const itemId = searchParams.get('item');
    if (!itemId) return;

    const match = items.find(i => i.id === itemId);
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
    const filterKeys = ['type', 'cert', 'status', 'condition', 'sort'];
    filterKeys.forEach(k => url.searchParams.delete(k));

    if (newFilters.itemType) url.searchParams.set('type', newFilters.itemType);
    if (newFilters.certType) url.searchParams.set('cert', newFilters.certType);
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

  // Card click → open collection QuickView (receives DisplayItem from ListingGrid, looks up original CollectionItem)
  const handleCardClick = useCallback((displayItem: DisplayItem) => {
    const original = items.find(i => i.id === displayItem.id);
    if (original) {
      quickView.openCollectionQuickView(original, 'view');
    }
  }, [items, quickView]);

  // Add button
  const handleAddClick = useCallback(() => {
    quickView.openCollectionAddForm();
  }, [quickView]);

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-[22px] lg:text-[28px] font-serif text-ink">
            {t('collection.myCollection')}
          </h1>
          <p className="text-[13px] text-muted mt-1">
            {total > 0 ? (total === 1 ? t('collection.itemCount', { count: total }) : t('collection.itemCountPlural', { count: total })) : t('collection.startBuilding')}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
            {error}
            <button onClick={() => fetchItems(filters)} className="ml-2 underline hover:no-underline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Main Layout */}
        <div className="flex gap-6 lg:gap-8">
          {/* Filter Sidebar (desktop) */}
          <div className="hidden lg:block w-56 shrink-0 sticky top-24 self-start">
            <div className="bg-cream border border-border rounded-lg overflow-hidden">
              <CollectionFilterContent
                facets={facets}
                filters={filters}
                onFilterChange={handleFilterChange}
                totalItems={total}
              />
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 min-w-0">
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
              mobileView="grid"
              onCardClick={handleCardClick}
              appendSlot={<AddItemCard onClick={handleAddClick} />}
            />
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
          onFilterChange={(partial) => {
            handleFilterChange(partial);
            setFilterDrawerOpen(false);
          }}
          totalItems={total}
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
    </>
  );
}
