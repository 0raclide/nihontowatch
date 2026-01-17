'use client';

type Currency = 'USD' | 'JPY' | 'EUR';

interface CurrencySelectorProps {
  value: Currency;
  onChange: (currency: Currency) => void;
}

const CURRENCY_CONFIG: Record<Currency, { symbol: string; label: string }> = {
  USD: { symbol: '$', label: 'USD' },
  JPY: { symbol: '¥', label: 'JPY' },
  EUR: { symbol: '€', label: 'EUR' },
};

export function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  return (
    <div className="inline-flex items-center bg-linen/50 p-0.5 rounded-sm">
      {(Object.keys(CURRENCY_CONFIG) as Currency[]).map((currency) => (
        <button
          key={currency}
          onClick={() => onChange(currency)}
          className={`px-2.5 py-1 text-[10px] tracking-wider transition-all duration-200 ${
            value === currency
              ? 'bg-paper text-ink shadow-sm'
              : 'text-muted hover:text-charcoal'
          }`}
        >
          {CURRENCY_CONFIG[currency].label}
        </button>
      ))}
    </div>
  );
}
