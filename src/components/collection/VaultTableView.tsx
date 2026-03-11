'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { DisplayItem } from '@/types/displayItem';
import { useLocale } from '@/i18n/LocaleContext';
import { getAttributionName } from '@/lib/listing/attribution';
import { getItemTypeLabel, CERT_LABELS, getCertTierClass, formatPrice } from '@/lib/collection/labels';
import { InlineCurrencyCell, InlineDateCell, InlineTextCell } from './InlineEditCell';
import { ExpenseLedger } from './ExpenseLedger';
import { VaultTableFooter } from './VaultTableFooter';
import { ReturnBreakdownPopover } from './ReturnBreakdownPopover';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';

// =============================================================================
// Types
// =============================================================================

interface VaultTableViewProps {
  items: DisplayItem[];
  isLoading: boolean;
  defaultCurrency: string;
  onItemUpdate: (itemId: string, updates: Record<string, unknown>) => Promise<void>;
  onCardClick: (item: DisplayItem) => void;
  onExpenseTotalsChange: (itemUuid: string, totals: Record<string, number>) => void;
  homeCurrency: string;
  returnMap: Map<string, ItemReturnData>;
  isLoadingReturns: boolean;
}

type SortKey = 'title' | 'type' | 'cert' | 'attribution' | 'purchase_date' | 'paid' | 'current_value' | 'invested' | 'return' | 'location';
type SortDir = 'asc' | 'desc';

// =============================================================================
// Component
// =============================================================================

