# Post-Mortem: Image Cache Poisoning via useImagePreloader (BUG-011)

**Date:** 2026-02-13
**Trigger:** Listing 1277 (Tosogu, Toku Hozon) — user opens QuickView, all images appear briefly, then flash and reload showing only the certificate. Other item images vanish permanently for the session.
**Severity:** High — affects any listing the user hovers before clicking
**Status:** Fixed

---

## Timeline

| When | What |
|------|------|
| 2026-02-10 | Image disappearance first reported. Root cause identified as **validation cache poisoning** — transient image load errors cached as `'invalid'`, permanently hiding images in QuickView. |
| 2026-02-10 | Fix shipped in commit `20b6662`: patched `onerror` handlers in `QuickViewContext.tsx` and `useValidatedImages.ts` to stop caching transient failures. |
| 2026-02-13 | Same symptom reappears on listing 1277. Investigation reveals the fix was **incomplete** — a third location (`useImagePreloader.ts`) was never patched and still poisons the cache. |
| 2026-02-13 | Full fix shipped: removed cache poisoning from `useImagePreloader.ts` onerror + fixed `cancelPreloads()` triggering onerror. Golden regression test added. |

---

## Root Cause

Three separate code paths could write `setCachedValidation(url, 'invalid')` on image load errors:

| Location | Purpose | Fixed in 20b6662? |
|----------|---------|-------------------|
| `QuickViewContext.tsx` onerror | Background prefetch of listing images | Yes |
| `useValidatedImages.ts` onerror | Dimension validation of displayed images | Yes |
| **`useImagePreloader.ts` onerror** | **Hover-triggered preload of card images** | **No — missed** |

The third location was the most dangerous because it fires **before the user even clicks** — just hovering over a listing card triggers preloading. This made the bug appear non-deterministic: whether images disappeared depended on hover timing, network conditions, and Vercel image optimizer responsiveness.

### The Poisoning Chain

```
User hovers listing card
        │
        ▼
useImagePreloader fires (after 150ms delay)
        │
        ├── Loads image 1 ─── OK ──── cached as 'valid'
        ├── Loads image 2 ─── FAIL ── cached as 'invalid'  ← POISON
        └── Loads image 3 ─── OK ──── cached as 'valid'
        │
User clicks listing → QuickView opens
        │
        ▼
useValidatedImages checks cache
        │
        ├── Image 1: cache hit 'valid'   → show
        ├── Image 2: cache hit 'invalid' → HIDDEN
        └── Image 3: cache hit 'valid'   → show
        │
        ▼
User sees all images briefly (initial render before validation)
Then flash → image 2 disappears (validation filters it out)
```

### Compounding Bug: `cancelPreloads()` Also Poisoned

A second bug in the same file made things worse. When the user moves their mouse away from a card, `cancelPreloads()` is called, which did:

```javascript
img.src = ''; // Abort the request
```

In most browsers, setting `img.src = ''` fires the `onerror` handler. Since `onerror` cached failures as `'invalid'`, simply **hovering over a card and moving away** could poison the cache for that listing's first 3 images — even if the images were perfectly valid and would have loaded fine.

---

## Fix

Two changes in `src/hooks/useImagePreloader.ts`:

### 1. Remove cache poisoning from onerror

```diff
 img.onerror = () => {
   const index = activePreloads.current.indexOf(img);
   if (index > -1) activePreloads.current.splice(index, 1);

-  if (getCachedValidation(url) === undefined) {
-    setCachedValidation(url, 'invalid');
-  }
+  // Don't poison validation cache on transient load failures.
+  // Preload errors can be caused by network timeouts, Vercel image
+  // optimizer hiccups, CORS issues, or cancelPreloads() aborting
+  // in-flight requests.
 };
```

### 2. Detach handlers before aborting in cancelPreloads

```diff
 const cancelPreloads = useCallback(() => {
   activePreloads.current.forEach(img => {
+    img.onload = null;
+    img.onerror = null;
     img.src = '';
   });
   activePreloads.current = [];
 }, []);
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useImagePreloader.ts` | Removed `setCachedValidation(url, 'invalid')` from onerror; detach handlers before aborting in `cancelPreloads()` |
| `tests/hooks/useImagePreloader.test.ts` | Added golden test suite: "cache poisoning prevention" — 4 tests covering onerror, cancelPreloads, and the exact hover→click→disappear scenario |

---

## Why the Original Fix Was Incomplete

The commit `20b6662` correctly identified cache poisoning as the root cause but only grepped for the pattern in files where images are **displayed** (QuickView rendering path). The preloader hook was a **producer** that wrote to the same shared cache but was in a different part of the codebase (`hooks/` vs `components/` and `contexts/`).

The validation cache (`Map<string, 'valid' | 'invalid'>` in `src/lib/images.ts`) is a **global singleton** shared across all hooks and components. Any code path that calls `setCachedValidation(url, 'invalid')` affects every downstream consumer. The original fix patched 2 of 3 writers but missed the most aggressive one (fires on hover, not on click).

---

## Lessons Learned

1. **When fixing cache poisoning, audit ALL writers to the cache, not just the ones near the symptom.** A quick `grep -r 'setCachedValidation.*invalid'` across the entire codebase would have caught all three locations.

2. **Preloaders are dangerous cache writers** because they fire speculatively (on hover), before the user commits to viewing the content. Errors during speculative operations should never be treated as authoritative.

3. **Aborting in-flight `Image` requests by setting `src = ''` triggers `onerror`** in most browsers. Always detach event handlers before aborting to prevent side effects.

4. **Golden tests should exist for any invariant this subtle.** The test suite now directly asserts that `getCachedValidation()` returns `undefined` (not `'invalid'`) after preload errors, making it impossible to reintroduce this bug without a test failure.

---

## Golden Test

Added in `tests/hooks/useImagePreloader.test.ts` — a dedicated `describe('cache poisoning prevention')` block with 4 tests:

1. **onerror must NOT cache 'invalid'** — preload a URL, fire onerror, assert validation cache is `undefined`
2. **cancelPreloads must NOT trigger cache poisoning** — preload a URL, cancel, assert validation cache is `undefined`
3. **cancelPreloads detaches handlers** — preload, cancel, verify onload/onerror are null
4. **Full scenario: hover → error → click → images survive** — simulates the exact user flow that triggered the bug, asserting that QuickView would still see valid images after a preload failure
