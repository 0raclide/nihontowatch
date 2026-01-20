# Postmortem: OG Image Caching - RESOLVED

**Date:** 2026-01-20
**Duration:** ~2.5 hours of debugging + 2 hours implementing solution
**Severity:** Medium (visual defect in social sharing)
**Status:** ✅ RESOLVED - Implemented share proxy with cache-busting

---

## Summary

After implementing pre-generated OG images with Pillow, a gradient overlay was visible on the product image. Despite **7 different fix attempts**, Discord continues to serve the old cached image. This is a case study in cache hell.

---

## The Problem

A dark gradient fade was added to the right edge of product images to blend into the text section. Users reported it looked bad on Discord. The gradient code was removed, but Discord kept showing the old image.

---

## What We Tried (All Failed for Discord)

### Attempt 1: Remove Gradient Code
```python
# Changed from complex gradient logic to:
def _add_edge_gradient(self, img):
    return img  # No-op
```
**Result:** Code fixed, but Discord still shows gradient.

### Attempt 2: Re-upload Image
Regenerated and uploaded new image to same path.
**Result:** Direct URL showed new image, Discord showed old.

### Attempt 3: Verify with Pixel Analysis
```python
# Checked pixels at junction (x=590-610)
x=599: RGB(255, 255, 255)  # White (product image)
x=600: RGB(20, 20, 20)     # Dark (text section)
# Sharp transition - NO GRADIENT in new image
```
**Result:** Confirmed new image is correct. Discord still wrong.

### Attempt 4: Fix Cache Headers
```python
# Changed from:
"cache-control": "public, max-age=31536000, immutable"  # 1 YEAR!

# To:
"cache-control": "public, max-age=3600"  # 1 hour
```
**Result:** No effect on Discord.

### Attempt 5: Delete + Re-upload
```python
# Delete old file first
self.storage.remove([path])
# Then upload new
self.storage.upload(path, data, ...)
```
**Result:** No effect on Discord.

### Attempt 6: Add Query Param to og_image_url
```python
# Updated database:
og_image_url = "...L00007.png?v=1768921253"
```
**Result:** No effect on Discord.

### Attempt 7: Versioned Filenames (Nuclear Option)
```python
# Changed filename pattern from:
"aoi-art/L00007.png"
# To:
"aoi-art/L00007_1768921557.png"  # Timestamp in filename
```
**Result:** STILL NO EFFECT. Discord shows old gradient image.

---

## Evidence of Caching Layers

```
Direct Supabase URL (with timestamp):     ✅ Shows NEW image (no gradient)
Direct Supabase URL (versioned filename): ✅ Shows NEW image (no gradient)
Browser viewing nihontowatch.com:         ✅ Shows NEW image (no gradient)
Discord preview:                          ❌ Shows OLD image (WITH gradient)
```

---

## The Caching Onion (All Layers)

