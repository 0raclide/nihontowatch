# Session: Vault Holding Status (Owned vs Sold)

**Date:** 2026-03-14

## Summary

Added `holding_status` column to collection_items, enabling collectors to track sold (ex-collection) items alongside owned items with realized return tracking. The architecture uses a dedicated column orthogonal to the existing `status`/`is_sold`/`is_available` listing lifecycle columns, supporting future dealer convergence.

## Changes

### Database (1 file)
- **`supabase/migrations/158_collection_holding_status.sql`** — Adds `holding_status` (TEXT NOT NULL DEFAULT 'owned', CHECK constraint), `sold_price`, `sold_currency`, `sold_date`, `sold_to`, `sold_venue` to collection_items. Index on holding_status.

### Types (3 files)
- **`src/types/collectionItem.ts`** — Added `HoldingStatus` type, `holding_status` + sold fields to `CollectionItemRow`
- **`src/types/displayItem.ts`** — Added `holding_status` + sold fields to `CollectionExtension`
- **`src/types/collection.ts`** — Added `holdingStatuses?` to `CollectionFacets`

### Financial Calculator (1 file)
- **`src/lib/fx/financialCalculator.ts`** — Major update:
  - `ItemFinancialInput` gains `holding_status`, `sold_price`, `sold_currency`, `sold_date`
  - `ItemReturnData` gains `isRealized`, `annualizedReturnPct`, `holdingDays`
  - `computeItemReturn()` resolves exit value: sold items use `sold_price` at `sold_date` FX rate (realized, locked in); owned items use `current_value` at today's rate (unrealized)
  - FX impact for sold items uses rate change between purchase date and sold date (not today)
  - New helpers: `computeHoldingDays()`, `computeAnnualizedReturn()`
  - `computePortfolioTotals()` returns new `unrealized` and `realized` `PortfolioSplit` buckets
  - All existing behavior preserved (backward compatible — holding_status defaults to unrealized)

### Mapper (1 file)
- **`src/lib/displayItem/fromCollectionItem.ts`** — Passes through `holding_status` + sold fields in CollectionExtension

### API (2 files)
- **`src/app/api/collection/items/route.ts`** (GET) — New `holdingStatus` query param filter, `holdingStatuses` in facets response
- **`src/app/api/collection/items/[id]/route.ts`** (PATCH) — Added `holding_status`, `sold_price`, `sold_currency`, `sold_date`, `sold_to`, `sold_venue` to ALLOWED_FIELDS with validation. Logs `'sold'` audit event when holding_status changes to 'sold'.

### Hook (1 file)
- **`src/hooks/useVaultReturns.ts`** — Fetches historical rates for sold dates (sold_currency→home and purchase_currency→home at sold_date) in addition to purchase dates. Passes holding_status and sold fields to `computeItemReturn()`.

### UI Components (4 files)
- **`src/components/collection/VaultTableView.tsx`** — New Status column (colored pills: green=Owned, gray=Sold, amber=Consigned, blue=Gifted, red=Lost). Sold rows dimmed at `opacity-60`. Value column shows sold_price with "Sold for" label for sold items. ColSpan 11→12.
- **`src/components/collection/ReturnBreakdownPopover.tsx`** — Shows "Unrealized"/"Realized" label, holding period ("Held N days"), annualized return
- **`src/components/collection/VaultTableFooter.tsx`** — Split display: UNREALIZED (value/invested/return) + REALIZED (proceeds/cost basis/net gain) + COMBINED (when both sections exist). Decomposition row continues below.
- **`src/app/vault/CollectionPageClient.tsx`** — Collector holding tabs (All/Owned/Sold) using LedgerTabs. Default tab: Owned. Tab counts from API facets. Re-fetches on tab change.

### i18n (2 files)
- **`src/i18n/locales/en.json`** — 19 new keys (vault.tabAll/tabOwned/tabSold, vault.table.status/soldFor, vault.holdingStatus.*, vault.return.unrealized/realized/annualized/daysHeld/proceeds/costBasis/netGain/combined)
- **`src/i18n/locales/ja.json`** — Matching Japanese translations

### Tests (1 file)
- **`tests/lib/fx/financialCalculator.test.ts`** — 17 new tests across 3 describe blocks:
  - Holding status (8): unrealized default, owned marking, realized marking, sold_price as exit value, cross-currency sold, FX impact at sold_date, null sold_price, fallback to current_value
  - Annualized return (5): owned period to today, sold period, <30 day null, holdingDays computation, null purchase_date
  - Portfolio split (4): split buckets, empty buckets, empty map, all-sold scenario

## Verification

- `tsc --noEmit` — zero errors
- `npm test` — 52/52 calculator tests pass, 5684/5684 total (2 pre-existing failures unrelated)

## Dealer Convergence

| Collector holding_status | Dealer equivalent | Notes |
|---|---|---|
| owned | INVENTORY / AVAILABLE / HOLD | Currently in possession |
| sold | SOLD | Disposed via sale |
| consigned | CONSIGNED_OUT (future) | Given to another party to sell |
| gifted | N/A | Given away |
| lost | DELISTED (loosely) | No longer accessible |

The holding_status column is orthogonal to the existing `status`/`is_sold`/`is_available` listing lifecycle. When dealers get vault financial tracking, they use holding_status for portfolio P&L and the existing status for listing lifecycle.
