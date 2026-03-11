'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CollectionExpense } from '@/types/expense';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/types/expense';
import { useLocale } from '@/i18n/LocaleContext';
import { formatPrice } from '@/lib/collection/labels';

// =============================================================================
// Types
// =============================================================================

interface ExpenseLedgerProps {
  itemId: string;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  defaultCurrency: string;
  onTotalChange?: (totals: Record<string, number>) => void;
}

const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'GBP', 'CAD', 'CHF'] as const;

/** Compute { [currency]: totalAmount } from an expense list (excludes purchase price). */
function computeExpenseTotals(expenses: CollectionExpense[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const exp of expenses) {
    if (exp.amount > 0) {
      const c = exp.currency.toUpperCase();
      totals[c] = (totals[c] || 0) + exp.amount;
    }
  }
  return totals;
}

// =============================================================================
// Component
// =============================================================================

export function ExpenseLedger({
  itemId,
  purchasePrice,
  purchaseCurrency,
  defaultCurrency,
  onTotalChange,
}: ExpenseLedgerProps) {
  const { t, locale } = useLocale();
  const [expenses, setExpenses] = useState<CollectionExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch expenses on mount
  useEffect(() => {
    let cancelled = false;

    async function fetch_() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/collection/items/${itemId}/expenses`);
        if (!res.ok) throw new Error('Failed to fetch expenses');
        const data = await res.json();
        if (!cancelled) setExpenses(data.expenses || []);
      } catch {
        if (!cancelled) setError('Failed to load expenses');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  }, [itemId]);

  // Add new expense
  const handleAdd = useCallback(async () => {
    try {
      const res = await fetch(`/api/collection/items/${itemId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'other',
          amount: 0,
          currency: purchaseCurrency || defaultCurrency,
        }),
      });
      if (!res.ok) throw new Error('Failed to create expense');
      const expense = await res.json();
      setExpenses(prev => {
        const next = [expense, ...prev];
        onTotalChange?.(computeExpenseTotals(next));
        return next;
      });
    } catch {
      setError('Failed to add expense');
    }
  }, [itemId, purchaseCurrency, defaultCurrency, onTotalChange]);

  // Update expense field
  const handleUpdate = useCallback(async (
    expenseId: string,
    field: string,
    value: unknown
  ) => {
    // Optimistic update + report new totals locally
    setExpenses(prev => {
      const next = prev.map(e =>
        e.id === expenseId ? { ...e, [field]: value } : e
      );
      if (field === 'amount' || field === 'currency') {
        onTotalChange?.(computeExpenseTotals(next as CollectionExpense[]));
      }
      return next;
    });

    try {
      const res = await fetch(
        `/api/collection/items/${itemId}/expenses/${expenseId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        }
      );
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setExpenses(prev => prev.map(e => e.id === expenseId ? updated : e));
    } catch {
      // Revert on failure would need original state — not critical for MVP
    }
  }, [itemId, onTotalChange]);

  // Delete expense
  const handleDelete = useCallback(async (expenseId: string) => {
    setExpenses(prev => {
      const next = prev.filter(e => e.id !== expenseId);
      onTotalChange?.(computeExpenseTotals(next));
      return next;
    });
    try {
      await fetch(
        `/api/collection/items/${itemId}/expenses/${expenseId}`,
        { method: 'DELETE' }
      );
    } catch {
      // Re-fetch on failure
      const res = await fetch(`/api/collection/items/${itemId}/expenses`);
      if (res.ok) {
        const data = await res.json();
        const fetched = data.expenses || [];
        setExpenses(fetched);
        onTotalChange?.(computeExpenseTotals(fetched));
      }
    }
  }, [itemId, onTotalChange]);

  // Compute total grouped by currency
  const totals = new Map<string, number>();
  if (purchasePrice != null) {
    const pc = (purchaseCurrency || defaultCurrency).toUpperCase();
    totals.set(pc, (totals.get(pc) || 0) + purchasePrice);
  }
  for (const exp of expenses) {
    if (exp.amount > 0) {
      const c = exp.currency.toUpperCase();
      totals.set(c, (totals.get(c) || 0) + exp.amount);
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 py-3 text-[11px] text-muted/50 animate-pulse">
        {t('common.loading')}...
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-surface-elevated/50 border-t border-border/20">
      {error && (
        <div className="mb-2 text-[11px] text-error">{error}</div>
      )}

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted/50 uppercase tracking-wider text-[9px]">
            <th className="text-left py-1 pr-2 font-medium">{t('vault.expense.date')}</th>
            <th className="text-left py-1 pr-2 font-medium">{t('vault.expense.category')}</th>
            <th className="text-right py-1 pr-2 font-medium">{t('vault.expense.amount')}</th>
            <th className="text-left py-1 pr-2 font-medium">{t('vault.expense.vendor')}</th>
            <th className="text-left py-1 pr-2 font-medium">{t('vault.expense.notes')}</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {/* Purchase price as first immutable row */}
          {purchasePrice != null && (
            <tr className="text-muted/70 border-b border-border/10">
              <td className="py-1.5 pr-2">—</td>
              <td className="py-1.5 pr-2 italic">{t('vault.expense.purchase')}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatPrice(purchasePrice, purchaseCurrency || defaultCurrency, locale)}
              </td>
              <td className="py-1.5 pr-2">—</td>
              <td className="py-1.5 pr-2">—</td>
              <td></td>
            </tr>
          )}

          {/* Expense rows */}
          {expenses.map(expense => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              locale={locale}
            />
          ))}
        </tbody>
      </table>

      {/* Add expense button */}
      <button
        onClick={handleAdd}
        className="mt-2 text-[11px] text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('vault.expense.addExpense')}
      </button>

      {/* Totals */}
      {totals.size > 0 && (
        <div className="mt-3 pt-2 border-t border-border/20 flex items-center gap-2">
          <span className="text-[10px] text-muted/50 uppercase tracking-wider">
            {t('vault.expense.totalInvested')}:
          </span>
          <span className="text-[12px] text-ink font-medium tabular-nums">
            {Array.from(totals.entries()).map(([cur, total], i) => (
              <span key={cur}>
                {i > 0 && <span className="text-muted/40 mx-1">+</span>}
                {formatPrice(total, cur, locale)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ExpenseRow
// =============================================================================

interface ExpenseRowProps {
  expense: CollectionExpense;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onDelete: (id: string) => void;
  locale: 'en' | 'ja';
}

function ExpenseRow({ expense, onUpdate, onDelete, locale }: ExpenseRowProps) {
  const { t } = useLocale();
  const [amount, setAmount] = useState(String(expense.amount || ''));
  const debounceRef = { current: null as ReturnType<typeof setTimeout> | null };

  const debouncedUpdate = useCallback((field: string, value: unknown) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate(expense.id, field, value), 800);
  }, [expense.id, onUpdate]);

  return (
    <tr className="border-b border-border/10 hover:bg-surface-elevated/30">
      <td className="py-1 pr-2">
        <input
          type="date"
          value={expense.expense_date || ''}
          onChange={(e) => onUpdate(expense.id, 'expense_date', e.target.value || null)}
          className="bg-transparent text-[11px] text-ink border-none outline-none w-[110px]"
        />
      </td>
      <td className="py-1 pr-2">
        <select
          value={expense.category}
          onChange={(e) => onUpdate(expense.id, 'category', e.target.value)}
          className="bg-transparent text-[11px] text-ink border-none outline-none cursor-pointer"
        >
          {EXPENSE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {t(`vault.expense.category.${cat}`) || EXPENSE_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1 pr-2">
        <div className="flex items-center gap-0.5 justify-end">
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              const num = Number(e.target.value.replace(/,/g, ''));
              if (!isNaN(num) && num >= 0) debouncedUpdate('amount', num);
            }}
            className="bg-transparent text-[11px] text-ink text-right w-[80px] border-none outline-none tabular-nums"
          />
          <select
            value={expense.currency}
            onChange={(e) => onUpdate(expense.id, 'currency', e.target.value)}
            className="bg-transparent text-[9px] text-muted/60 border-none outline-none cursor-pointer"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </td>
      <td className="py-1 pr-2">
        <input
          type="text"
          value={expense.vendor || ''}
          onChange={(e) => debouncedUpdate('vendor', e.target.value || null)}
          placeholder="—"
          className="bg-transparent text-[11px] text-ink w-full border-none outline-none"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type="text"
          value={expense.notes || ''}
          onChange={(e) => debouncedUpdate('notes', e.target.value || null)}
          placeholder="—"
          className="bg-transparent text-[11px] text-ink w-full border-none outline-none"
        />
      </td>
      <td className="py-1">
        <button
          onClick={() => onDelete(expense.id)}
          className="text-muted/30 hover:text-error transition-colors p-0.5"
          title={t('common.delete')}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
