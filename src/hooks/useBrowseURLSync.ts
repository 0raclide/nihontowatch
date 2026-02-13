'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AvailabilityStatus } from '@/components/ui/AvailabilityToggle';
import { CATEGORY_DEFAULT, CATEGORY_STORAGE_KEY } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowseFilters {
  category: 'nihonto' | 'tosogu' | 'armor';
  itemTypes: string[];
  certifications: string[];
  schools: string[];
  dealers: number[];
  historicalPeriods: string[];
  signatureStatuses: string[];
  priceMin?: number;
  priceMax?: number;
  askOnly?: boolean;
  enriched?: boolean;
  missingSetsumei?: boolean;
  missingArtisanCode?: boolean;
}

interface BrowseURLState {
  activeTab: AvailabilityStatus;
  filters: BrowseFilters;
  sort: string;
  searchQuery: string;
  artisanCode: string;
}

// ---------------------------------------------------------------------------
// Pure helpers — CSV / bool parsing
// ---------------------------------------------------------------------------

function parseCSV(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function parseCSVNumbers(value: string | null): number[] {
  return value ? value.split(',').map(Number).filter(Boolean) : [];
}

function parseBool(value: string | null): boolean {
  return value === 'true';
}

// ---------------------------------------------------------------------------
// Pure functions — bidirectional URL ↔ State mapping
// ---------------------------------------------------------------------------

/** Resolve category from URL param, localStorage, or default */
function resolveCategory(urlValue: string | null): BrowseFilters['category'] {
  // Explicit URL param (nihonto/tosogu/armor) takes precedence
  if (urlValue === 'nihonto' || urlValue === 'tosogu' || urlValue === 'armor') {
    return urlValue;
  }
  // Legacy ?cat=all or absent → check localStorage, then fall back to default
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (stored === 'nihonto' || stored === 'tosogu' || stored === 'armor') {
      return stored;
    }
  }
  return CATEGORY_DEFAULT;
}

/** URL → canonical state snapshot (single source of truth for parsing) */
export function parseURLState(sp: URLSearchParams): BrowseURLState {
  const priceMinRaw = sp.get('priceMin');
  const priceMaxRaw = sp.get('priceMax');
  return {
    activeTab: (sp.get('tab') as AvailabilityStatus) || 'available',
    filters: {
      category: resolveCategory(sp.get('cat')),
      itemTypes: parseCSV(sp.get('type')),
      certifications: parseCSV(sp.get('cert')),
      schools: parseCSV(sp.get('school')),
      dealers: parseCSVNumbers(sp.get('dealer')),
      historicalPeriods: parseCSV(sp.get('period')),
      signatureStatuses: parseCSV(sp.get('sig')),
      priceMin: priceMinRaw ? Number(priceMinRaw) : undefined,
      priceMax: priceMaxRaw ? Number(priceMaxRaw) : undefined,
      askOnly: parseBool(sp.get('ask')),
      enriched: parseBool(sp.get('enriched')),
      missingSetsumei: parseBool(sp.get('missing_setsumei')),
      missingArtisanCode: parseBool(sp.get('missing_artisan')),
    },
    sort: sp.get('sort') || 'recent',
    searchQuery: sp.get('q') || '',
    artisanCode: sp.get('artisan') || '',
  };
}

