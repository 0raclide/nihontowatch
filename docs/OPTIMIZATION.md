# Performance Optimization Guide

This document describes the performance optimizations implemented in Nihontowatch to ensure fast, snappy image loading and overall responsive UI.

## Overview

The key optimizations focus on:
1. **Staggered image loading** - Only load images near the viewport
2. **API caching** - Edge caching and in-memory facet cache
3. **Next.js Image optimization** - AVIF/WebP conversion, proper sizing

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

### ListingCard Visibility Prop

**File**: `src/components/browse/ListingCard.tsx`

Cards accept an `isNearViewport` prop that controls image loading:
- `true`: Load the actual image with Next.js Image optimization
- `false`: Show a placeholder div (no network request)

```typescript
interface ListingCardProps {
  // ...
  isNearViewport?: boolean; // Controls lazy loading
}
```

### QuickView Image Optimization

**File**: `src/components/listing/QuickView.tsx`

The modal image viewer uses Next.js Image component:
- First image loads eagerly
- Subsequent images load lazily
- Blur placeholder shown during load
- AVIF/WebP format conversion enabled

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
1. `isNearViewport` prop is being passed to ListingCard
2. IntersectionObserver is supported (all modern browsers)
3. Cards have `data-index` attribute

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
- `src/components/browse/ListingCard.tsx` - Visibility-based image loading
- `src/components/listing/QuickView.tsx` - Modal image optimization
- `src/app/api/browse/route.ts` - API caching and facet cache
- `src/lib/constants.ts` - Cache configuration values
- `next.config.ts` - Image optimization settings
