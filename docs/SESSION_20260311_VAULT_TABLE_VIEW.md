# Vault Table View — Session Handoff

> **Date:** 2026-03-11
> **Status:** Phase 1 DONE — table view, expense ledger, historical forex, all CRUD endpoints deployed
> **Tests:** 57 new tests (4 files), all passing. Build clean. `tsc --noEmit` clean.

## What Was Built

A **spreadsheet-mode table view** for the `/vault` page, replacing the #1 reason collectors keep using spreadsheets outside the app. Desktop-only (mobile stays grid/gallery). Includes inline-editable financial columns, a per-item expense ledger, and multi-currency support with historical forex conversion.

This is **Phase 1 of 5** from `docs/VAULT_COMPETITIVE_ANALYSIS.md`.

## Architecture Decisions

1. **Custom HTML `<table>`** — no @tanstack/react-table. Consistent with existing SearchTermsTable, SegmentDetailTable.
2. **Desktop-only** — table view hidden on mobile (`hidden lg:block` on VaultViewToggle). Mobile stays grid/gallery.
3. **Same data fetch** — reuses existing `fetchItems()`. New columns come through `select('*')` automatically from the 7 new DB columns.
4. **Debounce pattern** — 800ms auto-save on blur, matching dealer profile (DealerProfileClient.tsx).
5. **Separate view toggle** — `nihontowatch-vault-view` localStorage key (distinct from mobile gallery/grid key).
6. **Store raw, display converted** — DB stores original currency/amount. Display converts to home currency using historical rate from purchase date via Frankfurter API.
7. **Expense total_invested = computed, never stored** — `purchase_price + SUM(expenses in same currency)`. Multi-currency expenses tracked separately (not auto-summed across currencies).

## Database Changes

### Migration 152: Financial Columns
```sql
ALTER TABLE collection_items ADD COLUMN purchase_price NUMERIC;
ALTER TABLE collection_items ADD COLUMN purchase_currency TEXT;
ALTER TABLE collection_items ADD COLUMN purchase_date DATE;
ALTER TABLE collection_items ADD COLUMN purchase_source TEXT;
ALTER TABLE collection_items ADD COLUMN current_value NUMERIC;
ALTER TABLE collection_items ADD COLUMN current_currency TEXT;
ALTER TABLE collection_items ADD COLUMN location TEXT;
```

All nullable, collection-only (NOT added to `ItemDataFields` or `SHARED_COLUMNS`). Added to `COLLECTION_ONLY_COLUMNS` in `itemData.ts`.

