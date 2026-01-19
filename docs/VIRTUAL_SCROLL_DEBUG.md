# Virtual Scroll & Infinite Scroll Debug History

## Executive Summary

The browse page uses a custom virtual scroll implementation for performance with 2,000+ listings. **All major issues have been fixed**:
- Visual jumping during scroll (fixed Jan 2025)
- QuickView scroll position restoration (fixed Jan 2025)

The implementation is now stable and production-tested.

## Issues Addressed

### 1. ✅ FIXED: Items Repeating When Scrolling Deep

**Problem**: When scrolling past ~100 items, the same items would repeat.

**Root Cause**: Pagination offset calculation bug. Initial page loads 100 items, subsequent pages load 50. The API calculated offset as `(page-1) * limit`, so page 2 with limit=50 gave offset=50, returning items 50-99 (duplicates).

**Fix Applied**:
- Added explicit `offset` parameter to API (`src/app/api/browse/route.ts`)
- Client now sends `offset=allListings.length` instead of page number (`src/app/page.tsx`)
- Added deduplication as safety net

**Files Modified**:
- `src/app/api/browse/route.ts` - Accept `offset` param
- `src/app/page.tsx` - Send explicit offset
- `src/components/browse/ListingGrid.tsx` - Changed `hasMore` to use item count

### 2. ✅ FIXED: Card Shuffling When QuickView Opens

**Problem**: Opening QuickView caused background cards to shuffle/jump.

**Root Cause**: Body scroll lock made `window.scrollY` return 0, causing virtual scroll to recalculate with wrong position.

