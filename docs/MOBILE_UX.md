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
