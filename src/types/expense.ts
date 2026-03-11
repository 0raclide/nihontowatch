/**
 * Collection expense types.
 *
 * Tracks per-item expenses for the vault expense ledger.
 */

export interface CollectionExpense {
  id: string;
  item_id: string;
  owner_id: string;
  expense_date: string | null;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Valid expense categories.
 * 14 categories covering typical nihonto/tosogu ownership costs.
 */
export const EXPENSE_CATEGORIES = [
  'polish',
  'habaki',
  'shirasaya',
  'sayagaki',
  'koshirae',
  'restoration',
  'mounting',
  'shinsa',
  'shinsa_broker',
  'shipping',
  'insurance',
  'appraisal',
  'photography',
  'storage',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Display labels for expense categories (EN).
 * JA labels are in i18n/locales/ja.json under vault.expense.category.*.
 */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  polish: 'Polish',
  habaki: 'Habaki',
  shirasaya: 'Shirasaya',
  sayagaki: 'Sayagaki',
  koshirae: 'Koshirae',
  restoration: 'Restoration',
  mounting: 'Mounting',
  shinsa: 'Shinsa',
  shinsa_broker: 'Shinsa Broker',
  shipping: 'Shipping',
  insurance: 'Insurance',
  appraisal: 'Appraisal',
  photography: 'Photography',
  storage: 'Storage',
  other: 'Other',
};
