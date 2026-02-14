# Session: Consolidate Rendering Strategy

**Date:** 2026-02-14
**Commit:** `0a40d40` — `refactor: Consolidate card height into single source of truth`
**Deployed:** Yes (Vercel auto-deploy from main)

---

## Problem

The browse page uses three rendering strategies (SSR, CSS content-visibility, JS virtual scroll) added incrementally. Card height knowledge was duplicated in two places with no shared source of truth:

- `useAdaptiveVirtualScroll.ts` — JS computation from first principles
- `globals.css` — hardcoded `350px` (grid) / `650px` (gallery) in `contain-intrinsic-block-size`

The CSS values didn't match actual card heights (~358 grid, ~593 gallery), causing scroll flicker on fast upward swipe in gallery mode. Additionally, `isNearViewport` prop in ListingCard was dead code — hardcoded to `true`, never exercised its `false` branch.

## Solution

### New: `src/lib/rendering/cardHeight.ts`

Single source of truth exporting:
- `BREAKPOINTS` — Tailwind responsive breakpoints
- `getColumnCount(width)` — column count at viewport width
- `getCardHeight(columns, viewportWidth)` — card height only (for CSS)
- `getRowHeight(columns, viewportWidth)` — card + gap (for JS virtual scroll)
- `MOBILE_CARD_HEIGHTS` — `{ grid: 358, gallery: 593 }` pre-computed at 375px

### Changes

| File | What changed |
|------|-------------|
| `src/lib/rendering/cardHeight.ts` | **NEW** — shared card height module |
| `src/hooks/useAdaptiveVirtualScroll.ts` | Deleted 57 lines of local BREAKPOINTS/getColumnCount/getRowHeight, imports from shared module |
| `src/components/browse/VirtualListingGrid.tsx` | Sets `--card-intrinsic-height` CSS custom property from shared module, removed `data-mobile-view` attr, removed `isNearViewport` prop, added three-strategy architecture doc comment |
| `src/components/browse/ListingCard.tsx` | Removed `isNearViewport` from props interface, destructured params, image ternary (dead placeholder branch), memo comparison |
| `src/app/globals.css` | Replaced hardcoded heights + `[data-mobile-view]` selector with `var(--card-intrinsic-height, 450px)` |
| `tests/hooks/useAdaptiveVirtualScroll.test.ts` | Updated mobile row height expectation (625 → 653) to reflect accurate 40px gallery gap |

### Three Rendering Strategies (documented in VirtualListingGrid)

1. **SSR / small list** — All items rendered, no virtualization
2. **CSS content-visibility** (mobile) — All items in DOM, browser skips off-screen layout via `content-visibility: auto` with `--card-intrinsic-height` hint
3. **JS virtual scroll** (desktop) — Only visible rows in DOM, positioned with `translateY`

## Verification

- `npx tsc --noEmit` — clean
- `npx next build` — succeeds
- 110 related tests pass (24 hook + 53 ListingCard + 33 FilterContent)
- Desktop virtual scroll row heights unchanged: 451/460/466 at 3/4/5 columns

## Known Residual

- `docs/OPTIMIZATION.md` has 3 stale references to `isNearViewport` (lines 44, 51, 337). No runtime impact; cosmetic docs cleanup.
