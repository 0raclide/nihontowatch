# Mobile UX Design

This document describes the mobile user experience patterns used in Nihontowatch.

## QuickView Modal

The QuickView modal provides a fast preview of listings without leaving the browse page. On mobile, it uses a specialized bottom sheet pattern optimized for touch interaction.

### Mobile Layout

```
┌─────────────────────────────────┐
│                                 │
│     Full-screen Image Area      │
│     (scrollable vertically)     │
│                                 │
│     Tap to collapse sheet       │
│                                 │
├─────────────────────────────────┤
│ ┌─ handle ─┐            [X]     │
│ ¥60,000,000                     │
│ ┌───────┐ ┌────────┐            │
│ │Katana │ │ Juyo   │            │
│ └───────┘ └────────┘            │
│ Sukehiro (2nd gen)              │
│ 🏢 Aoi Art                      │
│ ┌─────────────────────────────┐ │
│ │     See Full Listing        │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Collapsed State

```
┌─────────────────────────────────┐
│                                 │
│     Full-screen Image Area      │
│     (more vertical space)       │
│                                 │
├─────────────────────────────────┤
│ ¥60,000,000    ▲    1/12        │
└─────────────────────────────────┘
```

### Interaction Patterns

| Action | Result |
|--------|--------|
| Tap image area | Collapse bottom sheet to pill |
| Tap collapsed sheet | Expand bottom sheet |
| Swipe down on sheet | Collapse sheet |
| Swipe up on sheet | Expand sheet |
| Tap X button | Close modal |
| Scroll images | Navigate through listing photos |

### Touch Gesture Handling

The bottom sheet uses touch events with velocity detection:

```typescript
// Gesture thresholds
const SWIPE_THRESHOLD = 50;    // Min distance (px)
const VELOCITY_THRESHOLD = 0.3; // Min velocity (px/ms)
```

- **Swipe detection**: Triggers on either distance OR velocity threshold
- **Direction lock**: Expanded sheet only allows downward swipe; collapsed only allows upward
- **Smooth transitions**: Uses `cubic-bezier(0.32, 0.72, 0, 1)` for spring-like animation

### Button Touch Handling

Interactive elements inside the sheet need special touch handling to prevent gesture interference:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); onClose(); }}
  onTouchStart={(e) => e.stopPropagation()}
  onTouchEnd={(e) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  }}
>
```

This pattern:
1. Stops touch events from bubbling to sheet's drag handlers
2. Triggers action on `touchEnd` for immediate response
3. Prevents duplicate `click` event from firing

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< lg` (1024px) | Mobile: Full-screen images + bottom sheet |
| `≥ lg` | Desktop: 60/40 split with sidebar |

### CSS Classes

```css
/* Mobile only */
.lg:hidden { }

/* Desktop only */
.hidden.lg:flex { }
```

## Currency Display

The QuickView respects the user's currency preference stored in `localStorage`:

```typescript
// Read preference
localStorage.getItem('preferred_currency') // 'JPY' | 'USD' | 'EUR'

// Prices are converted using live exchange rates
formatPriceWithConversion(value, sourceCurrency, targetCurrency, rates)
```

## Safe Areas

Mobile layouts account for device safe areas (notch, home indicator):

```css
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

## Performance Optimizations

### Lazy Image Loading

Images load progressively as user scrolls:

```typescript
// IntersectionObserver with 200px margin
rootMargin: '200px 0px'
threshold: 0.1
```

### Minimum Height During Load

Images maintain minimum height while loading to prevent layout collapse:

```tsx
className={`${!loaded ? 'min-h-[300px]' : ''}`}
```

## Component Files

| Component | Location |
|-----------|----------|
| QuickView | `src/components/listing/QuickView.tsx` |
| QuickViewModal | `src/components/listing/QuickViewModal.tsx` |
| QuickViewMobileSheet | `src/components/listing/QuickViewMobileSheet.tsx` |
| QuickViewContent | `src/components/listing/QuickViewContent.tsx` |
| QuickViewContext | `src/contexts/QuickViewContext.tsx` |

## Testing

Mobile tests use Playwright with mobile viewport:

```typescript
test.use({
  viewport: { width: 390, height: 844 }, // iPhone 14 Pro
});
```

Key test scenarios:
- Sheet expand/collapse on tap
- X button closes modal
- Images scroll when sheet collapsed
- Modal stays closed (no re-open bug)
- Currency preference respected

See `tests/quickview-regression.spec.ts` for the full test suite.

---

## Adaptive Virtual Scroll Grid

