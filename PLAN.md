# QuickView Image Performance Optimization Plan

## Executive Summary

QuickView image loading is slow because it **bypasses the Supabase Storage CDN** and uses raw dealer URLs. This plan addresses that critical bug plus introduces preloading strategies for instant image display.

---

## Root Cause Analysis

### Critical Bug Found

**File:** `src/components/listing/QuickView.tsx:140`

```typescript
const images = currentListing.images || [];
```

This completely ignores `stored_images` (Supabase Storage CDN). Meanwhile:
- `ListingCard.tsx` uses `getImageUrl()` → prefers CDN images
- `src/lib/images.ts` has `getAllImages()` specifically for this use case

**Impact:**
- QuickView loads from dealer servers (often slow, rate-limited, overseas)
- Card thumbnails load from CDN (fast)
- User sees fast grid → slow QuickView modal = jarring UX

### Performance Bottlenecks

1. **No CDN usage** - 100% of QuickView images come from dealer servers
2. **No preloading on hover** - Card hover could trigger prefetch
3. **No prefetching for navigation** - J/K navigation loads from scratch
4. **Next.js Image optimization overhead** - Images transcoded on-demand for first request

---

## Implementation Plan

### Phase 1: Use Stored Images (Critical Fix)

**Estimated Effort:** Small - single file change

Replace direct `images` array access with `getAllImages()`:

```typescript
// Before (QuickView.tsx:140)
const images = currentListing.images || [];

// After
import { getAllImages } from '@/lib/images';
const images = getAllImages(currentListing);
```

**Expected Impact:**
- 50-90% faster image loads for listings with stored_images
- Consistent behavior with ListingCard

---

### Phase 2: Hover Preloading (High Impact)

**Estimated Effort:** Medium - new hook + card integration

When user hovers on a card for 150ms+, preload the first 2-3 QuickView images.

**Implementation:**

1. Create `useImagePreloader` hook:
```typescript
// src/hooks/useImagePreloader.ts
export function useImagePreloader() {
  const preloadImage = useCallback((url: string) => {
    const img = new Image();
    img.src = url; // Browser caches it
  }, []);

  const preloadListing = useCallback((listing: Listing) => {
    const images = getAllImages(listing);
    images.slice(0, 3).forEach(preloadImage);
  }, [preloadImage]);

  return { preloadImage, preloadListing };
}
```

2. Integrate with `ListingCard`:
```typescript
// On mouse enter (with debounce)
const handleMouseEnter = useCallback(() => {
  hoverTimer.current = setTimeout(() => {
    preloader.preloadListing(listing);
  }, 150); // Only preload after 150ms hover
}, []);
```

**Expected Impact:**
- Images ready before modal opens
- Near-instant QuickView display for intentional clicks

---

### Phase 3: Navigation Prefetching (J/K Keys)

**Estimated Effort:** Medium - context enhancement

When viewing listing N, preload images for listings N-1 and N+1.

**Implementation:**

Add to `QuickViewContext.tsx`:
```typescript
// When currentIndex changes, preload adjacent listings
useEffect(() => {
  if (!isOpen || currentIndex === -1) return;

  // Preload previous
  if (currentIndex > 0) {
    const prevImages = getAllImages(listings[currentIndex - 1]);
    prevImages.slice(0, 2).forEach(preloadImage);
  }

  // Preload next
  if (currentIndex < listings.length - 1) {
    const nextImages = getAllImages(listings[currentIndex + 1]);
    nextImages.slice(0, 2).forEach(preloadImage);
  }
}, [currentIndex, isOpen, listings]);
```

**Expected Impact:**
- Instant navigation with J/K keys
- Smooth browsing experience

---

### Phase 4: Optimized Image Component (Optional Enhancement)

**Estimated Effort:** Medium - new component

Create a smarter `PreloadedImage` component that:
1. Uses `<link rel="preload">` for above-the-fold images
2. Progressively enhances with blur placeholder
3. Reports load metrics for monitoring

---

## Test Plan

### Unit Tests

**File:** `tests/lib/images.test.ts` (extend existing)

```typescript
describe('getAllImages', () => {
  it('merges stored and original images correctly', () => {
    const listing = {
      stored_images: ['cdn1.jpg', 'cdn2.jpg'],
      images: ['dealer1.jpg', 'dealer2.jpg', 'dealer3.jpg']
    };
    const result = getAllImages(listing);
    expect(result).toEqual(['cdn1.jpg', 'cdn2.jpg', 'dealer3.jpg']);
  });

  it('handles null stored_images gracefully', () => {
    const listing = {
      stored_images: null,
      images: ['dealer1.jpg']
    };
    expect(getAllImages(listing)).toEqual(['dealer1.jpg']);
  });
});
```

### Integration Tests

**File:** `tests/components/listing/QuickView.test.tsx` (new)

