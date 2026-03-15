'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import type { CollectionFilters, CollectionFacets } from '@/types/collection';
import type { CollectionItemRow } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { SortableCollectionGrid } from '@/components/collection/SortableCollectionGrid';
import { CollectionBottomBar } from '@/components/collection/CollectionBottomBar';
import { VaultViewToggle } from '@/components/collection/VaultViewToggle';
import { VaultTableView } from '@/components/collection/VaultTableView';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useHomeCurrency } from '@/hooks/useHomeCurrency';
import { useVaultReturns } from '@/hooks/useVaultReturns';
import { collectionRowsToDisplayItems, dealerListingToDisplayItem } from '@/lib/displayItem';
import type { ExpenseTotalsMap } from '@/lib/displayItem/fromCollectionItem';
import { Header } from '@/components/layout/Header';
import { HomeCurrencyPicker } from '@/components/collection/HomeCurrencyPicker';
import { LedgerTabs } from '@/components/dealer/LedgerTabs';
import { DeaccessionModal, ReaccessionConfirm } from '@/components/collection/DeaccessionModal';
import { DealerInventoryTable } from '@/components/dealer/DealerInventoryTable';
import { useMobileUI } from '@/contexts/MobileUIContext';

// Tab types for dealer users
type CollectionTab = 'collection' | 'available' | 'hold' | 'sold';

