'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useCurrency } from '@/hooks/useCurrency';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { showcaseItemsToDisplayItems } from '@/lib/displayItem';
import type { ShowcaseApiRow } from '@/lib/displayItem';
import type { DisplayItem } from '@/types/displayItem';

interface Props {
  token: string;
}

export function PublicShowcaseClient({ token }: Props) {
  const { t } = useLocale();
  const { currency, exchangeRates } = useCurrency();
  const quickView = useQuickView();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [rawRows, setRawRows] = useState<ShowcaseApiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // Mobile view toggle
  const [mobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'grid';
    }
    return 'grid';
  });

  // Set listings in QuickView context for J/K navigation
  const adaptedListings = useMemo(() => {
    return rawRows.map(row => ({
      ...row,
      id: row.item_uuid,
      url: '',
      dealer_id: 0,
      first_seen_at: row.created_at,
      showcase: {
        item_uuid: row.item_uuid,
        visibility: row.visibility,
        owner_display_name: null,
        owner_avatar_url: null,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any[];
  }, [rawRows]);

  useEffect(() => {
    if (adaptedListings.length > 0) {
      quickView.setListings(adaptedListings);
    }
  }, [adaptedListings, quickView.setListings]);

  const fetchShowcase = useCallback(async (currentPage: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('token', token);
      params.set('page', String(currentPage));
      params.set('limit', '50');

      const res = await fetch(`/api/showcase/public?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError(t('showcase.shareExpired'));
          setItems([]);
          setTotal(0);
          return;
        }
        throw new Error('Failed to fetch');
      }

      const data: { data: ShowcaseApiRow[]; total: number; artisanNames?: Record<string, { name_romaji: string | null; name_kanji: string | null; school: string | null }> } = await res.json();
      setRawRows(data.data);
      const mapped = showcaseItemsToDisplayItems(data.data, data.artisanNames);
      setItems(mapped);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Failed to load showcase');
    } finally {
      setIsLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    fetchShowcase(page);
  }, [page, fetchShowcase]);

  const handleItemClick = useCallback((item: DisplayItem) => {
    const rawRow = rawRows.find(r => r.item_uuid === item.id);
    if (rawRow) {
      quickView.openShowcaseQuickView(rawRow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quickView.openQuickView(item as any, { source: 'showcase', skipFetch: true });
    }
  }, [quickView, rawRows]);

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Gallery header */}
          <div className="text-center pt-12 sm:pt-20 mb-12 sm:mb-20">
            <div className="w-20 mx-auto border-t border-gold/30 mb-8" />
            <h1 className="text-2xl sm:text-3xl font-serif tracking-[0.25em] uppercase">
              <span className="text-ink">{t('showcase.titlePrefix')}</span><span className="text-gold">{t('showcase.titleAccent')}</span>
            </h1>
            <p className="mt-4 text-xs sm:text-sm text-muted tracking-[0.18em] font-light">
              {t('showcase.subtitle')}
            </p>
            <div className="w-20 mx-auto border-t border-gold/30 mt-8" />
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
              <p>{t('showcase.empty')}</p>
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
              hideResultCount
              showFavoriteButton={false}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <a
            href="/browse"
            className="text-xs text-muted hover:text-gold transition-colors tracking-wide"
          >
            {t('showcase.sharePoweredBy')}
          </a>
        </div>
      </footer>
    </div>
  );
}
