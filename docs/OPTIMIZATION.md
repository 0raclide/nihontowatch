# Performance Optimization Guide

This document describes the performance optimizations implemented in Nihontowatch to ensure fast, snappy image loading and overall responsive UI.

## Overview

The key optimizations focus on:
1. **Staggered image loading** - Only load images near the viewport
2. **API caching** - Edge caching and in-memory facet cache
3. **Next.js Image optimization** - AVIF/WebP conversion, proper sizing
4. **QuickView preloading** - Hover preloading and navigation prefetching

---

## Image Loading Strategy

### Problem
With 100 items per page, all images were loading simultaneously, causing:
- Network congestion
- Slow LCP (Largest Contentful Paint)
- High bandwidth usage
- Poor perceived performance

### Solution: Intersection Observer

**File**: `src/components/browse/ListingGrid.tsx`

We implemented a custom `useVisibleCards` hook that:
1. Tracks which cards are within 200px of the viewport
2. Only marks cards as "visible" when they enter this zone
3. Pre-loads the next 5 cards when a card becomes visible
4. First 10 cards are always marked as priority (above-the-fold)

```typescript
// Key configuration
const PRIORITY_COUNT = 10;        // Above-the-fold images
const INTERSECTION_MARGIN = '200px'; // Load buffer zone
```

### QuickView Image Optimization

**File**: `src/components/listing/QuickView.tsx`

The modal image viewer uses Next.js Image component:
- First image loads eagerly
- Subsequent images load lazily
- Blur placeholder shown during load
- AVIF/WebP format conversion enabled
- **Uses `getAllImages()` to prefer CDN URLs** over dealer URLs

#### CDN-First Image Loading

QuickView uses `getAllImages()` from `src/lib/images.ts` to prioritize:
1. `stored_images` - Supabase Storage CDN (fast, reliable)
2. `images` - Original dealer URLs (fallback)

```typescript
// QuickView.tsx
import { getAllImages } from '@/lib/images';

const images = getAllImages(currentListing);
```

This ensures consistent fast loading between grid cards and QuickView modal.

### Image Quality Validation

**Files**: `src/lib/images.ts`, `src/lib/constants.ts`, `src/hooks/useValidatedImages.ts`

The scraper sometimes captures UI elements (icons, buttons, navigation elements) alongside actual product images. These are filtered out client-side before display.

#### Quality Thresholds

From `src/lib/constants.ts`:

```typescript
IMAGE_QUALITY = {
  MIN_WIDTH: 100,         // Filters tiny icons
  MIN_HEIGHT: 100,        // Filters tiny buttons
  MIN_AREA: 15000,        // ~125x120 minimum area
  MIN_ASPECT_RATIO: 0.15, // Rejects extremely tall ribbons (1:6.67)
  MAX_ASPECT_RATIO: 6.0,  // Rejects extremely wide banners (6:1)
}
```

#### Validation Function

```typescript
import { isValidItemImage } from '@/lib/images';

const result = isValidItemImage({ width: 73, height: 27 });
// { isValid: false, reason: 'too_narrow' }

const result2 = isValidItemImage({ width: 600, height: 600 });
// { isValid: true }
```

#### useValidatedImages Hook

Components use the `useValidatedImages` hook to filter images:

```typescript
import { useValidatedImages } from '@/hooks/useValidatedImages';
import { getAllImages } from '@/lib/images';

const rawImages = getAllImages(listing);
const { validatedImages } = useValidatedImages(rawImages);
// validatedImages only contains images that pass quality checks
```

**Benefits:**
- Filters out accidentally scraped icons/buttons/UI elements
- No API changes required (client-side validation)
- Graceful degradation (validation happens asynchronously)
- Centralized thresholds in constants.ts

---

## QuickView Preloading

### Hover Preloading

**Files**: `src/hooks/useImagePreloader.ts`, `src/components/browse/ListingCard.tsx`

When a user hovers over a listing card for 150ms+, the first 3 QuickView images are preloaded in the background.

```typescript
// ListingCard.tsx
const handleMouseEnter = useCallback(() => {
  hoverTimerRef.current = setTimeout(() => {
    preloadListing(listing);
  }, 150);
}, []);
```

**Benefits:**
- Images ready before modal opens
- Near-instant QuickView display for intentional clicks
- Cancelled if user moves away quickly (no wasted bandwidth)

### Navigation Prefetching

**File**: `src/contexts/QuickViewContext.tsx`

When viewing a listing in QuickView, images for adjacent listings (prev/next) are automatically preloaded.

```typescript
// Preload adjacent listings for J/K navigation
useEffect(() => {
  if (!isOpen || currentIndex === -1) return;

  if (currentIndex > 0) {
    preloadImages(listings[currentIndex - 1]);
  }
  if (currentIndex < listings.length - 1) {
    preloadImages(listings[currentIndex + 1]);
  }
}, [currentIndex, isOpen, listings]);
```

