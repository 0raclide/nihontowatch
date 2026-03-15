'use client';

import { useState, useCallback, useMemo } from 'react';
import type { DisplayItem } from '@/types/displayItem';
import { useLocale } from '@/i18n/LocaleContext';
import { getAttributionName } from '@/lib/listing/attribution';
import { CERT_LABELS } from '@/lib/collection/labels';
import { computeListingCompleteness } from '@/lib/dealer/completeness';
import { DealerInventoryRow } from './DealerInventoryRow';
import { ListForSaleModal } from './ListForSaleModal';

// =============================================================================
// Types
// =============================================================================

export interface DealerInventoryTableProps {
  items: DisplayItem[];
  isLoading: boolean;
  activeTab: string;
  onStatusChange: (listingId: number, newStatus: string) => void;
  onPriceUpdate: (listingId: number, amount: number | null, currency: string) => void;
  onCardClick: (item: DisplayItem) => void;
}

type SortKey =
  | 'status' | 'title' | 'type' | 'cert' | 'attribution'
  | 'price' | 'days_listed' | 'images' | 'videos'
  | 'completeness' | 'featured';

type SortDir = 'asc' | 'desc';

// =============================================================================
// Helpers
// =============================================================================

function computeDaysListed(firstSeenAt: string | null | undefined): number | null {
  if (!firstSeenAt) return null;
  const ms = Date.now() - new Date(firstSeenAt).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function getImageCount(item: DisplayItem): number {
  return (item.stored_images?.length || 0) || (item.images?.length || 0);
}

function getFeaturedScore(item: DisplayItem): number | null {
  return item.browse?.featured_score ?? null;
}

// =============================================================================
// Component
// =============================================================================

export function DealerInventoryTable({
  items,
  isLoading,
  activeTab,
  onStatusChange,
  onPriceUpdate,
  onCardClick,
}: DealerInventoryTableProps) {
  const { t, locale } = useLocale();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ListForSale modal state
  const [listForSaleTarget, setListForSaleTarget] = useState<DisplayItem | null>(null);

  // Toggle sort column
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // Pre-compute derived values for all items
  const derivedData = useMemo(() => {
    const map = new Map<string | number, {
      attribution: string | null;
      completeness: ReturnType<typeof computeListingCompleteness>;
      daysListed: number | null;
      imageCount: number;
      featuredScore: number | null;
    }>();
    for (const item of items) {
      map.set(item.id, {
        attribution: getAttributionName(item) || item.artisan_display_name || null,
        completeness: computeListingCompleteness(item),
        daysListed: computeDaysListed(item.first_seen_at),
        imageCount: getImageCount(item),
        featuredScore: getFeaturedScore(item),
      });
    }
    return map;
  }, [items]);

  // Sort items client-side
  const sortedItems = useMemo(() => {
    if (!sortKey) return items;

    return [...items].sort((a, b) => {
      const da = derivedData.get(a.id);
      const db = derivedData.get(b.id);
      let va: string | number | null = null;
      let vb: string | number | null = null;

      switch (sortKey) {
        case 'status':
          va = a.status; vb = b.status; break;
        case 'title':
          va = a.title; vb = b.title; break;
        case 'type':
          va = a.item_type; vb = b.item_type; break;
        case 'cert':
          va = a.cert_type; vb = b.cert_type; break;
        case 'attribution':
          va = da?.attribution ?? null; vb = db?.attribution ?? null; break;
        case 'price':
          va = a.price_value; vb = b.price_value; break;
        case 'days_listed':
          va = da?.daysListed ?? null; vb = db?.daysListed ?? null; break;
        case 'images':
          va = da?.imageCount ?? 0; vb = db?.imageCount ?? 0; break;
        case 'videos':
          va = a.video_count ?? 0; vb = b.video_count ?? 0; break;
        case 'completeness':
          va = da?.completeness.score ?? 0; vb = db?.completeness.score ?? 0; break;
        case 'featured':
          va = da?.featuredScore ?? null; vb = db?.featuredScore ?? null; break;
      }

      // Nulls sort last regardless of direction
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }

      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [items, sortKey, sortDir, derivedData]);

  // Sort header arrow — plain function to avoid new identity each render
  const sortArrow = (column: SortKey) => {
    if (sortKey !== column) return null;
    return (
      <span className="ml-0.5 text-gold">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Handle ListForSale modal success
  const handleListForSaleSuccess = useCallback((status: string, patchedFields: { price_value: number | null; price_currency: string }) => {
    if (listForSaleTarget) {
      onStatusChange(Number(listForSaleTarget.id), status);
      if (patchedFields.price_value !== undefined) {
        onPriceUpdate(Number(listForSaleTarget.id), patchedFields.price_value, patchedFields.price_currency);
      }
    }
  }, [listForSaleTarget, onStatusChange, onPriceUpdate]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/30">
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="py-2 px-2">
                  <div className="h-3 bg-surface-elevated rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/10">
                {Array.from({ length: 12 }).map((_, j) => (
                  <td key={j} className="py-3 px-2">
                    <div className="h-3 bg-surface-elevated rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    const emptyMessages: Record<string, { title: string; desc: string }> = {
      available: { title: 'No listings for sale', desc: 'Move items from inventory to start selling' },
      hold: { title: 'No items on hold', desc: 'Put items on hold while preparing them for sale' },
      sold: { title: 'No sold items', desc: 'Sold items will appear here for your records' },
    };
    const msg = emptyMessages[activeTab] || { title: t('vault.table.emptyTitle'), desc: t('vault.table.emptyDescription') };

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-muted/30 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
          </svg>
        </div>
        <p className="text-[13px] text-muted/60 mb-1">{msg.title}</p>
        <p className="text-[11px] text-muted/40">{msg.desc}</p>
      </div>
    );
  }

  const headerClass = 'py-2 px-2 text-left text-[9px] uppercase tracking-wider text-muted/50 font-medium cursor-pointer hover:text-muted/80 transition-colors select-none whitespace-nowrap';

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-border/30">
              {/* Thumbnail (non-sortable) */}
              <th className="py-2 px-2 w-[44px]" />
              {/* Status */}
              <th className={`${headerClass} w-[80px]`} onClick={() => handleSort('status')}>
                {t('vault.table.status')}{sortArrow('status')}
              </th>
              {/* Title */}
              <th className={headerClass} onClick={() => handleSort('title')}>
                {t('vault.table.title')}{sortArrow('title')}
              </th>
              {/* Type */}
              <th className={`${headerClass} w-[80px]`} onClick={() => handleSort('type')}>
                {t('vault.table.type')}{sortArrow('type')}
              </th>
              {/* Cert */}
              <th className={`${headerClass} w-[70px]`} onClick={() => handleSort('cert')}>
                {t('vault.table.cert')}{sortArrow('cert')}
              </th>
              {/* Attribution */}
              <th className={`${headerClass} w-[150px]`} onClick={() => handleSort('attribution')}>
                {t('vault.table.attribution')}{sortArrow('attribution')}
              </th>
              {/* Price */}
              <th className={`${headerClass} w-[140px]`} onClick={() => handleSort('price')}>
                Price{sortArrow('price')}
              </th>
              {/* Days Listed */}
              <th className={`${headerClass} w-[70px] text-center`} onClick={() => handleSort('days_listed')}>
                Age{sortArrow('days_listed')}
              </th>
              {/* Images */}
              <th className={`${headerClass} w-[50px] text-center`} onClick={() => handleSort('images')}>
                Img{sortArrow('images')}
              </th>
              {/* Videos */}
              <th className={`${headerClass} w-[50px] text-center`} onClick={() => handleSort('videos')}>
                Vid{sortArrow('videos')}
              </th>
              {/* Completeness */}
              <th className={`${headerClass} w-[90px]`} onClick={() => handleSort('completeness')}>
                Complete{sortArrow('completeness')}
              </th>
              {/* Featured Score */}
              <th className={`${headerClass} w-[70px] text-right`} onClick={() => handleSort('featured')}>
                Score{sortArrow('featured')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(item => {
              const derived = derivedData.get(item.id);
              const certInfo = item.cert_type ? CERT_LABELS[item.cert_type] : null;
              const thumbUrl = item.stored_images?.[0] || (item.images && item.images.length > 0 ? item.images[0] : null);

              return (
                <DealerInventoryRow
                  key={String(item.id)}
                  item={item}
                  attribution={derived?.attribution ?? null}
                  certInfo={certInfo}
                  thumbUrl={thumbUrl}
                  completeness={derived?.completeness ?? { score: 0, total: 100, missing: [] }}
                  daysListed={derived?.daysListed ?? null}
                  featuredScore={derived?.featuredScore ?? null}
                  imageCount={derived?.imageCount ?? 0}
                  locale={locale}
                  t={t}
                  onCardClick={onCardClick}
                  onStatusChange={onStatusChange}
                  onPriceUpdate={onPriceUpdate}
                  onListForSale={setListForSaleTarget}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ListForSale modal (for INVENTORY→AVAILABLE or SOLD→Relist) */}
      <ListForSaleModal
        isOpen={listForSaleTarget != null}
        onClose={() => setListForSaleTarget(null)}
        listingId={Number(listForSaleTarget?.id) || 0}
        currentPrice={listForSaleTarget?.price_value}
        currentCurrency={listForSaleTarget?.price_currency}
        onSuccess={handleListForSaleSuccess}
      />
    </div>
  );
}
