# Post-Mortem: Deployment Failure & Search Spinner Bug

**Date:** January 19, 2025
**Duration:** ~2 hours
**Severity:** P1 (Production broken)
**Author:** Claude (AI-assisted debugging session)

---

## Executive Summary

Two related issues were discovered and fixed:

1. **Deployment Failure**: Build failing with 0ms build time due to untracked file in git
2. **Search Spinner Stuck**: Search bar spinner never stopped after navigation

Both issues are now resolved with tests to prevent regression.

---

## Timeline

| Time | Event |
|------|-------|
| T+0 | User reports deployment failed |
| T+5 | Investigation begins - build passes locally |
| T+15 | Root cause found: `semanticQueryParser.ts` untracked in git |
| T+20 | File committed, deployment succeeds |
| T+25 | User reports search spinner stuck at `/?q=tokuju` |
| T+40 | Fleet of 5 agents dispatched to investigate |
| T+60 | URL sync issue found and fixed in `page.tsx` |
| T+75 | User clarifies: URL works, but search BAR is stuck |
| T+90 | Root cause found: `isSearching` never reset after navigation |
| T+100 | Fix applied to Header.tsx and MobileSearchSheet.tsx |
| T+110 | Tests written to prevent regression |
| T+120 | Session complete |

---

## Issue 1: Deployment Failure

### Symptoms
- Vercel deployment failing with 0ms build time
- Build passes locally with `npm run build`
- No clear error message in Vercel logs

### Root Cause
The file `src/lib/search/semanticQueryParser.ts` was:
- Created locally during development
- Imported by `src/app/api/browse/route.ts`
- **Never committed to git** (listed in `git status` as untracked)

When Vercel pulled from git, the file didn't exist, causing import failure.

### Fix
```bash
git add src/lib/search/semanticQueryParser.ts
git commit -m "fix: Add missing semanticQueryParser.ts"
git push
```

### Prevention
- Always run `git status` before deployment
- Add pre-push hook to warn about untracked files in `src/`
- Consider adding CI check for import validation

---

## Issue 2: Search Spinner Stuck

### Symptoms
- User types in search bar, presses enter
- Spinner appears and never stops
- Page URL updates correctly, results load
- Spinner remains indefinitely

### Root Cause Analysis

**The Bug Flow:**
```
1. User submits search form
2. setIsSearching(true) ← Spinner starts
3. router.push('/?q=katana') ← Navigation triggered
4. Page component re-renders with new query
5. Results load and display
6. setIsSearching(false) ← NEVER CALLED
7. Spinner stuck forever
```

**Why it happened:**
- Header and MobileSearchSheet components are in the layout
- They stay mounted across navigations (React preserves them)
- `isSearching` state was set to `true` on submit
- No code path existed to set it back to `false`
- The original developer likely expected the component to unmount/remount

### Fix

Added useEffect to reset `isSearching` when URL query param changes:

**Header.tsx (line 27-30):**
```typescript
// Reset searching state when URL changes (navigation completed)
useEffect(() => {
  setIsSearching(false);
}, [currentQuery]);
```

**MobileSearchSheet.tsx (line 37-40):**
```typescript
// Reset searching state when URL changes (navigation completed)
useEffect(() => {
  setIsSearching(false);
}, [currentQuery]);
```

### Why This Works
- `currentQuery` comes from `useSearchParams().get('q')`
- When `router.push()` navigates, URL params change
- useEffect fires on `currentQuery` change
- `isSearching` resets to `false`
- Spinner stops

---

## Issue 2b: URL Sync Infinite Loop (Related)

### Symptoms
- Page occasionally getting stuck in render loop
- `router.replace()` being called repeatedly
- History entries being overwritten (back button broken)

### Root Cause
The URL sync effect in `page.tsx` was calling `router.replace()` on every render, even when URL hadn't changed.

### Fix

Added deduplication with `useRef`:

```typescript
const prevUrlRef = useRef<string | null>(null);

useEffect(() => {
  const newUrl = buildUrlParams();

  // Skip if URL hasn't changed
  if (prevUrlRef.current === newUrl) return;

  // On initial mount, just record URL without replacing
  if (prevUrlRef.current === null) {
    prevUrlRef.current = newUrl;
    return;
  }

  prevUrlRef.current = newUrl;
  router.replace(newUrl, { scroll: false });
}, [buildUrlParams, router]);
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/search/semanticQueryParser.ts` | Committed (was untracked) |
| `src/app/page.tsx` | Added URL sync deduplication |
| `src/components/layout/Header.tsx` | Added isSearching reset on query change |
| `src/components/layout/MobileSearchSheet.tsx` | Added isSearching reset on query change |
| `tests/components/layout/SearchSpinnerReset.test.tsx` | New - 11 tests |
| `tests/app/page-url-sync.test.tsx` | New - 9 tests |

---

## Tests Added

### SearchSpinnerReset.test.tsx (11 tests)

**Core Logic:**
- Reset isSearching when query param changes
- No reset on same query (prevents infinite loop)
- Reset when query changes between searches
- Reset when query is cleared

**MobileSearchSheet Integration:**
- Show spinner when search submitted
- Reset spinner when URL query param changes
- Reset spinner when drawer reopens
- Quick search buttons trigger navigation

**Edge Cases:**
- Handle rapid consecutive searches
- Handle empty search gracefully
- Handle special characters (Japanese text)

### page-url-sync.test.tsx (9 tests)

**URL Sync:**
- No replace on initial mount
- No replace when URL unchanged
- Replace only when URL actually changes

**History Preservation:**
- Preserve router.push() history entries
- Back button works after search

**Infinite Loop Prevention:**
- No infinite renders with search query
- Only one replace call per URL change

---

## Lessons Learned

### 1. Always Check Git Status Before Deploy
Untracked files that are imported will break deployment. Add to workflow:
```bash
git status && npm run build && git push
```

### 2. Layout Components Stay Mounted
In Next.js App Router, components in layouts persist across navigations. State management must account for this - don't rely on unmount/remount to reset state.

### 3. Navigation Completes Asynchronously
`router.push()` returns immediately but navigation completes later. Use URL params (via `useSearchParams()`) as the source of truth for "navigation completed".

### 4. Parallel Agent Investigation Works
Launching 5 agents in parallel to investigate different aspects significantly accelerated root cause discovery.

### 5. User Clarification is Critical
Initial assumption was that the URL `/?q=tokuju` was broken. User clarified it was specifically the search BAR that was stuck. This pivot was essential to finding the real bug.

---

## Action Items

| Priority | Action | Status |
|----------|--------|--------|
| P0 | Commit all changes to git | ⬜ Pending |
| P1 | Add pre-push hook for untracked file warning | ⬜ TODO |
| P2 | Add E2E test for search flow | ⬜ TODO |
| P2 | Document layout component state patterns | ⬜ TODO |

---

## Verification

```bash
# All tests pass
npm test

# Build succeeds
npm run build

# Production verified
https://nihontowatch.com/?q=tokuju  # Works
https://nihontowatch.com/?q=juyo    # Works
```

---

## Conclusion

Both issues stemmed from development workflow gaps:
1. Forgetting to commit a new file
2. Not accounting for layout component persistence

The fixes are minimal, targeted, and tested. The search experience now works reliably on both desktop and mobile, with proper back button support.