The listing grid uses an SSR-safe virtual scrolling system that adapts to different screen sizes using CSS-first responsive design.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ListingGrid                                 │
│  (Thin wrapper - handles loading/empty states)                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              VirtualListingGrid                             ││
│  │  (Same component for all screen sizes - SSR safe)           ││
│  │                                                              ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              CSS Grid (responsive)                      │││
│  │  │  grid-cols-1 → sm:2 → lg:3 → xl:4 → 2xl:5             │││
│  │  │                                                         │││
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │││
│  │  │  │ListingCard│  │ListingCard│  │ListingCard│             │││
│  │  │  └──────────┘  └──────────┘  └──────────┘             │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Why CSS-First?

Previous implementations caused React hydration errors (#300) because:

```tsx
// ANTI-PATTERN - causes hydration mismatch
if (isMobile) {
  return <MobileComponent />;  // Different component tree!
}
return <DesktopComponent />;
```

**The fix:** Render the **same component tree** on server and client. Use CSS for responsive layout changes, not JS conditional rendering.

### Responsive Column Breakpoints

| Viewport Width | Columns | Tailwind Class |
|----------------|---------|----------------|
| < 640px (mobile) | 1 | `grid-cols-1` |
| 640-1023px (tablet) | 2 | `sm:grid-cols-2` |
| 1024-1279px (desktop) | 3 | `lg:grid-cols-3` |
| 1280-1535px (large) | 4 | `xl:grid-cols-4` |
| ≥ 1536px (extra large) | 5 | `2xl:grid-cols-5` |

### Virtual Scrolling

The `useAdaptiveVirtualScroll` hook enables virtual scrolling for large lists:

```typescript
const {
  visibleItems,    // Only items currently visible + overscan buffer
  startIndex,      // First visible item index
  totalHeight,     // Total scrollable height
  offsetY,         // Y position to offset visible items
  columns,         // Current column count (1-5)
  isVirtualized,   // Whether virtualization is active
} = useAdaptiveVirtualScroll({
  items: listings,
  overscan: 2,     // Extra rows above/below viewport
  enabled: infiniteScroll && listings.length > 30,
});
```

**Key features:**
- **SSR-safe defaults:** Uses static dimensions during server render
- **Row-based virtualization:** Virtualizes by rows (1-5 items per row)
- **Adaptive row height:** Mobile (360px) vs desktop (310px)
- **Scroll anchoring:** Preserves position when new items load

### When Virtualization Activates

| Mode | Condition | Behavior |
|------|-----------|----------|
| Pagination (desktop) | `infiniteScroll=false` | No virtualization, shows pagination |
| Infinite scroll (mobile) | `infiniteScroll=true && items>30` | Virtualization enabled |
| Small lists | Any mode, items ≤ 30 | No virtualization (not needed) |

### Component Files

| Component | Location | Description |
|-----------|----------|-------------|
| ListingGrid | `src/components/browse/ListingGrid.tsx` | Wrapper with loading/empty states |
| VirtualListingGrid | `src/components/browse/VirtualListingGrid.tsx` | Core grid with virtualization |
| useAdaptiveVirtualScroll | `src/hooks/useAdaptiveVirtualScroll.ts` | Virtual scroll logic |

### Testing

**Unit tests:** `tests/hooks/useAdaptiveVirtualScroll.test.ts`
- SSR safety (disabled mode returns first batch)
- Column calculations at all breakpoints
- Row height calculations (mobile vs desktop)
- Virtualization math (total height, visible items)

**E2E tests:** `tests/e2e/mobile-responsive-grid.spec.ts`
- 1-column layout on mobile viewport
- 2-column on tablet
- Multi-column on desktop
- **No hydration errors in console** (critical test)
- Pagination visible on desktop
- DOM size remains reasonable during scroll

```typescript
// Run E2E tests
npx playwright test tests/e2e/mobile-responsive-grid.spec.ts
```

### Debugging Hydration Issues

If you see React error #300 or hydration warnings:

1. **Check for conditional component rendering based on client-only state:**
   ```tsx
   // BAD - causes hydration mismatch
   const isMobile = useIsMobile();
   if (isMobile) return <MobileComponent />;
   return <DesktopComponent />;
   ```

2. **Solution: Same component, different styling:**
   ```tsx
   // GOOD - CSS handles responsive changes
   return <UnifiedComponent className="grid-cols-1 lg:grid-cols-4" />;
   ```

3. **For data differences:** Different data is OK, different components are not. The VirtualListingGrid may show different items on server vs client, but the component tree is identical.
