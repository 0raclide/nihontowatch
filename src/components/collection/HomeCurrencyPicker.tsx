'use client';

import { useLocale } from '@/i18n/LocaleContext';

const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'GBP', 'CAD', 'CHF'];

interface HomeCurrencyPickerProps {
  value: string;
  onChange: (currency: string) => Promise<void>;
  isLoading?: boolean;
}

export function HomeCurrencyPicker({ value, onChange, isLoading }: HomeCurrencyPickerProps) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-muted/50 uppercase tracking-wider">
        {t('vault.table.homeCurrency')}:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="bg-surface-elevated border border-border/30 rounded px-1.5 py-0.5 text-[11px] text-ink cursor-pointer hover:border-gold/40 transition-colors focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:opacity-50"
      >
        {CURRENCIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