```
┌─────────────────────────────────────────────────────────────────┐
│                      DISCORD SERVER CACHE                        │
│                                                                  │
│   - Caches og:image by PAGE URL, not image URL                  │
│   - Changing og:image URL has NO EFFECT                         │
│   - Versioned filenames have NO EFFECT                          │
│   - Query params have NO EFFECT                                 │
│   - Cache duration: UNKNOWN (hours? days? weeks?)               │
│   - Invalidation API: NONE                                      │
│                                                                  │
│   This layer is IMPENETRABLE                                    │
├─────────────────────────────────────────────────────────────────┤
│                    SUPABASE CDN CACHE                           │
│   - Fixed by delete + re-upload                                 │
│   - Fixed by versioned filenames                                │
│   ✅ SOLVED                                                     │
├─────────────────────────────────────────────────────────────────┤
│                     BROWSER CACHE                               │
│   - Fixed by query params                                       │
│   - Fixed by versioned filenames                                │
│   ✅ SOLVED                                                     │
├─────────────────────────────────────────────────────────────────┤
│                   SUPABASE STORAGE                              │
│   - File correctly updated                                      │
│   ✅ SOLVED                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Discord's Caching Behavior (Discovered)

Discord appears to cache OG images based on the **canonical page URL**, NOT the og:image URL. This means:

1. `nihontowatch.com/listing/7` → Discord fetches og:image ONCE
2. Discord caches this image associated with that page URL
3. Changing og:image URL does NOTHING - Discord ignores it
4. Even versioned filenames don't help
5. Only solution: Wait for Discord's cache to expire, or use a DIFFERENT page URL

### Possible Workarounds (Not Tested)

1. **Change the page URL**: `/listing/7` → `/listing/7?refresh=1` or `/l/7`
2. **Use Discord's cache refresh**: Some claim deleting/re-posting the link helps
3. **Wait**: Unknown duration, could be hours or days
4. **Open Graph Debugger**: Facebook has one, Discord doesn't

---

## Timeline of Pain

| Time | Action | Result |
|------|--------|--------|
| T+0 | User reports gradient looks bad | - |
| T+10m | Remove gradient code | Code fixed |
| T+15m | Re-upload image | Direct URL works, Discord broken |
| T+25m | Pixel analysis | Confirms new image is correct |
| T+35m | Fix cache headers (1yr → 1hr) | No effect |
| T+45m | Delete + re-upload | No effect |
| T+55m | Query param on og_image_url | No effect |
| T+70m | Versioned filename (nuclear) | No effect |
| T+90m | Rage | Postmortem |

---

## What Actually Works

For **new listings** that Discord has never seen:
- Versioned filenames will work perfectly
- No caching issues since it's a fresh URL

For **existing listings** already cached by Discord:
- **Nothing works** except waiting
- Or using a different page URL scheme

---

## Lessons Learned

1. **Test OG images in Discord BEFORE going to production** - Once cached, you're stuck
2. **Discord's cache is a black box** - No documentation, no invalidation, no control
3. **Versioned filenames help for CDN/browser, useless for Discord**
4. **The og:image URL is fetched once and cached by page URL**
5. **"Cache busting" is a lie when you don't control the cache**

---

## Recommendations

### Short Term
- Accept that existing cached images will show gradient until Discord cache expires
- All NEW listings will have correct images (no gradient)

### Medium Term
- Consider URL scheme that includes version: `/listing/7/v2`
- Or timestamp-based page URLs for cache control

### Long Term
- Monitor Discord's behavior over time to understand cache duration
- Consider server-side OG image proxy that can track/invalidate

---

## Files Changed

### Oshi-scrapper
- `utils/og_generator.py` - Removed gradient, added versioned filenames
- `scripts/generate_og_images.py` - Backfill script
- `db/repository.py` - Added `update_og_image()` method

### Nihontowatch
- `src/app/listing/[id]/page.tsx` - Uses og_image_url from database
- `src/types/index.ts` - Added og_image_url field

---

## The Bitter Truth

We did everything right:
- Removed the gradient code ✅
- Verified the new image is correct ✅
- Updated all cache headers ✅
- Used versioned filenames ✅
- Updated the database ✅

Discord simply doesn't care. It cached the image and will serve it until it decides not to.

**There is no fix. Only time.**

---

## THE SOLUTION - Share Proxy Route

### Key Insight

Discord caches OG images by **page URL**, not image URL. If we can't change the cache, we change the page URL!

### Implementation

1. **Created `/s/[id]` Share Proxy Route** (`src/app/s/[id]/page.tsx`)
   - Serves OG metadata with the current image
   - Redirects browsers to `/listing/[id]`
   - Uses versioned URL: `/s/123?v=abc123`

2. **Version Extraction from `og_image_url`**
   - Filename format: `dealer/LISTING_TIMESTAMP.png`
   - Example: `aoi-art/L00007_1768921557.png` → version `1768921557`
   - When OG image regenerates, timestamp changes, URL changes

3. **Updated ShareButton Component** (`src/components/share/ShareButton.tsx`)
   - Now copies `/s/[id]?v=[version]` instead of `/listing/[id]`
   - Passes `ogImageUrl` prop for version extraction

### How It Works

```
User clicks Share → Copies /s/123?v=1768921557
                           ↓
Discord scrapes /s/123?v=1768921557
                           ↓
Discord caches OG image for THIS URL
                           ↓
User clicks link → Redirects to /listing/123
                           ↓
When OG image updates → New timestamp → /s/123?v=1768921558
                           ↓
Discord sees NEW URL → Fresh cache entry!
```

### Files Changed

```
src/app/s/[id]/page.tsx           # New share proxy route
src/components/share/ShareButton.tsx    # Updated to use /s/ URLs
src/components/listing/QuickViewContent.tsx   # Pass ogImageUrl to ShareButton
src/components/listing/QuickViewMobileSheet.tsx  # Pass ogImageUrl to ShareButton
```

### Test Coverage (24 tests total)

```
tests/e2e/og-image-social-sharing.spec.ts  # 13 tests
tests/e2e/social-preview-visual.spec.ts    # 11 tests
```

Tests verify:
- OG meta tags on listing pages
- OG meta tags on share proxy pages
- Share URL generation with versioning
- Share proxy redirect behavior
- OG image accessibility and dimensions
- Cross-platform compatibility (Discord, Twitter, Facebook)
- Fallback OG image generation

### Benefits

1. **Existing cached shares**: Users can share the new `/s/` URL to bypass old cache
2. **New shares**: Automatically use versioned URLs
3. **Future updates**: When OG image regenerates, version changes, cache busts
4. **SEO preserved**: Canonical URL still points to `/listing/[id]`
5. **User experience**: Immediate redirect, no delay

### Bonus: Social Preview Component

Created `SocialPreviewCard` and `SocialPreviewPanel` components for:
- Discord preview
- Twitter/X preview
- Facebook preview
- iMessage preview

These help users see exactly how their share will appear before sending.

---

## Update Log

- [x] 2026-01-20: Initial failure documented
- [x] 2026-01-20: Solution implemented - Share proxy with cache-busting
- [x] 2026-01-20: 24 Playwright tests added
- [x] 2026-01-20: Social preview components created