**Fix Applied**:
- Global `window.__scrollLockActive` flag set synchronously before React state updates
- Virtual scroll handler checks this flag and skips updates when true
- Uses `position:fixed` with stable scroll tracking (see issue #5)

**Files Modified**:
- `src/hooks/useBodyScrollLock.ts`
- `src/hooks/useAdaptiveVirtualScroll.ts`
- `src/contexts/QuickViewContext.tsx`

### 3. ✅ FIXED: Scroll Jumping When New Items Load

**Problem**: When scrolling triggers loading more items, cards jump.

**Root Cause**: Row height estimates were wrong. Hook used 310px, actual was 372px.

**Fix Applied**:
- Updated `getRowHeight()` with measured values:
  - 1 column: 437px
  - 2 columns: 406px
  - 3 columns: 370px
  - 4 columns: 372px
  - 5 columns: 374px

**Files Modified**:
- `src/hooks/useAdaptiveVirtualScroll.ts`

### 4. ✅ FIXED: Visual Jumping During Normal Scroll (Jan 2025)

**Problem**: Items visually jump/shift while scrolling normally.

**Root Cause Identified**:
The scroll handler used a **threshold-based update** (~93px = rowHeight/4), which caused the React state `scrollTop` to lag behind the actual browser scroll position. When the state finally updated, `startRow` could jump multiple positions at once, causing `offsetY` to change out of sync with the visual scroll.

```
Old behavior:
1. User scrolls continuously from A to B
2. State remains at A until threshold crossed
3. When state updates, startRow may jump multiple rows
4. offsetY jumps by N * rowHeight (not synchronized with scroll)
```

**Fix Applied**:
Complete refactor of `useAdaptiveVirtualScroll.ts`:

1. **Removed threshold-based scroll tracking** - No more `scrollTop` state
2. **Calculate `startRow` directly on every RAF** - Uses actual `window.scrollY`
3. **Only trigger re-render when `startRow` changes** - Efficient and synchronized
4. **Use `useLayoutEffect` for scroll handling** - Ensures sync before paint

```typescript
// New approach:
const handleScroll = () => {
  rafRef.current = requestAnimationFrame(() => {
    const newStartRow = calculateStartRow(); // Uses live window.scrollY

    // ONLY update when visible rows change
    if (newStartRow !== startRowRef.current) {
      startRowRef.current = newStartRow;
      setStartRow(newStartRow);  // Triggers render
    }
  });
};
```

**Why This Works**:
- `offsetY` only changes when crossing a row boundary
- The change happens at the exact scroll position where the boundary is crossed
- No lag between actual scroll and React state
- Fewer re-renders (only on row changes, not on threshold crossings)

**Files Modified**:
- `src/hooks/useAdaptiveVirtualScroll.ts` - Complete refactor

**Tests Added**:
- `tests/hooks/useAdaptiveVirtualScroll.test.ts` - New "scroll jumping fix" test suite
- `tests/components/browse/VirtualListingGrid.scroll.test.tsx` - Integration tests

### 5. ✅ FIXED: QuickView Scroll Position Restoration (Jan 2025)

**Problem**: Opening QuickView at scroll position 500 would restore to position 273 after closing.

**Root Cause**: When clicking on a card partially outside the viewport, the browser performs an instant "scroll-into-view" BEFORE any JavaScript events fire. Our handlers captured the wrong (post-scroll) position.

**Fix Applied**:
- Stable scroll position tracking with 150ms lag (browser instant scrolls <50ms are ignored)
- Use `position:fixed` on body with `top: -stableScrollPosition` to preserve visual position
- Simplified QuickViewContext (removed complex capture mechanisms)

**Files Modified**:
- `src/hooks/useBodyScrollLock.ts` - Complete rewrite with stable scroll tracking
- `src/contexts/QuickViewContext.tsx` - Simplified
- `src/components/listing/QuickViewModal.tsx` - Removed savedScrollPosition prop
- `src/components/listing/QuickView.tsx` - Removed savedScrollPosition usage

**Production Tested**: ✅ Scroll position preserved (500 → 500), 0px drift

## Current Implementation

### Virtual Scroll Hook (`useAdaptiveVirtualScroll.ts`)

```typescript
// Key calculations:
const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
const offsetY = startRow * rowHeight;

// Scroll handler - calculates on every RAF, updates only when startRow changes:
const handleScroll = () => {
  rafRef.current = requestAnimationFrame(() => {
    const newStartRow = Math.max(0, Math.floor(window.scrollY / rowHeight) - overscan);

    if (newStartRow !== startRowRef.current) {
      startRowRef.current = newStartRow;
      setStartRow(newStartRow);
    }
  });
};
```

`offsetY` only changes when `startRow` changes, which happens exactly at row boundaries.

### Row Height Values

| Columns | Breakpoint | Row Height |
|---------|------------|------------|
| 1 | <640px (mobile) | 437px |
| 2 | 640-1023px (sm) | 406px |
| 3 | 1024-1279px (lg) | 370px |
| 4 | 1280-1535px (xl) | 372px |
| 5 | ≥1536px (2xl) | 374px |

**Note**: The 1px discrepancy between measured values (355px card + 16px gap = 371px) and the hook values (372px) is intentional padding for slight variance across browsers.

## File Reference

| File | Purpose |
|------|---------|
| `src/hooks/useAdaptiveVirtualScroll.ts` | Virtual scroll logic |
| `src/hooks/useBodyScrollLock.ts` | Modal scroll locking |
| `src/components/browse/VirtualListingGrid.tsx` | Grid rendering, infinite scroll trigger |
| `src/components/browse/ListingGrid.tsx` | Wrapper component |
| `src/app/page.tsx` | Page state, loadMore function |
| `src/app/api/browse/route.ts` | API pagination |
| `tests/hooks/useAdaptiveVirtualScroll.test.ts` | Hook unit tests (24 tests) |
| `tests/components/browse/VirtualListingGrid.scroll.test.tsx` | Integration tests (6 tests) |

## Test Commands

```bash
# Run all tests
npm test

# Test virtual scroll hook specifically
npm test -- tests/hooks/useAdaptiveVirtualScroll.test.ts

# Test VirtualListingGrid scroll behavior
npm test -- tests/components/browse/VirtualListingGrid.scroll.test.tsx
```

## Session History

### Session 1: QuickView Scroll Jump
- Fixed scroll position capture on QuickView close
- Fixed card shuffling when QuickView opens

### Session 2: Items Repeating
- Diagnosed API pagination bug
- Fixed with explicit offset parameter
- Added client-side deduplication

### Session 3: Visual Jumping Analysis
- Identified discrete row-height jumps as cause
- Documented potential solutions
- Prepared handoff document

### Session 4: Visual Jumping Fix (Jan 2025)
- Deep analysis of threshold-based update lag
- Refactored to calculate startRow on every RAF
- Only triggers re-render when startRow changes
- Added comprehensive test suite (24 hook tests + 6 integration tests)
- All tests passing

### Session 5: QuickView Scroll Position Fix (Jan 2025)

**Problem**: When opening and closing QuickView, the scroll position would shift. Opening QuickView at scroll position 500 would restore to position 273 after closing.

**Root Cause Identified**:
When clicking on a card that's partially outside the viewport, the browser performs an instant "scroll-into-view" operation BEFORE any JavaScript events fire. This meant:
1. User scrolls to position 500
2. User clicks on a card at -227px (above viewport)
3. Browser instantly scrolls to bring card into view (new position: 273)
4. mousedown/click events fire with scrollY already at 273
5. React effect captures wrong position (273 instead of 500)

**Fix Applied**:
Two-part solution in `useBodyScrollLock.ts`:

1. **Stable Scroll Position Tracking**: Added a global scroll position tracker that updates with a 150ms lag. This ensures instant browser scrolls (scroll-into-view) don't update the tracked position.

2. **Position Fixed with Correct Offset**: Use `position: fixed` on body with `top: -stableScrollPosition` to preserve visual position.

```typescript
// Scroll tracking with 150ms lag
window.addEventListener('scroll', () => {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    if (!window.__scrollLockActive) {
      window.__stableScrollPosition = window.scrollY;
    }
  }, 150);  // Longer than browser instant-scroll duration
}, { passive: true });

// In useBodyScrollLock:
const scrollY = window.__stableScrollPosition ?? window.scrollY;
body.style.position = 'fixed';
body.style.top = `-${scrollY}px`;
```

**Why This Works**:
- User scrolling takes time (100ms+), so the 150ms lag captures the final position
- Browser instant scroll (scroll-into-view) completes in <50ms, so it's ignored
- The stable position reflects where the user intentionally scrolled, not where the browser auto-scrolled

**Files Modified**:
- `src/hooks/useBodyScrollLock.ts` - Complete rewrite with stable scroll tracking
- `src/contexts/QuickViewContext.tsx` - Simplified (removed scroll capture logic)
- `src/components/listing/QuickViewModal.tsx` - Removed savedScrollPosition prop
- `src/components/listing/QuickView.tsx` - Removed savedScrollPosition usage

**Test Results**:
- Visual position preserved during QuickView open ✅
- Scroll position restored correctly after close ✅
- Multiple open/close cycles work correctly ✅

## Maintenance Notes

The virtual scroll implementation is now stable. Future enhancements could include:

1. **Dynamic row height measurement** - Measure actual card heights at runtime for pixel-perfect accuracy
2. **@tanstack/virtual integration** - For more complex virtualization needs (variable row heights, horizontal scrolling)
3. **CSS content-visibility** - As browser support improves, could reduce JS overhead

## Contact

For questions about this implementation, reference this document and the git history for context.
