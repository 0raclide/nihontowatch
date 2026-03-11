'use client';

import { useMemo } from 'react';
import type { DisplayItem } from '@/types/displayItem';
import { useLocale } from '@/i18n/LocaleContext';
import { formatPrice } from '@/lib/collection/labels';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';
import { computePortfolioTotals } from '@/lib/fx/financialCalculator';

interface VaultTableFooterProps {
  items: DisplayItem[];
  returnMap: Map<string, ItemReturnData>;
  homeCurrency: string;
  isLoadingReturns: boolean;
}

/**
 * Footer row showing total declared value, grouped by currency,
 * plus portfolio-level return summary in home currency.
 */
export function VaultTableFooter({ items, returnMap, homeCurrency, isLoadingReturns }: VaultTableFooterProps) {
  const { t, locale } = useLocale();

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    let hasAnyValue = false;

    for (const item of items) {
      const ext = item.collection;
      if (!ext) continue;
      const val = ext.current_value;
      const cur = ext.current_currency || 'JPY';
      if (val != null && val > 0) {
        hasAnyValue = true;
        byCurrency.set(cur, (byCurrency.get(cur) || 0) + val);
      }
    }

    if (!hasAnyValue) return null;

    return Array.from(byCurrency.entries())
      .sort((a, b) => b[1] - a[1]) // Largest total first
      .map(([currency, total]) => ({
        currency,
        total,
        formatted: formatPrice(total, currency, locale) || `${currency} ${total.toLocaleString()}`,
      }));
  }, [items, locale]);

  const portfolio = useMemo(
    () => returnMap.size > 0 ? computePortfolioTotals(returnMap) : null,
    [returnMap]
  );

  if (!totals) {
    return (
      <div className="mt-3 px-2 py-2 text-[11px] text-muted/50 italic">
        {t('vault.table.noValuesSet')}
      </div>
    );
  }

  const fmtHome = (v: number) => formatPrice(Math.abs(v), homeCurrency, locale) || '—';
  const sign = (v: number) => v >= 0 ? '+' : '-';
  const returnColor = (v: number) => v >= 0 ? 'text-green-500' : 'text-red-400';

  return (
    <div className="mt-3 px-2 py-2 space-y-1.5">
      {/* Original: total declared value by currency */}
      <div className="flex items-center gap-2 text-[12px]">
        <span className="text-muted/60 uppercase tracking-wider text-[10px]">
          {t('vault.table.totalDeclaredValue')}:
        </span>
        <span className="text-ink font-medium tabular-nums">
          {totals.map((t, i) => (
            <span key={t.currency}>
              {i > 0 && <span className="text-muted/40 mx-1">+</span>}
              {t.formatted}
            </span>
          ))}
        </span>
      </div>

      {/* Portfolio summary in home currency */}
      {isLoadingReturns ? (
        <div className="flex items-center gap-2 text-[11px] text-muted/40">
          <span className="uppercase tracking-wider text-[10px]">
            {t('vault.return.loadingRates')}
          </span>
        </div>
      ) : portfolio && portfolio.itemsWithData > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="text-muted/60 uppercase tracking-wider text-[10px]">
              {t('vault.return.portfolioValue')} ({homeCurrency}):
            </span>
            <span className="text-ink tabular-nums">
              {formatPrice(portfolio.totalValueHome, homeCurrency, locale)}
            </span>
            <span className="text-muted/30">|</span>
            <span className="text-muted/60 text-[10px]">{t('vault.return.totalInvested')}:</span>
            <span className="text-ink tabular-nums">
              {formatPrice(portfolio.totalInvestedHome, homeCurrency, locale)}
            </span>
            <span className="text-muted/30">|</span>
            <span className="text-muted/60 text-[10px]">{t('vault.return.totalReturn')}:</span>
            <span className={`tabular-nums font-medium ${returnColor(portfolio.totalReturn)}`}>
              {sign(portfolio.totalReturn)}{fmtHome(portfolio.totalReturn)}
              {portfolio.totalReturnPct != null && (
                <span className="ml-1 font-normal">
                  ({sign(portfolio.totalReturnPct)}{Math.abs(portfolio.totalReturnPct).toFixed(1)}%)
                </span>
              )}
            </span>
          </div>

          {/* Decomposition row */}
          {portfolio.hasDecomposition && (
            <div className="flex items-center gap-3 text-[10px] text-muted/50 flex-wrap pl-0">
              <span className="w-[1px]" /> {/* align with label above */}
              <span>{t('vault.return.assetReturn')}:</span>
              <span className={`tabular-nums ${returnColor(portfolio.totalAssetReturn)}`}>
                {sign(portfolio.totalAssetReturn)}{fmtHome(portfolio.totalAssetReturn)}
              </span>
              <span className="text-muted/20">|</span>
              <span>{t('vault.return.fxImpact')}:</span>
              <span className={`tabular-nums ${returnColor(portfolio.totalFxImpact)}`}>
                {sign(portfolio.totalFxImpact)}{fmtHome(portfolio.totalFxImpact)}
              </span>
              <span className="text-muted/20">|</span>
              <span>{t('vault.return.expenses')}:</span>
              <span className={`tabular-nums ${returnColor(portfolio.totalExpenseDrag)}`}>
                {sign(portfolio.totalExpenseDrag)}{fmtHome(portfolio.totalExpenseDrag)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