### Migration 153: Expense Ledger Table
```sql
CREATE TABLE collection_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  expense_date DATE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- RLS: owner CRUD + service role bypass (same pattern as collection_items)
- Indexes on `item_id` and `owner_id`
- ON DELETE CASCADE cleans up when item is deleted

## Key Files

### New Files (10)
| File | Purpose |
|------|---------|
| `supabase/migrations/152_collection_financial_columns.sql` | 7 financial columns on `collection_items` |
| `supabase/migrations/153_collection_expenses.sql` | `collection_expenses` table + RLS + indexes |
| `src/types/expense.ts` | `CollectionExpense` interface, `EXPENSE_CATEGORIES` (14), labels |
| `src/lib/supabase/collectionExpenses.ts` | Typed Supabase helpers: CRUD + `getExpenseTotals()` batch |
| `src/app/api/collection/items/[id]/expenses/route.ts` | GET (list) + POST (create) expenses |
| `src/app/api/collection/items/[id]/expenses/[expenseId]/route.ts` | PATCH + DELETE single expense |
| `src/components/collection/VaultViewToggle.tsx` | Desktop grid/table toggle (hidden lg:flex) |
| `src/components/collection/VaultTableView.tsx` | Main table: 10 columns, client sort, inline edit |
| `src/components/collection/InlineEditCell.tsx` | 3 variants: text, date, currency (800ms debounce) |
| `src/components/collection/ExpenseLedger.tsx` | Inline sub-row, fetches on expand, CRUD |
| `src/components/collection/VaultTableFooter.tsx` | Multi-currency total declared value |

### Modified Files (12)
| File | Change |
|------|--------|
| `src/types/collectionItem.ts` | 7 optional financial fields on `CollectionItemRow` |
| `src/types/itemData.ts` | 7 new entries in `COLLECTION_ONLY_COLUMNS` |
| `src/types/displayItem.ts` | `CollectionExtension` + financial fields + `total_invested` |
| `src/lib/displayItem/fromCollectionItem.ts` | Maps financial fields, `computeTotalInvested()`, `ExpenseTotalsMap` type |
| `src/lib/displayItem/index.ts` | Exports `ExpenseTotalsMap` |
| `src/app/api/collection/items/route.ts` | Returns `expenseTotals` in response, sorts by `current_value` |
| `src/app/api/collection/items/[id]/route.ts` | 7 fields in `ALLOWED_FIELDS`, validation for price/currency/date/text |
| `src/app/api/exchange-rates/route.ts` | `?date=YYYY-MM-DD` param → Frankfurter historical API, indefinite cache |
| `src/hooks/useCurrency.ts` | `fetchHistoricalRate(date, from, to)` with sessionStorage cache |
| `src/app/vault/CollectionPageClient.tsx` | Desktop view toggle, table view, `handleItemUpdate`, `expenseTotals` state |
| `src/i18n/locales/en.json` | ~40 keys under `vault.table.*` and `vault.expense.*` |
| `src/i18n/locales/ja.json` | ~40 keys (Japanese translations) |

## Table View Columns

| # | Column | Type | Editable | Notes |
|---|--------|------|----------|-------|
| 1 | Thumbnail | 40px image | Click→QuickView | Falls back to placeholder icon |
| 2 | Title | Text | Read-only, click→QuickView | Line-clamp-2 |
| 3 | Type | Pill badge | Read-only | Uses `getItemTypeLabel()` |
| 4 | Cert | Color badge | Read-only | 5-tier cert colors from `CERT_LABELS` |
| 5 | Attribution | Text | Read-only | `getAttributionName()` (dual-path) |
| 6 | Date | Date picker | Yes (InlineDateCell) | `purchase_date`, dashed amber border when empty |
| 7 | Paid | Currency input | Yes (InlineCurrencyCell) | `purchase_price` + `purchase_currency` |
| 8 | Value | Currency input | Yes (InlineCurrencyCell) | `current_value` + `current_currency`, amber ring when empty |
| 9 | Invested | Computed | Click→expand ledger | `purchase_price + SUM(same-currency expenses)`, ▼ indicator |
| 10 | Location | Text input | Yes (InlineTextCell) | `location`, dashed amber border when empty |

## Expense Categories (14)

`polish`, `habaki`, `shirasaya`, `koshirae`, `restoration`, `mounting`, `shinsa`, `shinsa_broker`, `shipping`, `insurance`, `appraisal`, `photography`, `storage`, `other`

## API Validation Rules

- `purchase_price` / `current_value`: must be non-negative numeric or null
- `purchase_currency` / `current_currency`: max 10 chars, uppercased
- `purchase_date`: must be `YYYY-MM-DD` format or null
- `purchase_source` / `location`: max 500 chars
- Expense `category`: must be in `EXPENSE_CATEGORIES` set
- Expense `amount`: must be > 0
- Max 100 expenses per item
- Expense `description` / `vendor`: max 500 chars
- Expense `notes`: max 1000 chars

## Historical Forex

- `/api/exchange-rates?date=2023-06-15` → Frankfurter historical API
- Historical rates cached indefinitely in memory (they never change)
- Client-side `fetchHistoricalRate()` uses sessionStorage as cache
- Max 1000 historical dates in server memory cache (prevents leaks)
- `useCurrency()` hook now returns `fetchHistoricalRate` in addition to existing `currency`, `setCurrency`, `exchangeRates`

## Tests (57 new)

| File | Tests | Coverage |
|------|-------|----------|
| `tests/api/collection/expenses.test.ts` | 9 | Categories, totals grouping, counting, validation |
| `tests/components/collection/VaultTableView.test.tsx` | 18 | Column rendering, attribution, cert badges, price formatting, sorting, footer |
| `tests/components/collection/InlineEditCell.test.tsx` | 17 | Amount parsing, date validation, currency codes, text sanitization |
| `tests/components/collection/ExpenseLedger.test.tsx` | 13 | Total computation, category labels, total_invested mapper logic |

## Known Gaps / Phase 2 Items

1. **Insurance report PDF** — Phase 2: generate PDF from `current_value` + images for insurance providers
2. **Gain/loss column** — Computed `current_value - total_invested`, needs historical forex for cross-currency
3. **Bulk edit** — Select multiple rows, set location/currency in batch
4. **Column visibility toggle** — Let users show/hide columns
5. **CSV export** — Export table data to spreadsheet
6. **Historical forex display** — Currently the `fetchHistoricalRate()` is wired up but the table view doesn't yet show converted amounts (original amounts shown as-is). Phase 2 can add tooltip showing "¥5,000,000 = $33,500 on purchase date"
7. **Sort persistence** — Table sort resets on page reload; could persist to localStorage
8. **Drag-and-drop disabled in table view** — Intentional: table has its own column sort. Drag-and-drop only works in grid view.
9. **`sort_order` column in existing schema** — Pre-existing. Table view doesn't modify sort_order (uses client-side column sort instead).
10. **Drop `user_collection_items` table** — Remnant from V1, still pending migration (documented in unified-collection.md)
