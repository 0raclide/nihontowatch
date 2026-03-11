'use client';

import { useMemo } from 'react';
import type { DisplayItem } from '@/types/displayItem';
import { useLocale } from '@/i18n/LocaleContext';
import { formatPrice } from '@/lib/collection/labels';

interface VaultTableFooterProps {
  items: DisplayItem[];
}

/**
 * Footer row showing total declared value, grouped by currency.
 * Only sums `current_value` from collection extension (not purchase_price).
 */
export function VaultTableFooter({ items }: VaultTableFooterProps) {
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

  if (!totals) {
    return (
      <div className="mt-3 px-2 py-2 text-[11px] text-muted/50 italic">
        {t('vault.table.noValuesSet')}
      </div>
    );
  }

  return (
    <div className="mt-3 px-2 py-2 flex items-center gap-2 text-[12px]">
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
  );
}
