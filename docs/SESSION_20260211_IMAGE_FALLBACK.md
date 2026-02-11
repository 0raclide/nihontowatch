# Session: Card Thumbnail Image Fallback with Caching

**Date:** 2026-02-11
**Trigger:** Listing 42957 (Goushuya, Juyo Bijutsuhin tachi) — 3 of 4 dealer image URLs expired, 1 Supabase stored image valid. Card thumbnail showed broken icon despite a working image existing at index 2.

## Problem

When a listing's first image URL fails to load (e.g. dealer removed/moved the file), the `ListingCard` thumbnail immediately shows a broken image icon — even if working images exist further in the array.

**Listing 42957 specifics:**
- `images[]` — 4 URLs from goushuya-nihontou.com (3 broken, 1 broken)
- `stored_images[]` — 1 URL from Supabase CDN (`goushuya/L42957/02.jpg`, maps to index 2)
- `getAllImages()` merges by index: `[dealer0, dealer1, stored2, dealer3]`
- Card tried index 0, failed, showed broken icon. Never reached the working image at index 2.

## Solution

Two-part fix in `ListingCard.tsx`:

### 1. Sequential fallback through image array

Instead of `getImageUrl(listing)` (returns only index 0), the card now uses `getAllImages(listing)` and cycles through on failure.

- `allImages` computed in `useMemo` (same as before, just exposed as array)
- `fallbackIndex` state triggers re-evaluation after each `onError`
- Shimmer skeleton stays visible during fallback attempts
- Only shows broken icon after ALL images exhausted

### 2. Broken URL caching (avoids re-trying on reload)

When an image fails, the URL is marked as broken in two caches:

| Cache | Scope | Purpose |
|-------|-------|---------|
| `validationCache` (in-memory Map in `images.ts`) | SPA session | Skip broken URLs during client-side navigation |
| `sessionStorage` (`nw:img:bad:{url}` keys) | Browser session | Skip broken URLs after hard reload |

On render, `imageUrl` is computed by iterating `allImages` and skipping any URL found in either cache. This means:

- **First visit:** tries images sequentially (~1-2s of shimmer for 2 failures)
- **Same-session navigation:** broken URLs skipped instantly from memory
- **Hard reload:** broken URLs skipped instantly from sessionStorage
- **New browser session:** sessionStorage cleared, rediscovers (self-healing if dealer fixes images)

## Files Changed

| File | Change |
|------|--------|
| `src/components/browse/ListingCard.tsx` | Import `getAllImages`/`getCachedValidation`/`setCachedValidation`; add `fallbackIndex` state; cache-aware `imageUrl` computation; `onError` marks broken + tries next; shimmer gated on `imageUrl` existing |
| `tests/components/browse/ListingCard.test.tsx` | Updated mock to include `getAllImages`, `getCachedValidation`, `setCachedValidation` |

## How It Works (data flow)

```
Component mounts, fallbackIndex = 0
    │
    ▼
imageUrl = useMemo: iterate allImages[]
    ├─ validationCache says 'invalid'? → skip
    ├─ sessionStorage has 'nw:img:bad:{url}'? → skip (+ warm memory cache)
    └─ return first non-skipped URL (or null)
    │
    ▼
<Image src={imageUrl} />
    │
    ├─ onLoad → setIsLoading(false) → thumbnail visible ✓
    │
    └─ onError →
        ├─ setCachedValidation(url, 'invalid')
        ├─ sessionStorage.setItem('nw:img:bad:{url}', '1')
        ├─ any remaining non-invalid URLs? → setFallbackIndex(+1) → re-render
        └─ none remaining? → setHasError(true) → broken icon
```

## QuickView (already handled)

The QuickView gallery was NOT affected — `useValidatedImages` hook already filters out broken images by loading each via `new Image()` and checking `onerror`. Only valid images appear in the gallery.

## Risk Assessment

- **Zero impact on working images**: fallbackIndex stays 0, imageUrl = allImages[0], no caching triggered
- **sessionStorage cleanup**: auto-cleared on browser close; no stale entries
- **Self-healing**: if a dealer fixes their images, new browser sessions will rediscover them
- **No server changes**: purely client-side fix

## Commits

- `e81237a` — Initial fallback logic (linter reverted the onError handler)
- `54ef1d4` — Full fix with caching (sessionStorage + validationCache)
