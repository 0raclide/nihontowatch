# Mobile Scroll Stability

This document describes the scroll stability system used to prevent bounce/jank during infinite scroll loading on mobile devices.

## Problem

When users scroll on mobile and the infinite scroll triggers loading more results, the entire screen would "bounce" or jump. This was particularly noticeable on iOS Safari with its elastic scrolling behavior.

### Root Causes

1. **Immediate Height Jump**: When new items are added, the virtualized container's `totalHeight` recalculates instantly, causing the content to grow suddenly.

2. **No Scroll Position Preservation**: The browser's default behavior during height changes can cause scroll position to shift.

3. **Missing CSS Scroll Anchoring**: Without `overflow-anchor: auto`, browsers can't automatically maintain scroll position during content changes.

4. **iOS Safari Elastic Scrolling**: Layout shifts are amplified by Safari's rubber-band scrolling effect.

5. **Variable Loading Indicator Height**: The loading indicator appearing/disappearing would add/remove height, causing layout shifts.

## Solution Architecture

We implement a **three-layer scroll stability system**:

### 1. CSS Layer

```css
/* src/app/globals.css */

/* Enable browser scroll anchoring */
.virtual-scroll-container {
  overflow-anchor: auto;
}

/* Prevent overscroll bounce during content changes */
.scroll-stable {
  overscroll-behavior-y: contain;
}

/* Fixed-height zone prevents layout shifts */
.load-more-placeholder {
  height: 64px;
  min-height: 64px;
}
```

### 2. JavaScript Layer

The `useScrollPositionLock` hook (`src/hooks/useScrollPositionLock.ts`) provides scroll position preservation:

```typescript
const { lockScrollPosition, unlockScrollPosition } = useScrollPositionLock();

// Before content changes
lockScrollPosition();

// After content renders
unlockScrollPosition();
```

The hook:
- Saves the current `window.scrollY` on lock
- Restores it with `window.scrollTo({ behavior: 'instant' })` on unlock
- Is idempotent (multiple locks don't overwrite)

### 3. Layout Layer

The loading indicator zone uses a fixed 64px height:

```tsx
<div className="load-more-placeholder flex items-center justify-center">
  {isLoadingMore ? (
    <Spinner />
  ) : hasMore ? (
    <div ref={loadMoreTriggerRef} />
  ) : (
    <EndMessage />
  )}
</div>
```

This prevents height changes when the loading state toggles.

## Flow

1. User scrolls near bottom → IntersectionObserver fires
2. `loadMore()` is called → **locks scroll position**
3. Fetch request starts → `isLoadingMore = true`
4. Response arrives → new items added to state
5. `useAdaptiveVirtualScroll` detects height change → calls `onHeightWillChange`
6. React renders new items
7. `VirtualListingGrid` useEffect detects item count change → **unlocks scroll position** via `requestAnimationFrame`
8. User sees new content with no visible jump

## Files

| File | Purpose |
|------|---------|
| `src/hooks/useScrollPositionLock.ts` | Scroll position save/restore |
| `src/hooks/useAdaptiveVirtualScroll.ts` | Height change callback |
| `src/components/browse/VirtualListingGrid.tsx` | Scroll stability integration |
| `src/app/page.tsx` | Locks scroll before loading |
| `src/app/globals.css` | CSS scroll anchoring |

## Testing

### Unit Tests

- `tests/hooks/useScrollPositionLock.test.ts` - Hook behavior
- `tests/hooks/useAdaptiveVirtualScroll.test.ts` - Height change callbacks
- `tests/components/browse/ListingGrid.test.tsx` - Fixed-height placeholder

### Manual Testing

1. Open the site on iOS Safari (primary target)
2. Scroll down until infinite scroll triggers
3. Verify no visible bounce or jank
4. Repeat on Android Chrome

### Known Limitations

- The scroll position lock is based on `window.scrollY`, so it may not work correctly if the scroll container is not the window
- Very fast scrolling during a load may still show minor jank
- The fixed-height loading zone (64px) may not be optimal for all screen sizes

## Debugging

If scroll issues reappear:

1. **Check CSS is applied**: Inspect the virtualized container for `overflow-anchor: auto`
2. **Verify lock/unlock timing**: Add console logs to `lockScrollPosition` and `unlockScrollPosition`
3. **Check height changes**: Log `totalHeight` in `useAdaptiveVirtualScroll`
4. **Test on real device**: iOS Safari Simulator behaves differently from real devices

## Browser Support

- **iOS Safari**: Primary target, uses CSS scroll anchoring + JS lock
- **Android Chrome**: Supported, generally has better default behavior
- **Desktop browsers**: Not affected (uses pagination, not infinite scroll)
