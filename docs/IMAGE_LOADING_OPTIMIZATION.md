# Image Loading Optimization

## Date: 2026-02-07

## Summary

Investigated and optimized QuickView image loading performance to eliminate "jumpy" layout shifts.

---

## Investigation Findings

### 1. Next.js Image Optimization is Correct

**Hypothesis tested:** Bypass Next.js Image for Supabase CDN images.

**Result:** REVERTED - Next.js Image is actually faster and produces smaller files.

| Method | Time | Size |
|--------|------|------|
| Next.js Image API | 0.2-0.7s | 8-132KB (AVIF/WebP) |
| Direct Supabase CDN | 1.1-1.7s | 83KB-4MB (original JPEG) |

**Conclusion:** Vercel edge caching + AVIF compression provides 2-5x faster loading with 10-50x smaller files. Keep using Next.js Image for all images.

### 2. Layout Shift Root Causes

Identified multiple sources of "jumpiness" in QuickView:

| Issue | Severity | Location |
|-------|----------|----------|
| Unknown image dimensions | HIGH | Uses `h-auto` causing layout recalc on load |
| Inconsistent aspect ratios | HIGH | 3:4 placeholder → min-h-300px loading → h-auto loaded |
| Validation removing images | MEDIUM | `useValidatedImages` filters images mid-scroll |
| DOM swap on visibility | MEDIUM | Different DOM trees for visible/not-visible states |

### 3. Database Gap

**Image dimensions are NOT stored in the database.**

- Oshi-scrapper downloads images but doesn't capture dimensions
- Frontend uses hardcoded aspect ratios or `h-auto`
- No way to know image proportions before loading

---

## Solution Implemented

### Dimension Caching During Preload

Instead of forcing fixed aspect ratios (which breaks for tall swords, wide certificates, etc.), we cache actual dimensions during the hover preload phase.

**Flow:**
```
1. User hovers listing card
2. Preloader fetches first 3 images
3. On image load, cache dimensions: {width, height, aspectRatio}
4. User clicks → QuickView opens
5. LazyImage checks cache → uses known dimensions for aspect ratio
6. Container sized correctly from the start → no layout shift
```

### Files Changed

| File | Change |
|------|--------|
| `src/lib/images.ts` | Added dimension cache (`getCachedDimensions`, `setCachedDimensions`) |
| `src/hooks/useImagePreloader.ts` | Cache `naturalWidth`/`naturalHeight` on preload |
| `src/components/listing/QuickView.tsx` | Use cached dimensions for dynamic aspect ratio |

### Code Details

**Dimension Cache (images.ts):**
```typescript
export interface ImageDimensionsCache {
  width: number;
  height: number;
  aspectRatio: number;
}

const dimensionCache = new Map<string, ImageDimensionsCache>();

export function getCachedDimensions(url: string): ImageDimensionsCache | undefined;
export function setCachedDimensions(url: string, width: number, height: number): void;
```

**Preloader Enhancement (useImagePreloader.ts):**
```typescript
img.onload = () => {
  const { naturalWidth, naturalHeight } = img;
  setCachedDimensions(url, naturalWidth, naturalHeight);
  // ... existing validation logic
};
```

**LazyImage Container (QuickView.tsx):**
```typescript
const cachedDimensions = getCachedDimensions(src);
const hasKnownDimensions = !!cachedDimensions;

// Container uses dynamic aspect ratio when dimensions are known
const containerStyle = hasKnownDimensions
  ? { aspectRatio: `${cachedDimensions.width} / ${cachedDimensions.height}` }
  : undefined;
```

---

## Behavior Matrix

| Scenario | Layout Behavior |
|----------|-----------------|
| Hover then click (normal flow) | Dimensions cached → stable layout |
| Direct link (no hover) | Falls back to min-h-300px → slight shift on load |
| Return visit to same listing | Dimensions already cached → stable |
| J/K navigation | Images preloaded → mostly stable |

---

## Future Improvements

### Store Dimensions at Scrape Time (Recommended)

The proper long-term fix is to capture dimensions in Oshi-scrapper:

```sql
ALTER TABLE listings ADD COLUMN image_dimensions JSONB;
-- Format: [{"url": "...", "width": 2000, "height": 3500}, ...]
```

**Where to add in Oshi-scrapper:**
- `SupabaseStorage._upload_single_image()` - Extract with PIL before upload
- Store alongside `stored_images` in the database

This would eliminate the need for client-side dimension discovery entirely.

### Preload More Images on Navigation

Currently J/K navigation doesn't prefetch the next listing's images. Could add:

```typescript
const goToNext = () => {
  setCurrentIndex(prev => prev + 1);
  // Prefetch next+1 listing
  if (listings[currentIndex + 2]) {
    preloadListing(listings[currentIndex + 2]);
  }
};
```

---

## Commits

1. `b263017` - perf: Bypass Next.js Image optimization (REVERTED)
2. `a02d2a3` - Revert bypass (Next.js Image is better)
3. `2451e91` - fix: Fixed aspect ratio (REVERTED - bad for tall images)
4. `8f80e2e` - Revert fixed aspect ratio
5. `60b6b4f` - fix: Cache image dimensions during preload for stable layouts (CURRENT)

---

## Key Learnings

1. **Always test with real data** - Fixed aspect ratios seemed right but broke for dealers with tall composite images

2. **Next.js Image optimization is valuable** - The extra hop through Vercel is worth it for edge caching + format conversion

3. **Preload is underutilized** - We were already loading images on hover but discarding dimension data

4. **Client-side caching can bridge gaps** - When server-side data is incomplete, intelligent caching on the client can smooth over issues