// Holding status tabs for collector vault view
type HoldingTab = 'all' | 'owned' | 'sold';

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
  const { isDealer: realIsDealer } = useSubscription();
  const { isAdmin } = useAuth();
  const { homeCurrency, setHomeCurrency, isLoading: isHomeCurrencyLoading } = useHomeCurrency();
  const { openNavDrawer } = useMobileUI();

  // Admin mode simulation (persisted in localStorage, toggled from Header admin dropdown)
  type SimMode = 'none' | 'inner_circle' | 'dealer';
  const [adminSimMode, setAdminSimMode] = useState<SimMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-vault-sim') as SimMode) || 'none';
    }
    return 'none';
  });

  // Listen for sim mode changes from the Header admin dropdown
  useEffect(() => {
    const handler = () => {
      const mode = (localStorage.getItem('nihontowatch-vault-sim') as SimMode) || 'none';
      setAdminSimMode(mode);
      if (mode !== 'dealer') setActiveTab('collection');
    };
    window.addEventListener('vault-sim-change', handler);
    return () => window.removeEventListener('vault-sim-change', handler);
  }, []);

  // Effective role: admin toggle overrides real subscription
  const effectiveIsDealer = isAdmin
    ? adminSimMode === 'dealer'
    : realIsDealer;

  // Tab state for dealer users (collection | available | hold | sold)
  const [activeTab, setActiveTab] = useState<CollectionTab>('collection');

  // Holding status tab for collector vault view (all | owned | sold)
  const [holdingTab, setHoldingTab] = useState<HoldingTab>('owned');

  // Dealer listings state (for non-collection tabs)
  const [dealerListings, setDealerListings] = useState<DisplayItem[]>([]);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [isDealerLoading, setIsDealerLoading] = useState(false);
  const [tabCounts, setTabCounts] = useState<Record<string, number> | null>(null);

  const [items, setItemsState] = useState<CollectionItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CollectionFacets>(EMPTY_FACETS);
  const [artisanNames, setArtisanNames] = useState<Record<string, { name_romaji?: string | null; name_kanji?: string | null; school?: string | null }>>({});
  const [expenseTotals, setExpenseTotals] = useState<ExpenseTotalsMap>({});
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

  // Desktop view toggle — separate preferences for collection vs dealer tabs
  const [collectionDesktopView, setCollectionDesktopView] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-vault-view') as 'grid' | 'table') || 'grid';
    }
    return 'grid';
  });
  const [dealerDesktopView, setDealerDesktopView] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-dealer-view') as 'grid' | 'table') || 'grid';
    }
    return 'grid';
  });

  // Active view depends on which tab group we're in
  const desktopView = activeTab === 'collection' ? collectionDesktopView : dealerDesktopView;

  const handleDesktopViewChange = useCallback((view: 'grid' | 'table') => {
    if (activeTab === 'collection') {
      setCollectionDesktopView(view);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nihontowatch-vault-view', view);
      }
    } else {
      setDealerDesktopView(view);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nihontowatch-dealer-view', view);
      }
    }
  }, [activeTab]);

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

  // Deaccession / re-accession modal state
  const [deaccessionTarget, setDeaccessionTarget] = useState<{ itemId: string; itemTitle: string } | null>(null);
  const [reaccessionTarget, setReaccessionTarget] = useState<{ itemId: string } | null>(null);

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
    () => collectionRowsToDisplayItems(items, artisanNames, expenseTotals),
    [items, artisanNames, expenseTotals]
  );

  // Compute vault returns (historical FX conversion + gain/loss)
  const { returnMap, isLoadingRates: isLoadingReturns } = useVaultReturns(adaptedItems, homeCurrency, expenseTotals);

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

  // Sync collection grid when an item is edited inline in QuickView
  useEffect(() => {
    const handler = (e: Event) => {
      const updated = (e as CustomEvent).detail;
      if (!updated?.item_uuid) return;
      setItemsState(prev => prev.map(item =>
        item.item_uuid === updated.item_uuid ? { ...item, ...updated } as CollectionItemRow : item
      ));
    };
    window.addEventListener('collection-item-updated', handler);
    return () => window.removeEventListener('collection-item-updated', handler);
  }, []);

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
      // Add holding status filter from collector tab (owned/sold)
      if (holdingTab !== 'all') params.set('holdingStatus', holdingTab);
      if (currentFilters.sort && currentFilters.sort !== 'custom') params.set('sort', currentFilters.sort);
      if (currentFilters.page && currentFilters.page > 1) params.set('page', String(currentFilters.page));

      const res = await fetch(`/api/collection/items?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(t('collection.fetchFailed'));
      }

      const data: {
        data: CollectionItemRow[];
        total: number;
        facets: CollectionFacets;
        artisanNames?: Record<string, { name_romaji?: string | null; name_kanji?: string | null; school?: string | null }>;
        expenseTotals?: ExpenseTotalsMap;
      } = await res.json();
      setItemsState(data.data);
      setTotal(data.total);
      setFacets(data.facets);
      setArtisanNames(data.artisanNames || {});
      setExpenseTotals(data.expenseTotals || {});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(t('collection.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t, holdingTab]);

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

  // Handle dealer tab switch
  const handleTabChange = useCallback((tab: CollectionTab) => {
    setActiveTab(tab);
    if (tab === 'collection') {
      fetchItems(filters);
    } else {
      fetchDealerListings(tab);
    }
  }, [fetchItems, fetchDealerListings, filters]);

  // Handle collector holding tab switch
  const handleHoldingTabChange = useCallback((tab: HoldingTab) => {
    setHoldingTab(tab);
  }, []);

  // Fetch dealer tab counts
  const fetchTabCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/dealer/listings/counts');
      if (!res.ok) return;
      const data = await res.json();
      setTabCounts(data);
    } catch {
      // Non-critical — tabs still work without counts
    }
  }, []);

  // Listen for promote/delist/status-change events to refresh the current tab + counts
  useEffect(() => {
    const handlePromoted = () => {
      if (activeTab === 'collection') fetchItems(filters);
      else if (activeTab === 'available') fetchDealerListings('available');
      if (effectiveIsDealer) fetchTabCounts();
    };
    const handleDelisted = () => {
      if (activeTab === 'available' || activeTab === 'hold') fetchDealerListings(activeTab);
      else if (activeTab === 'collection') fetchItems(filters);
      if (effectiveIsDealer) fetchTabCounts();
    };
    const handleStatusChanged = () => {
      if (activeTab === 'collection') fetchItems(filters);
      else fetchDealerListings(activeTab);
      if (effectiveIsDealer) fetchTabCounts();
    };
    window.addEventListener('collection-item-promoted', handlePromoted);
    window.addEventListener('dealer-listing-delisted', handleDelisted);
    window.addEventListener('dealer-listing-status-changed', handleStatusChanged);
    return () => {
      window.removeEventListener('collection-item-promoted', handlePromoted);
      window.removeEventListener('dealer-listing-delisted', handleDelisted);
      window.removeEventListener('dealer-listing-status-changed', handleStatusChanged);
    };
  }, [activeTab, filters, fetchItems, fetchDealerListings, effectiveIsDealer, fetchTabCounts]);

  // Map status → which tab it belongs to (for optimistic count adjustments)
  const statusToTab = useCallback((status: string): 'available' | 'hold' | 'sold' | null => {
    switch (status) {
      case 'AVAILABLE': return 'available';
      case 'HOLD': return 'hold';
      case 'SOLD': case 'PRESUMED_SOLD': return 'sold';
      default: return null;
    }
  }, []);

  // Dealer inventory table: status change handler (optimistic removal + background PATCH)
  const handleDealerTableStatusChange = useCallback(async (listingId: number, newStatus: string) => {
    // Snapshot for rollback
    const prevListings = dealerListings;
    const prevTotal = dealerTotal;
    const prevTabCounts = tabCounts;

    // Determine source and destination tabs for count adjustment
    const movedItem = dealerListings.find(item => Number(item.id) === listingId);
    const sourceTab = statusToTab(movedItem?.status || '');
    const destTab = statusToTab(newStatus);

    // Optimistic: remove item from current tab's list (it's moving to a different tab)
    setDealerListings(prev => prev.filter(item => Number(item.id) !== listingId));
    setDealerTotal(prev => Math.max(0, prev - 1));

    // Optimistic: adjust tab counts
    if (sourceTab || destTab) {
      setTabCounts(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        if (sourceTab && next[sourceTab] != null) next[sourceTab] = Math.max(0, next[sourceTab] - 1);
        if (destTab && next[destTab] != null) next[destTab] = (next[destTab] || 0) + 1;
        return next;
      });
    }

    try {
      const res = await fetch(`/api/dealer/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Rollback on failure
        setDealerListings(prevListings);
        setDealerTotal(prevTotal);
        setTabCounts(prevTabCounts);
      } else {
        // Background refresh counts for accuracy (non-blocking)
        fetchTabCounts();
        window.dispatchEvent(new Event('dealer-listing-status-changed'));
      }
    } catch {
      // Rollback on network error
      setDealerListings(prevListings);
      setDealerTotal(prevTotal);
      setTabCounts(prevTabCounts);
    }
  }, [dealerListings, dealerTotal, tabCounts, statusToTab, fetchTabCounts]);

  // Dealer inventory table: inline price update handler
  const handleDealerTablePriceUpdate = useCallback(async (listingId: number, amount: number | null, currency: string) => {
    // Optimistic update
    setDealerListings(prev => prev.map(item => {
      if (Number(item.id) !== listingId) return item;
      return { ...item, price_value: amount, price_currency: currency };
    }));

    try {
      const res = await fetch(`/api/dealer/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_value: amount, price_currency: currency }),
      });
      if (!res.ok) {
        fetchDealerListings(activeTab);
      }
    } catch {
      fetchDealerListings(activeTab);
    }
  }, [activeTab, fetchDealerListings]);

  // Track whether deep link has been handled to prevent re-opening on re-renders
  const deepLinkHandledRef = useRef(false);

  // Re-fetch when holdingTab changes
  useEffect(() => {
    fetchItems(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingTab]);

  // Initial fetch + check for listing import prefill
  useEffect(() => {
    fetchItems(filters);
    if (effectiveIsDealer) fetchTabCounts();

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

  // Dealer table card click → open QuickView (same as ListingCard default behavior)
  const handleDealerCardClick = useCallback((displayItem: DisplayItem) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quickView.openQuickView(displayItem as any, { source: 'dealer' });
  }, [quickView]);

  // Add button — navigate to full-page form
  const handleAddClick = useCallback(() => {
    window.location.href = '/vault/add';
  }, []);

  // Inline item update from table view (optimistic update + PATCH)
  const handleItemUpdate = useCallback(async (itemId: string, updates: Record<string, unknown>) => {
    // Optimistic update in local items state
    setItemsState(prev => prev.map(item =>
      item.item_uuid === itemId ? { ...item, ...updates } as CollectionItemRow : item
    ));

    // Find the DB id from the item_uuid
    const dbItem = items.find(i => i.item_uuid === itemId);
    if (!dbItem) return;

    try {
      const res = await fetch(`/api/collection/items/${dbItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        // Revert on failure
        fetchItems(filters);
      }
    } catch {
      fetchItems(filters);
    }
  }, [items, filters, fetchItems]);

  // Expense totals changed locally — update state without full refetch
  const handleExpenseTotalsChange = useCallback((itemUuid: string, totals: Record<string, number>) => {
    // Key by itemUuid — useVaultReturns looks up by String(item.id) which IS item_uuid
    // for collection items (set in collectionRowToDisplayItem)
    setExpenseTotals(prev => ({ ...prev, [itemUuid]: totals }));
  }, []);

  // Deaccession handler — from table pill or QuickView button
  // DisplayItem.id is item_uuid for collection items; the API needs the numeric DB id
  const handleDeaccession = useCallback((item: DisplayItem) => {
    const dbItem = items.find(i => i.item_uuid === String(item.id));
    const dbId = dbItem ? String(dbItem.id) : String(item.id);
    setDeaccessionTarget({ itemId: dbId, itemTitle: item.title || '' });
  }, [items]);

  // Re-accession handler — from table pill click on consigned/gifted/lost items
  const handleReaccession = useCallback((item: DisplayItem) => {
    const dbItem = items.find(i => i.item_uuid === String(item.id));
    const dbId = dbItem ? String(dbItem.id) : String(item.id);
    setReaccessionTarget({ itemId: dbId });
  }, [items]);

  // Listen for deaccession events dispatched from QuickView
  // QuickView sends item_uuid; resolve to numeric DB id for the PATCH API
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId) {
        const dbItem = items.find(i => i.item_uuid === detail.itemId);
        const dbId = dbItem ? String(dbItem.id) : detail.itemId;
        setDeaccessionTarget({ itemId: dbId, itemTitle: detail.itemTitle || '' });
      }
    };
    window.addEventListener('vault-open-deaccession', handler);
    return () => window.removeEventListener('vault-open-deaccession', handler);
  }, [items]);

  // After deaccession/re-accession success, refresh the list
  const handleDeaccessionSuccess = useCallback(() => {
    fetchItems(filters);
  }, [fetchItems, filters]);

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

  // Whether drag is enabled (custom sort + desktop + collection tab + grid view)
  const isDragEnabled = filters.sort === 'custom' && isDesktop && activeTab === 'collection' && desktopView === 'grid';

  // Whether to show table view (desktop + collection tab + table mode + dealer only)
  const showTableView = isDesktop && activeTab === 'collection' && desktopView === 'table' && effectiveIsDealer;

  // Whether to show dealer inventory table (desktop + dealer tab + table mode)
  const showDealerTable = isDesktop && activeTab !== 'collection' && desktopView === 'table' && effectiveIsDealer;

  // Determine active count for the pieces label
  const activeCount = activeTab === 'collection' ? total : dealerTotal;
  const activeLoading = activeTab === 'collection' ? isLoading : isDealerLoading;

  // Merge collection total with dealer tab counts for LedgerTabs
  const mergedTabCounts = useMemo(() => {
    if (!tabCounts && isLoading) return null; // Still loading
    return {
      collection: total,
      available: tabCounts?.available ?? 0,
      hold: tabCounts?.hold ?? 0,
      sold: tabCounts?.sold ?? 0,
    };
  }, [total, tabCounts, isLoading]);

  // Collector holding tab counts (derived from facets)
  const holdingTabCounts = useMemo(() => {
    const statusMap = new Map<string, number>();
    for (const s of facets.holdingStatuses || []) {
      statusMap.set(s.value, s.count);
    }
    const owned = statusMap.get('owned') || 0;
    const sold = statusMap.get('sold') || 0;
    return {
      all: owned + sold + (statusMap.get('consigned') || 0) + (statusMap.get('gifted') || 0) + (statusMap.get('lost') || 0),
      owned,
      sold,
    };
  }, [facets.holdingStatuses]);

  // Collector holding tab definitions
  const holdingTabs = useMemo(() => [
    { value: 'all' as HoldingTab, label: t('vault.tabAll') },
    { value: 'owned' as HoldingTab, label: t('vault.tabOwned') },
    { value: 'sold' as HoldingTab, label: t('vault.tabSold'), dotColor: 'var(--text-muted)' },
  ], [t]);

  // Ledger tab definitions with status dot colors (dealer)
  const ledgerTabs = useMemo(() => [
    { value: 'collection' as CollectionTab, label: t('collection.tabAllItems') },
    { value: 'available' as CollectionTab, label: t('collection.tabForSale'), dotColor: 'var(--success)' },
    { value: 'hold' as CollectionTab, label: t('collection.tabOnHold'), dotColor: 'var(--warning)' },
    { value: 'sold' as CollectionTab, label: t('collection.tabSold'), dotColor: 'var(--text-muted)' },
  ], [t]);

  return (
    <div className="min-h-screen bg-surface transition-colors">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-3 lg:px-6 lg:py-4 pb-24 lg:pb-8">
        {/* Toolbar: segment tabs + item count + add button + view toggles */}
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <div className="flex items-center gap-3">
            {/* Compact segment tabs — desktop only (mobile uses bottom bar) */}
            {(() => {
              const tabs = effectiveIsDealer ? ledgerTabs : holdingTabs;
              const currentTab: string = effectiveIsDealer ? activeTab : holdingTab;
              const counts = (effectiveIsDealer ? mergedTabCounts : holdingTabCounts) as Record<string, number> | null;
              const onChange = (effectiveIsDealer
                ? handleTabChange
                : handleHoldingTabChange) as (tab: string) => void;
              return (
                <div className="hidden lg:flex items-center gap-0.5" role="tablist">
                  {tabs.map((tab) => {
                    const isActive = tab.value === currentTab;
                    const count = counts ? counts[tab.value] : undefined;
                    return (
                      <button
                        key={tab.value}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab.value)}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] uppercase tracking-[0.1em]
                          transition-colors duration-150
                          ${isActive
                            ? 'text-gold font-semibold bg-gold/8'
                            : 'text-muted/50 hover:text-charcoal hover:bg-white/5'
                          }
                        `}
                      >
                        {tab.dotColor && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: tab.dotColor }}
                          />
                        )}
                        {tab.label}
                        {count !== undefined && (
                          <span className="tabular-nums opacity-70">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {/* Piece count — mobile only (desktop has counts in tab pills) */}
            <span className="lg:hidden text-[11px] uppercase tracking-[0.12em] text-muted/50 tabular-nums">
              {activeLoading
                ? '\u00A0'
                : activeCount === 1
                  ? t('vault.piece')
                  : t('vault.pieces', { count: activeCount })
              }
            </span>
            {/* Desktop add button — collection tab only */}
            {activeTab === 'collection' && (
              <button
                onClick={handleAddClick}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('collection.add')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Home currency picker — desktop table view only */}
            {showTableView && (
              <HomeCurrencyPicker
                value={homeCurrency}
                onChange={setHomeCurrency}
                isLoading={isHomeCurrencyLoading}
              />
            )}
            {/* Desktop view toggle (grid/table) — dealer only */}
            {effectiveIsDealer && (
              <VaultViewToggle view={desktopView} onViewChange={handleDesktopViewChange} />
            )}
            {/* Mobile view toggle (gallery/grid) */}
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

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-[13px] text-error">
            {error}
            <button onClick={() => fetchItems(filters)} className="ml-2 underline hover:no-underline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Content area with fade-in */}
        <div
          className="flex-1 min-w-0 transition-opacity"
          style={{
            opacity: contentVisible ? 1 : 0,
            transitionDuration: `${FADE_IN_DURATION}ms`,
          }}
        >
          {activeTab === 'collection' ? (
            <>
              {showTableView ? (
                <VaultTableView
                  items={adaptedItems}
                  isLoading={isLoading}
                  defaultCurrency={currency}
                  onItemUpdate={handleItemUpdate}
                  onCardClick={handleCardClick}
                  onExpenseTotalsChange={handleExpenseTotalsChange}
                  homeCurrency={homeCurrency}
                  returnMap={returnMap}
                  isLoadingReturns={isLoadingReturns}
                  onDeaccession={handleDeaccession}
                  onReaccession={handleReaccession}
                />
              ) : isDragEnabled ? (
                <SortableCollectionGrid
                  items={adaptedItems}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  onReorder={handleReorder}
                  onCardClick={handleCardClick}
                  showFavoriteButton={false}
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
                  showFavoriteButton={false}
                />
              )}
            </>
          ) : showDealerTable ? (
            <DealerInventoryTable
              items={dealerListings}
              isLoading={isDealerLoading}
              activeTab={activeTab}
              onStatusChange={handleDealerTableStatusChange}
              onPriceUpdate={handleDealerTablePriceUpdate}
              onCardClick={handleDealerCardClick}
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
              showFavoriteButton={false}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      {effectiveIsDealer ? (
        <>
          {/* Dealer: ledger tabs + Add/Menu stacked in bottom bar */}
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Ledger tabs row */}
            <div className="px-3 pt-2">
              <LedgerTabs
                tabs={ledgerTabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabCounts={mergedTabCounts}
              />
            </div>
            {/* Add + Menu row */}
            <div className="flex items-center h-12">
              <button
                onClick={handleAddClick}
                className="flex flex-col items-center justify-center flex-1 h-full text-gold active:text-gold-light transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] mt-0.5 font-medium">{t('collection.add')}</span>
              </button>
              <button
                onClick={openNavDrawer}
                className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="text-[10px] mt-0.5 font-medium">{t('nav.menu')}</span>
              </button>
            </div>
          </nav>
          {/* Spacer */}
          <div
            className="lg:hidden flex-shrink-0"
            style={{ height: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}
            aria-hidden="true"
          />
        </>
      ) : activeTab === 'collection' ? (
        <CollectionBottomBar
          onAddClick={handleAddClick}
          holdingTabs={holdingTabs}
          holdingTab={holdingTab}
          onHoldingTabChange={handleHoldingTabChange as (tab: string) => void}
          holdingTabCounts={holdingTabCounts}
        />
      ) : null}

      {/* Deaccession modal */}
      {deaccessionTarget && (
        <DeaccessionModal
          itemId={deaccessionTarget.itemId}
          itemTitle={deaccessionTarget.itemTitle}
          onClose={() => setDeaccessionTarget(null)}
          onSuccess={handleDeaccessionSuccess}
        />
      )}

      {/* Re-accession confirm dialog */}
      {reaccessionTarget && (
        <ReaccessionConfirm
          itemId={reaccessionTarget.itemId}
          onClose={() => setReaccessionTarget(null)}
          onSuccess={handleDeaccessionSuccess}
        />
      )}
    </div>
  );
}