/** State → URLSearchParams (single source of truth for serialization) */
export function buildParamsFromState(
  activeTab: AvailabilityStatus,
  filters: BrowseFilters,
  sort: string,
  searchQuery: string,
  artisanCode: string,
): URLSearchParams {
  const params = new URLSearchParams();

  params.set('tab', activeTab);
  if (filters.category !== CATEGORY_DEFAULT) params.set('cat', filters.category);
  if (filters.itemTypes.length) params.set('type', filters.itemTypes.join(','));
  if (filters.certifications.length) params.set('cert', filters.certifications.join(','));
  if (filters.schools.length) params.set('school', filters.schools.join(','));
  if (filters.dealers.length) params.set('dealer', filters.dealers.join(','));
  if (filters.historicalPeriods.length) params.set('period', filters.historicalPeriods.join(','));
  if (filters.signatureStatuses.length) params.set('sig', filters.signatureStatuses.join(','));
  if (filters.priceMin) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax) params.set('priceMax', String(filters.priceMax));
  if (filters.askOnly) params.set('ask', 'true');
  if (filters.enriched) params.set('enriched', 'true');
  if (filters.missingSetsumei) params.set('missing_setsumei', 'true');
  if (filters.missingArtisanCode) params.set('missing_artisan', 'true');
  if (sort !== 'recent') params.set('sort', sort);
  if (searchQuery) params.set('q', searchQuery);
  if (artisanCode) params.set('artisan', artisanCode);

  return params;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowseURLSync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- Initialize state from URL on mount ----
  const initial = useMemo(() => {
    const sp = new URLSearchParams(searchParams.toString());
    return parseURLState(sp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only

  const [activeTab, setActiveTab] = useState<AvailabilityStatus>(initial.activeTab);
  const [filters, setFilters] = useState<BrowseFilters>(initial.filters);
  const [sort, setSort] = useState(initial.sort);
  const [searchQuery, setSearchQuery] = useState(initial.searchQuery);
  const [artisanCode, setArtisanCode] = useState(initial.artisanCode);

  const filtersChangedRef = useRef(false);

  // Shared ref for loop prevention between the two effects
  const prevUrlRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  // ---- URL → State effect ----
  // Fires when searchParams change (e.g. header search, QuickView dealer click, back/forward)
  useEffect(() => {
    // Skip the very first mount — state was already initialized from URL
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      // Record initial URL so State→URL effect can compare
      const sp = new URLSearchParams(searchParams.toString());
      const params = buildParamsFromState(
        initial.activeTab, initial.filters, initial.sort,
        initial.searchQuery, initial.artisanCode,
      );
      const url = `/${params.toString() ? `?${params.toString()}` : ''}`;
      prevUrlRef.current = url;
      return;
    }

    // Build canonical URL string from current searchParams
    const sp = new URLSearchParams(searchParams.toString());
    const parsed = parseURLState(sp);
    const params = buildParamsFromState(
      parsed.activeTab, parsed.filters, parsed.sort,
      parsed.searchQuery, parsed.artisanCode,
    );
    const currentUrl = `/${params.toString() ? `?${params.toString()}` : ''}`;

    // Only sync if the URL actually differs from what we last wrote
    if (currentUrl === prevUrlRef.current) return;

    prevUrlRef.current = currentUrl;

    // Bulk-update state from URL
    setActiveTab(parsed.activeTab);
    setFilters(parsed.filters);
    setSort(parsed.sort);
    setSearchQuery(parsed.searchQuery);
    setArtisanCode(parsed.artisanCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---- State → URL effect ----
  // Fires when any synced state changes (filter sidebar, sort, etc.)
  useEffect(() => {
    const params = buildParamsFromState(activeTab, filters, sort, searchQuery, artisanCode);
    const newUrl = `/${params.toString() ? `?${params.toString()}` : ''}`;

    // Skip if URL matches what we already have (prevents loop with URL→State)
    if (prevUrlRef.current === newUrl) return;

    // On very first render (before URL→State has run), just record — don't replace
    // This preserves the history entry created by router.push() from header search
    if (prevUrlRef.current === null) {
      prevUrlRef.current = newUrl;
      return;
    }

    prevUrlRef.current = newUrl;
    router.replace(newUrl, { scroll: false });
  }, [activeTab, filters, sort, searchQuery, artisanCode, router]);

  // ---- Persist category to localStorage ----
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CATEGORY_STORAGE_KEY, filters.category);
    }
  }, [filters.category]);

  // ---- buildFetchParams — for API calls (excludes page, which is local) ----
  const buildFetchParams = useCallback(() => {
    return buildParamsFromState(activeTab, filters, sort, searchQuery, artisanCode);
  }, [activeTab, filters, sort, searchQuery, artisanCode]);

  return {
    // State
    activeTab,
    filters,
    sort,
    searchQuery,
    artisanCode,
    // Setters
    setActiveTab,
    setFilters,
    setSort,
    setSearchQuery,
    setArtisanCode,
    // Utilities
    buildFetchParams,
    filtersChangedRef,
  };
}