export function VaultTableView({
  items,
  isLoading,
  defaultCurrency,
  onItemUpdate,
  onCardClick,
  onExpenseTotalsChange,
  homeCurrency,
  returnMap,
  isLoadingReturns,
}: VaultTableViewProps) {
  const { t, locale } = useLocale();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Toggle sort column
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // Sort items client-side
  const sortedItems = useMemo(() => {
    if (!sortKey) return items;

    return [...items].sort((a, b) => {
      const ext_a = a.collection;
      const ext_b = b.collection;
      let va: string | number | null = null;
      let vb: string | number | null = null;

      switch (sortKey) {
        case 'title':
          va = a.title; vb = b.title; break;
        case 'type':
          va = a.item_type; vb = b.item_type; break;
        case 'cert':
          va = a.cert_type; vb = b.cert_type; break;
        case 'attribution':
          va = getAttributionName(a) || a.artisan_display_name || null; vb = getAttributionName(b) || b.artisan_display_name || null; break;
        case 'purchase_date':
          va = ext_a?.purchase_date ?? null; vb = ext_b?.purchase_date ?? null; break;
        case 'paid':
          va = ext_a?.purchase_price ?? null; vb = ext_b?.purchase_price ?? null; break;
        case 'current_value':
          va = ext_a?.current_value ?? null; vb = ext_b?.current_value ?? null; break;
        case 'invested':
          va = ext_a?.total_invested ?? null; vb = ext_b?.total_invested ?? null; break;
        case 'return':
          va = returnMap.get(String(a.id))?.totalReturn ?? null;
          vb = returnMap.get(String(b.id))?.totalReturn ?? null;
          break;
        case 'location':
          va = ext_a?.location ?? null; vb = ext_b?.location ?? null; break;
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
  }, [items, sortKey, sortDir, returnMap]);

  // Handle inline field update
  const handleFieldUpdate = useCallback(async (
    itemId: string,
    field: string,
    value: unknown
  ) => {
    await onItemUpdate(itemId, { [field]: value });
  }, [onItemUpdate]);

  // Handle currency cell update (amount + currency in one call)
  const handleCurrencyUpdate = useCallback(async (
    itemId: string,
    amountField: string,
    currencyField: string,
    amount: number | null,
    currency: string
  ) => {
    await onItemUpdate(itemId, { [amountField]: amount, [currencyField]: currency });
  }, [onItemUpdate]);

  // Toggle expense ledger
  const toggleExpenseLedger = useCallback((itemId: string) => {
    setExpandedItemId(prev => prev === itemId ? null : itemId);
  }, []);

  // Sort header arrow — plain function (not a component) to avoid new identity each render
  const sortArrow = (column: SortKey) => {
    if (sortKey !== column) return null;
    return (
      <span className="ml-0.5 text-gold">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/30">
              {Array.from({ length: 11 }).map((_, i) => (
                <th key={i} className="py-2 px-2">
                  <div className="h-3 bg-surface-elevated rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/10">
                {Array.from({ length: 11 }).map((_, j) => (
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
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-muted/30 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
          </svg>
        </div>
        <p className="text-[13px] text-muted/60 mb-1">{t('vault.table.emptyTitle')}</p>
        <p className="text-[11px] text-muted/40">{t('vault.table.emptyDescription')}</p>
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
              <th className="py-2 px-2 w-[44px]"></th>
              <th className={headerClass} onClick={() => handleSort('title')}>
                {t('vault.table.title')}{sortArrow('title')}
              </th>
              <th className={headerClass} onClick={() => handleSort('type')}>
                {t('vault.table.type')}{sortArrow('type')}
              </th>
              <th className={headerClass} onClick={() => handleSort('cert')}>
                {t('vault.table.cert')}{sortArrow('cert')}
              </th>
              <th className={headerClass} onClick={() => handleSort('attribution')}>
                {t('vault.table.attribution')}{sortArrow('attribution')}
              </th>
              <th className={`${headerClass} w-[120px]`} onClick={() => handleSort('purchase_date')}>
                {t('vault.table.purchaseDate')}{sortArrow('purchase_date')}
              </th>
              <th className={`${headerClass} w-[140px]`} onClick={() => handleSort('paid')}>
                {t('vault.table.paid')}{sortArrow('paid')}
              </th>
              <th className={`${headerClass} w-[140px]`} onClick={() => handleSort('current_value')}>
                {t('vault.table.currentValue')}{sortArrow('current_value')}
              </th>
              <th className={`${headerClass} w-[100px]`} onClick={() => handleSort('invested')}>
                {t('vault.table.invested')}{sortArrow('invested')}
              </th>
              <th className={`${headerClass} w-[130px]`} onClick={() => handleSort('return')}>
                {t('vault.table.return')}{sortArrow('return')}
              </th>
              <th className={`${headerClass} w-[120px]`} onClick={() => handleSort('location')}>
                {t('vault.table.location')}{sortArrow('location')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(item => {
              const ext = item.collection;
              const itemId = String(item.id);
              const isExpanded = expandedItemId === itemId;
              const attribution = getAttributionName(item) || item.artisan_display_name || null;
              const certInfo = item.cert_type ? CERT_LABELS[item.cert_type] : null;
              const thumbUrl = item.stored_images?.[0] || (item.images && item.images.length > 0 ? item.images[0] : null);

              return (
                <TableItemRow
                  key={itemId}
                  item={item}
                  itemId={itemId}
                  ext={ext}
                  isExpanded={isExpanded}
                  attribution={attribution}
                  certInfo={certInfo}
                  thumbUrl={thumbUrl}
                  defaultCurrency={defaultCurrency}
                  locale={locale}
                  t={t}
                  onCardClick={onCardClick}
                  onFieldUpdate={handleFieldUpdate}
                  onCurrencyUpdate={handleCurrencyUpdate}
                  toggleExpenseLedger={toggleExpenseLedger}
                  onExpenseTotalsChange={onExpenseTotalsChange}
                  returnData={returnMap.get(itemId)}
                  homeCurrency={homeCurrency}
                  isLoadingReturns={isLoadingReturns}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <VaultTableFooter
        items={items}
        returnMap={returnMap}
        homeCurrency={homeCurrency}
        isLoadingReturns={isLoadingReturns}
      />
    </div>
  );
}

// =============================================================================
// TableItemRow (extracted to avoid re-renders of entire table)
// =============================================================================

interface TableItemRowProps {
  item: DisplayItem;
  itemId: string;
  ext: DisplayItem['collection'];
  isExpanded: boolean;
  attribution: string | null;
  certInfo: { label: string; shortLabel: string; tier: string } | null;
  thumbUrl: string | null;
  defaultCurrency: string;
  locale: 'en' | 'ja';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string;
  onCardClick: (item: DisplayItem) => void;
  onFieldUpdate: (itemId: string, field: string, value: unknown) => Promise<void>;
  onCurrencyUpdate: (itemId: string, amountField: string, currencyField: string, amount: number | null, currency: string) => Promise<void>;
  toggleExpenseLedger: (itemId: string) => void;
  onExpenseTotalsChange: (itemUuid: string, totals: Record<string, number>) => void;
  returnData: ItemReturnData | undefined;
  homeCurrency: string;
  isLoadingReturns: boolean;
}

function TableItemRow({
  item,
  itemId,
  ext,
  isExpanded,
  attribution,
  certInfo,
  thumbUrl,
  defaultCurrency,
  locale,
  t,
  onCardClick,
  onFieldUpdate,
  onCurrencyUpdate,
  toggleExpenseLedger,
  onExpenseTotalsChange,
  returnData,
  homeCurrency,
  isLoadingReturns,
}: TableItemRowProps) {
  const hasCurrentValue = ext?.current_value != null;
  const totalInvested = ext?.total_invested;

  return (
    <>
      <tr className="border-b border-border/10 hover:bg-surface-elevated/30 transition-colors">
        {/* Thumbnail */}
        <td className="py-1.5 px-2">
          <button
            onClick={() => onCardClick(item)}
            className="block w-[40px] h-[40px] rounded overflow-hidden bg-surface-elevated flex-shrink-0 hover:ring-1 hover:ring-gold/30 transition-all"
          >
            {thumbUrl ? (
              <Image
                src={thumbUrl}
                alt=""
                width={40}
                height={40}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </button>
        </td>

        {/* Title (read-only, click opens QuickView) */}
        <td className="py-1.5 px-2 max-w-[200px]">
          <button
            onClick={() => onCardClick(item)}
            className="text-left text-[12px] text-ink hover:text-gold transition-colors line-clamp-2 leading-tight"
          >
            {item.title || t('vault.table.untitled')}
          </button>
        </td>

        {/* Type pill */}
        <td className="py-1.5 px-2">
          <span className="text-[10px] text-muted/70 bg-surface-elevated px-1.5 py-0.5 rounded whitespace-nowrap">
            {getItemTypeLabel(item.item_type)}
          </span>
        </td>

        {/* Certification badge */}
        <td className="py-1.5 px-2">
          {certInfo ? (
            <span className={`text-[10px] font-medium ${getCertTierClass(certInfo.tier as import('@/lib/collection/labels').CertTier)}`}>
              {certInfo.shortLabel}
            </span>
          ) : (
            <span className="text-[10px] text-muted/30">—</span>
          )}
        </td>

        {/* Attribution (read-only) */}
        <td className="py-1.5 px-2 max-w-[150px]">
          <span className="text-[11px] text-muted/70 truncate block">
            {attribution || <span className="text-muted/30">—</span>}
          </span>
        </td>

        {/* Purchase Date (editable) */}
        <td className="py-1.5 px-1">
          <InlineDateCell
            value={ext?.purchase_date ?? null}
            onSave={(v) => onFieldUpdate(itemId, 'purchase_date', v)}
          />
        </td>

        {/* Paid / Purchase Price (editable) */}
        <td className="py-1.5 px-1">
          <InlineCurrencyCell
            amount={ext?.purchase_price ?? null}
            currency={ext?.purchase_currency ?? null}
            defaultCurrency={defaultCurrency}
            onSave={(amount, currency) =>
              onCurrencyUpdate(itemId, 'purchase_price', 'purchase_currency', amount, currency)
            }
          />
        </td>

        {/* Current Value (editable) */}
        <td className="py-1.5 px-1">
          <div className={!hasCurrentValue ? 'ring-1 ring-amber-300/30 rounded' : ''}>
            <InlineCurrencyCell
              amount={ext?.current_value ?? null}
              currency={ext?.current_currency ?? null}
              defaultCurrency={defaultCurrency}
              onSave={(amount, currency) =>
                onCurrencyUpdate(itemId, 'current_value', 'current_currency', amount, currency)
              }
            />
          </div>
        </td>

        {/* Invested (computed, click to expand expense ledger) */}
        <td className="py-1.5 px-2">
          <button
            onClick={() => toggleExpenseLedger(itemId)}
            className={`text-[12px] w-full transition-colors group flex items-center gap-1 ${
              isExpanded
                ? 'text-gold'
                : totalInvested != null
                  ? 'text-ink hover:text-gold'
                  : 'text-muted/40 hover:text-gold'
            }`}
            title={t('vault.table.clickToExpand')}
          >
            {totalInvested != null ? (
              <span className="tabular-nums text-right flex-1">
                {formatPrice(totalInvested, ext?.purchase_currency || defaultCurrency, locale)}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[11px]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('vault.expense.expenses')}
              </span>
            )}
            <svg
              className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              } ${isExpanded ? 'text-gold' : 'text-muted/20 group-hover:text-gold/50'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </td>

        {/* Return (computed, click for decomposition popover) */}
        <td className="py-1.5 px-2">
          {isLoadingReturns ? (
            <div className="h-3 w-16 bg-surface-elevated rounded animate-pulse" />
          ) : returnData ? (
            <ReturnBreakdownPopover
              returnData={returnData}
              homeCurrency={homeCurrency}
            />
          ) : (
            <span className="text-muted/30 text-[12px]">—</span>
          )}
        </td>

        {/* Location (editable) */}
        <td className="py-1.5 px-1">
          <InlineTextCell
            value={ext?.location ?? null}
            onSave={(v) => onFieldUpdate(itemId, 'location', v)}
            placeholder={t('vault.table.locationPlaceholder')}
          />
        </td>
      </tr>

      {/* Expense ledger (inline sub-row) */}
      {isExpanded && (
        <tr>
          <td colSpan={11} className="p-0">
            <ExpenseLedger
              itemId={itemId}
              purchasePrice={ext?.purchase_price ?? null}
              purchaseCurrency={ext?.purchase_currency ?? null}
              defaultCurrency={defaultCurrency}
              onTotalChange={(totals) => onExpenseTotalsChange(itemId, totals)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
