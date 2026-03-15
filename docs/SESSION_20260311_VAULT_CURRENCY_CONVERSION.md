# Session: Vault Home Currency Conversion & Gain/Loss Decomposition

**Date:** 2026-03-11
**Commit:** `68685fbe`
**Status:** Deployed to production

## Problem

The vault spreadsheet tracks purchase prices and current values per item, but each in its own currency (JPY, USD, EUR, etc.). A USD-based collector who bought a katana for ¥2M when USD/JPY was 110 has a cost basis of $18,182 — but if the yen weakens to 150, the same item at ¥2.5M is only worth $16,667 in their home currency. Without historical FX conversion, the spreadsheet can't show real returns.

## Solution

Added persistent home currency preference, historical FX conversion at date-of-purchase rates, per-item gain/loss with asset vs FX decomposition, and portfolio-level totals.

**No pricing model integration** — only user-entered `current_value` is used.

## Architecture

```
CollectionPageClient
  └─ useHomeCurrency()          ← reads/writes profiles.preferences.home_currency
  └─ VaultTableView
       └─ useVaultReturns()     ← batch-fetches historical FX, computes per-item returns
            ├─ fetchBatchHistoricalRates()  ← dedup + concurrency-limited utility
            └─ computeItemReturn()          ← pure function
       └─ ReturnBreakdownPopover (per row)  ← colored gain/loss + click popover
       └─ VaultTableFooter      ← portfolio totals in home currency
```

## Financial Math

### Per-item return

- `costBasisHome = purchase_price × R_purchase_date_to_home` (historical rate)
- `currentValueHome = current_value × R_today_to_home` (today's rate)
- `expensesHome = sum(each currency total × R_today_to_home)` (today's rate)
- `totalInvestedHome = costBasisHome + expensesHome`
- `totalReturn = currentValueHome - totalInvestedHome`

### Decomposition (all items with sufficient rate data)

- `fxImpact = P_buy × (R_today_purchCur_to_home - R_purchase_purchCur_to_home)` — FX movement on cost basis
- `expenseDrag = -expensesHome`
- `assetReturn = totalReturn - fxImpact - expenseDrag` — residual
- **Identity:** `assetReturn + fxImpact + expenseDrag === totalReturn`

Works for both same-currency (JPY→JPY) and mixed-currency (JPY→USD) items. FX impact is always computed on the **purchase currency** — it measures how the currency you paid in has moved relative to your home currency. Asset return is the residual.

**Bug fix (2026-03-12, commit `83ee50ae`):** Previously gated by `canDecompose = purchCur === currCur`, which excluded mixed-currency items from decomposition entirely. This caused portfolio FX Impact and Expenses to show $0 when all FX-exposed items happened to have different purchase/current currencies.

## Files Changed

### New Files (6)

| File | Description |
|------|-------------|
| `src/lib/fx/batchHistoricalRates.ts` | Batch fetcher: dedup (date,currency) pairs, concurrency limit 5, returns `FxRateMap` |
| `src/lib/fx/financialCalculator.ts` | Pure functions: `computeItemReturn()`, `computePortfolioTotals()` |
| `src/hooks/useHomeCurrency.ts` | Read/persist home currency. Fallback: DB pref → browse currency → USD |
| `src/hooks/useVaultReturns.ts` | Orchestrator: batch rate fetch + per-item return computation |
| `src/components/collection/HomeCurrencyPicker.tsx` | Compact dropdown in vault toolbar |
| `src/components/collection/ReturnBreakdownPopover.tsx` | Colored gain/loss + click-to-reveal decomposition |

### Modified Files (6)

| File | Changes |
|------|---------|
| `src/app/api/user/preferences/route.ts` | `home_currency` added to `ALLOWED_KEYS`, 7-currency validation |
| `src/components/collection/VaultTableView.tsx` | New "Return" column + sort key, `ReturnBreakdownPopover`, `colSpan` 10→11, new props |
| `src/components/collection/VaultTableFooter.tsx` | Portfolio summary row (value/invested/return + decomposition) |
| `src/app/vault/CollectionPageClient.tsx` | Wired `useHomeCurrency`, `useVaultReturns`, `HomeCurrencyPicker` |
| `src/i18n/locales/en.json` | 11 new keys (`vault.table.return`, `vault.return.*`) |
| `src/i18n/locales/ja.json` | 11 matching Japanese keys |

## Tests

- `tests/lib/fx/financialCalculator.test.ts` — **22 tests**: same-currency decomposition, mixed-currency decomposition (JPY→USD with FX + expenses), expenses, identity golden test, null/edge cases
- `tests/lib/fx/batchHistoricalRates.test.ts` — **10 tests**: deduplication, null handling, partial failures, case insensitivity

## Key Decisions

1. **No migration needed** — `profiles.preferences` is already a JSONB column. `home_currency` is just a new key in the object.

2. **Historical rates via existing `/api/exchange-rates?date=`** — Already built, already cached in sessionStorage. Batch fetcher deduplicates requests.

3. **`convertPrice()` from `useCurrency.ts` reused** — For today's rate conversions. The existing function converts through USD as base, which works for all supported currencies.

4. **Decomposition for all items** — FX impact is computed on the purchase currency for all items (same-currency and mixed-currency). Asset return is the residual. For same-currency items, the residual formula produces the same result as the original `(V_now - P_buy) × R_today`.

5. **Expenses converted at today's rate** — For v1 simplicity. Historical expense dates would require per-expense date tracking (future enhancement).

## Supported Currencies

JPY, USD, EUR, AUD, GBP, CAD, CHF — covers all major collector markets.

## Known Limitations

- Expenses use today's FX rate (not historical date-of-expense rates)
- Home currency picker only visible in desktop table view (not mobile)
- No sparkline/chart of return over time (future feature)
