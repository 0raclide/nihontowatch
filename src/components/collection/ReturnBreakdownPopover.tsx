'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { formatPrice } from '@/lib/collection/labels';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';

interface ReturnBreakdownPopoverProps {
  returnData: ItemReturnData;
  homeCurrency: string;
}

export function ReturnBreakdownPopover({ returnData, homeCurrency }: ReturnBreakdownPopoverProps) {
  const { t, locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (returnData.totalReturn == null) {
    return <span className="text-muted/30">—</span>;
  }

  const isPositive = returnData.totalReturn >= 0;
  const sign = isPositive ? '+' : '';
  const colorClass = isPositive ? 'text-green-500' : 'text-red-400';
  const formatted = formatPrice(Math.abs(returnData.totalReturn), homeCurrency, locale) || '—';
  const pct = returnData.totalReturnPct != null
    ? `(${sign}${returnData.totalReturnPct.toFixed(1)}%)`
    : '';

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-[12px] tabular-nums ${colorClass} hover:underline`}
      >
        {sign}{formatted} {pct}
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 top-full mt-1 bg-surface border border-border/40 rounded-lg shadow-lg p-3 min-w-[220px] text-[11px]">
          {returnData.canDecompose ? (
            <div className="space-y-1.5">
              <Row
                label={t('vault.return.assetReturn')}
                value={returnData.assetReturn}
                currency={homeCurrency}
                locale={locale}
              />
              <Row
                label={t('vault.return.fxImpact')}
                value={returnData.fxImpact}
                currency={homeCurrency}
                locale={locale}
              />
              <Row
                label={t('vault.return.expenses')}
                value={returnData.expenseDrag}
                currency={homeCurrency}
                locale={locale}
              />
              <div className="border-t border-border/30 my-1.5" />
              <Row
                label={t('vault.return.totalReturn')}
                value={returnData.totalReturn}
                currency={homeCurrency}
                locale={locale}
                bold
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Row
                label={t('vault.return.totalReturn')}
                value={returnData.totalReturn}
                currency={homeCurrency}
                locale={locale}
                bold
              />
              <p className="text-muted/40 text-[10px] mt-1 italic">
                {t('vault.return.mixedCurrencies')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  locale,
  bold,
}: {
  label: string;
  value: number | null;
  currency: string;
  locale: 'en' | 'ja';
  bold?: boolean;
}) {
  if (value == null) return null;

  const isPositive = value >= 0;
  const sign = isPositive ? '+' : '';
  const colorClass = value === 0
    ? 'text-muted/60'
    : isPositive
      ? 'text-green-500'
      : 'text-red-400';
  const formatted = formatPrice(Math.abs(value), currency, locale) || '—';
  const weightClass = bold ? 'font-medium' : '';

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-muted/60 ${weightClass}`}>{label}</span>
      <span className={`tabular-nums ${colorClass} ${weightClass}`}>
        {sign}{formatted}
      </span>
    </div>
  );
}