**Benefits:**
- Instant J/K keyboard navigation
- Smooth browsing experience when flipping through listings

### useImagePreloader Hook

**File**: `src/hooks/useImagePreloader.ts`

A reusable hook for browser-level image preloading:

```typescript
const { preloadListing, cancelPreloads } = useImagePreloader();

// Preload first 3 images from a listing
preloadListing(listing);

// Cancel active preloads (e.g., on mouse leave)
cancelPreloads();
```

Features:
- Deduplication (won't re-preload cached URLs)
- Cancellation support
- Uses `getAllImages()` to prefer CDN URLs

---

## API Caching

### Browse API Cache Headers

**File**: `src/app/api/browse/route.ts`

The browse endpoint returns cache headers for edge caching:

```typescript
response.headers.set(
  'Cache-Control',
  `public, s-maxage=${CACHE.BROWSE_RESULTS}, stale-while-revalidate=${CACHE.SWR_WINDOW}`
);
```

Configuration from `src/lib/constants.ts`:
- `CACHE.BROWSE_RESULTS`: 300 seconds (5 minutes)
- `CACHE.SWR_WINDOW`: 600 seconds (10 minutes stale-while-revalidate)

### In-Memory Facet Cache

Facet queries (item types, certifications, dealers) are cached in-memory:
- TTL: 60 seconds
- Keyed by tab (available/sold)
- Reduces DB queries from 3 per request to ~1 per minute

```typescript
const FACET_CACHE_TTL = 60000; // 60 seconds
```

---

## Cache Configuration Reference

From `src/lib/constants.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `CACHE.BROWSE_RESULTS` | 300s | Browse API edge cache |
| `CACHE.LISTING_DETAIL` | 600s | Individual listing cache |
| `CACHE.FACETS` | 300s | Facet counts cache |
| `CACHE.DEALERS` | 3600s | Dealer list cache |
| `CACHE.SWR_WINDOW` | 600s | Stale-while-revalidate window |

---

## Next.js Image Configuration

**File**: `next.config.ts`

```typescript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '**' },
    { protocol: 'http', hostname: '**' },
  ],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
}
```

### Image Sizes Attribute

Responsive images use the `sizes` attribute for optimal delivery:

| Component | Sizes |
|-----------|-------|
| ListingCard | `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw` |
| QuickView | `(max-width: 1024px) 100vw, 60vw` |

---

## Core Web Vitals Targets

| Metric | Target | Description |
|--------|--------|-------------|
| LCP | < 2.5s | Largest Contentful Paint |
| FID/INP | < 100ms | First Input Delay / Interaction to Next Paint |
| CLS | < 0.1 | Cumulative Layout Shift |

### How to Measure

1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select "Mobile" and "Performance"
4. Click "Analyze page load"

Or use: https://pagespeed.web.dev/

---

## Testing Performance

### Network Tab Analysis

1. Open DevTools → Network tab
2. Load the browse page
3. Filter by "Img" to see image requests
4. Verify staggered loading (images load as you scroll, not all at once)

### Expected Behavior

- First 10 images load immediately (priority)
- Other images load as cards enter viewport buffer
- Scroll down → new images start loading 200px before visible
- Cache-Control header present on API responses

---

## Future Optimizations

### Considered but Not Implemented

1. **Virtual scrolling** - For extremely long lists (1000+ items)
2. **Service Worker** - Offline caching
3. **Dynamic imports** - Lazy-load heavy modals
4. **Prefetching** - Prefetch next page on hover

### When to Add Virtual Scrolling

Consider adding `react-window` or `@tanstack/react-virtual` if:
- Page shows 500+ items
- Users experience memory issues on mobile
- Scroll performance degrades significantly

---

## Troubleshooting

### Images Not Loading Lazily

Check that:
1. `loading="lazy"` is set on non-priority images (handled automatically by ListingCard)
2. IntersectionObserver is supported (all modern browsers)
3. CSS `content-visibility: auto` is active on mobile (`.ios-native-virtualize` class)

### Cache Not Working

Verify:
1. `Cache-Control` header in API response
2. No `force-dynamic` export in route file
3. Vercel/CDN configuration allows caching

### High Memory Usage

If mobile devices crash on long scroll:
- Consider implementing virtual scrolling
- Limit accumulated items in infinite scroll

---

## Related Files

- `src/components/browse/ListingGrid.tsx` - Intersection observer hook
- `src/components/browse/ListingCard.tsx` - Visibility-based image loading, hover preloading
- `src/components/listing/QuickView.tsx` - Modal image optimization, CDN-first loading
- `src/contexts/QuickViewContext.tsx` - Navigation prefetching for J/K keys
- `src/hooks/useImagePreloader.ts` - Reusable image preloading hook
- `src/lib/images.ts` - Image URL resolution with CDN fallback
- `src/app/api/browse/route.ts` - API caching and facet cache
- `src/lib/constants.ts` - Cache configuration values
- `next.config.ts` - Image optimization settings
