'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// =============================================================================
// Shared debounce save logic
// =============================================================================

const DEBOUNCE_MS = 800;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebouncedSave(onSave: (value: any) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback((value: unknown) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSave(value);
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_MS);
  }, [onSave]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { save, cancel, isSaving };
}

// =============================================================================
// InlineTextCell
// =============================================================================

interface InlineTextCellProps {
  value: string | null;
  onSave: (value: string | null) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export function InlineTextCell({ value, onSave, placeholder, maxLength = 500, className = '' }: InlineTextCellProps) {
  const [localValue, setLocalValue] = useState(value || '');
  const [originalValue] = useState(value || '');
  const { save, cancel, isSaving } = useDebouncedSave(onSave);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim() || null;
    if (trimmed !== (value || null)) {
      save(trimmed);
    }
  }, [localValue, value, save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel();
      setLocalValue(originalValue);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Tab') {
      handleBlur();
    }
  }, [cancel, originalValue, handleBlur]);

  const isEmpty = !localValue.trim();

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value.slice(0, maxLength))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`w-full bg-transparent text-[12px] text-ink px-1.5 py-1 rounded border transition-all
        ${isEmpty ? 'border-dashed border-amber-400/50' : 'border-transparent'}
        hover:border-border/50 focus:border-gold/50 focus:outline-none
        ${isSaving ? 'opacity-60' : ''}
        ${className}`}
    />
  );
}

// =============================================================================
// InlineDateCell
// =============================================================================

interface InlineDateCellProps {
  value: string | null;
  onSave: (value: string | null) => void;
  className?: string;
}

export function InlineDateCell({ value, onSave, className = '' }: InlineDateCellProps) {
  const [localValue, setLocalValue] = useState(value || '');
  const [originalValue] = useState(value || '');
  const { save, cancel, isSaving } = useDebouncedSave(onSave);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim() || null;
    if (trimmed !== (value || null)) {
      save(trimmed);
    }
  }, [localValue, value, save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel();
      setLocalValue(originalValue);
      (e.target as HTMLInputElement).blur();
    }
  }, [cancel, originalValue]);

  const isEmpty = !localValue;

  return (
    <input
      type="date"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        // Date inputs commit on change, not blur
        const v = e.target.value || null;
        if (v !== (value || null)) save(v);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`w-full bg-transparent text-[12px] text-ink px-1.5 py-1 rounded border transition-all
        ${isEmpty ? 'border-dashed border-amber-400/50' : 'border-transparent'}
        hover:border-border/50 focus:border-gold/50 focus:outline-none
        ${isSaving ? 'opacity-60' : ''}
        ${className}`}
    />
  );
}

// =============================================================================
// InlineCurrencyCell
// =============================================================================

const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'GBP', 'CAD', 'CHF'] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  JPY: '¥', USD: '$', EUR: '€', AUD: 'A$', GBP: '£', CAD: 'C$', CHF: 'Fr',
};

interface InlineCurrencyCellProps {
  amount: number | null;
  currency: string | null;
  defaultCurrency?: string;
  onSave: (amount: number | null, currency: string) => void;
  className?: string;
}

export function InlineCurrencyCell({
  amount,
  currency,
  defaultCurrency = 'JPY',
  onSave,
  className = '',
}: InlineCurrencyCellProps) {
  const effectiveCurrency = currency || defaultCurrency;
  const [localAmount, setLocalAmount] = useState(amount != null ? String(amount) : '');
  const [localCurrency, setLocalCurrency] = useState(effectiveCurrency);
  const [originalAmount] = useState(amount != null ? String(amount) : '');
  const { save, cancel, isSaving } = useDebouncedSave(
    (val: unknown) => {
      const { a, c } = val as { a: number | null; c: string };
      onSave(a, c);
    }
  );

  useEffect(() => {
    setLocalAmount(amount != null ? String(amount) : '');
    setLocalCurrency(currency || defaultCurrency);
  }, [amount, currency, defaultCurrency]);

  const handleAmountBlur = useCallback(() => {
    const num = localAmount.trim() ? Number(localAmount.replace(/,/g, '')) : null;
    const validNum = (num != null && !isNaN(num) && num >= 0) ? num : null;
    if (validNum !== amount || localCurrency !== effectiveCurrency) {
      save({ a: validNum, c: localCurrency });
    }
  }, [localAmount, localCurrency, amount, effectiveCurrency, save]);

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setLocalCurrency(newCurrency);
    const num = localAmount.trim() ? Number(localAmount.replace(/,/g, '')) : null;
    const validNum = (num != null && !isNaN(num) && num >= 0) ? num : null;
    save({ a: validNum, c: newCurrency });
  }, [localAmount, save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel();
      setLocalAmount(originalAmount);
      setLocalCurrency(effectiveCurrency);
      (e.target as HTMLInputElement).blur();
    }
  }, [cancel, originalAmount, effectiveCurrency]);

  const isEmpty = !localAmount.trim();
  const symbol = CURRENCY_SYMBOLS[localCurrency] || localCurrency;

  return (
    <div className={`flex items-center gap-0.5 ${isSaving ? 'opacity-60' : ''} ${className}`}>
      <span className="text-[10px] text-muted/60 shrink-0">{symbol}</span>
      <input
        type="text"
        inputMode="numeric"
        value={localAmount}
        onChange={(e) => setLocalAmount(e.target.value)}
        onBlur={handleAmountBlur}
        onKeyDown={handleKeyDown}
        placeholder="—"
        className={`w-full bg-transparent text-[12px] text-ink text-right px-1 py-1 rounded border transition-all tabular-nums
          ${isEmpty ? 'border-dashed border-amber-400/50' : 'border-transparent'}
          hover:border-border/50 focus:border-gold/50 focus:outline-none`}
      />
      <select
        value={localCurrency}
        onChange={handleCurrencyChange}
        className="bg-transparent text-[10px] text-muted/60 cursor-pointer border-none outline-none appearance-none shrink-0"
      >
        {CURRENCIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