```typescript
describe('QuickView image loading', () => {
  it('uses stored_images when available', () => {
    const listing = {
      stored_images: ['https://supabase.co/cdn/img.jpg'],
      images: ['https://dealer.com/slow.jpg']
    };

    render(<QuickView listing={listing} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('supabase.co'));
  });

  it('falls back to original images when no stored_images', () => {
    const listing = {
      stored_images: null,
      images: ['https://dealer.com/img.jpg']
    };

    render(<QuickView listing={listing} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('dealer.com'));
  });
});
```

### E2E Tests

**File:** `tests/e2e/quickview-image-performance.spec.ts` (new)

```typescript
import { test, expect } from '@playwright/test';

test.describe('QuickView Image Performance', () => {
  test('images load from CDN when stored_images available', async ({ page }) => {
    // Intercept image requests
    const imageRequests: string[] = [];
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        imageRequests.push(request.url());
      }
    });

    await page.goto('/browse');
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]');

    // Wait for image load
    await page.waitForTimeout(1000);

    // Check that CDN URLs are used (not dealer URLs)
    const cdnRequests = imageRequests.filter(url =>
      url.includes('supabase') || url.includes('_next/image')
    );

    expect(cdnRequests.length).toBeGreaterThan(0);
  });

  test('hover preloading works', async ({ page }) => {
    await page.goto('/browse');

    // Hover over first card
    const card = page.locator('[data-testid="listing-card"]').first();
    await card.hover();

    // Wait for preload delay
    await page.waitForTimeout(200);

    // Check network for preload requests
    const preloadRequests = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(r => r.name.includes('image'))
        .length;
    });

    expect(preloadRequests).toBeGreaterThan(0);
  });

  test('navigation prefetching loads adjacent images', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('[data-testid="listing-card"]').first().click();
    await page.waitForSelector('[data-testid="quickview-modal"]');

    // Press J to go to next listing
    await page.keyboard.press('j');

    // Should load quickly because prefetched
    const img = page.locator('[data-testid="desktop-image-scroller"] img').first();

    // Check image loads within reasonable time
    await expect(img).toBeVisible({ timeout: 1000 });
  });
});
```

### Visual Regression Tests

**File:** `tests/e2e/quickview-visual.spec.ts`

```typescript
test('QuickView displays images without layout shift', async ({ page }) => {
  await page.goto('/browse');
  await page.locator('[data-testid="listing-card"]').first().click();
  await page.waitForSelector('[data-testid="quickview-modal"]');

  // Take screenshot after initial render
  const initial = await page.screenshot();

  // Wait for images to load
  await page.waitForTimeout(2000);

  // Take screenshot after load
  const loaded = await page.screenshot();

  // Compare layout (dimensions should match)
  expect(initial.length).toBe(loaded.length); // Rough check
});
```

### Performance Monitoring Tests

**File:** `tests/e2e/quickview-perf-metrics.spec.ts`

```typescript
test('QuickView image LCP is under 1.5s', async ({ page }) => {
  await page.goto('/browse');

  // Start measuring
  await page.evaluate(() => {
    window.__lcpEntries = [];
    new PerformanceObserver((list) => {
      window.__lcpEntries.push(...list.getEntries());
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.locator('[data-testid="listing-card"]').first().click();
  await page.waitForSelector('[data-testid="quickview-modal"]');
  await page.waitForTimeout(2000);

  const lcp = await page.evaluate(() => {
    const entries = window.__lcpEntries || [];
    return entries.length > 0 ? entries[entries.length - 1].startTime : null;
  });

  expect(lcp).toBeLessThan(1500);
});
```

---

## Success Metrics

| Metric | Current (Est.) | Target |
|--------|---------------|--------|
| QuickView LCP | 2-4s | <1.5s |
| Time to first image | 1-2s | <500ms |
| Navigation delay (J/K) | 1-2s | <300ms |
| Hover-to-open delay | 1-2s | <200ms |

---

## Files to Modify

### Phase 1 (Critical Fix)
- `src/components/listing/QuickView.tsx` - Use getAllImages()

### Phase 2 (Hover Preload)
- `src/hooks/useImagePreloader.ts` - New hook
- `src/components/browse/ListingCard.tsx` - Add hover handler

### Phase 3 (Navigation Prefetch)
- `src/contexts/QuickViewContext.tsx` - Add prefetch logic

### Test Files (New)
- `tests/components/listing/QuickView.test.tsx`
- `tests/e2e/quickview-image-performance.spec.ts`
- `tests/e2e/quickview-perf-metrics.spec.ts`

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Preloading consumes bandwidth | Only preload on hover (intentional), limit to 2-3 images |
| Memory usage on mobile | Use browser-managed cache, don't hold references |
| Breaking existing functionality | Unit tests verify backwards compatibility |
| Next.js Image optimization conflicts | Test with various image sources |

---

## Implementation Order

1. **Phase 1** - Critical bug fix (immediate)
2. **Phase 2** - Hover preloading (high-value)
3. **Phase 3** - Navigation prefetching (nice-to-have)
4. **Phase 4** - Advanced optimizations (future)

Each phase is independently deployable with measurable improvements.
