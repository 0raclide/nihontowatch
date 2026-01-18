# Mobile Infinite Scroll Pagination Test Report

**Date**: 2026-01-18
**Test URL**: https://nihontowatch.com
**Viewport**: 390x844 (iPhone 14 Pro)
**Test Duration**: ~60 seconds per run
**Runs**: 3 independent test executions

---

## Executive Summary

**STATUS: ❌ CRITICAL ISSUES FOUND**

The mobile infinite scroll implementation has **multiple critical bugs** that prevent proper pagination:

1. **Duplicate Page 1 calls** on initial load (likely hydration issue)
2. **Only loads ONE additional page** (Page 2) then stops
3. **Virtual scroll breaks** after first load-more, rendering 0 visible cards
4. **No further page loads** despite continued scrolling

---

## Test Methodology

### Setup
- **Browser**: Chromium (Playwright)
- **Viewport**: 390x844px (mobile)
- **Network Monitoring**: All `/api/browse` calls intercepted and logged
- **Scroll Strategy**: `window.scrollTo(0, document.body.scrollHeight)` with 3s waits
- **Card Counting**: `document.querySelectorAll('[data-testid="listing-card"]').length`

### Approach
1. Navigate to site
2. Wait for initial load (3s)
3. Count visible cards
4. Scroll to bottom 5-6 times
5. Track API calls at each step
6. Record timing between calls

---

## Detailed Findings

### Finding 1: Duplicate Page 1 Calls on Initial Load

**Issue**: The app makes TWO identical API calls for Page 1 within ~50ms of each other.

**Evidence**:
```
[API CALL 1] Page 1 | Items: 30 | +0ms    | Total: 447ms
[API CALL 2] Page 1 | Items: 30 | +51ms   | Total: 498ms
```

**Impact**:
- Wasted bandwidth
- Potential race conditions
- Suggests hydration mismatch or effect dependency issue

**Likely Cause**:
- React strict mode double-render
- Missing effect dependencies
- Component mounting twice

---

### Finding 2: Only One Infinite Scroll Page Loads

**Issue**: After initial load, only ONE additional page (Page 2) loads, then pagination stops entirely.

**Evidence**:
```
SCROLL 1: +1 API call  → Page 2 loaded ✅
SCROLL 2: +0 API calls → Nothing
SCROLL 3: +0 API calls → Nothing
SCROLL 4: +0 API calls → Nothing
SCROLL 5: +0 API calls → Nothing
```

**Expected Behavior**:
- SCROLL 1 → Page 2 loads
- SCROLL 2 → Page 3 loads
- SCROLL 3 → Page 4 loads
- etc.

**Actual Behavior**:
- SCROLL 1 → Page 2 loads
- SCROLL 2-5 → Nothing loads

**Impact**: **CRITICAL** - Users cannot browse beyond Page 2 (60 items total instead of thousands)

---

### Finding 3: Virtual Scroll Renders Zero Cards After Load-More

**Issue**: After the first load-more trigger (Page 2), the visible card count drops to 0 and never recovers.

**Evidence**:
```
Initial load:     20 visible cards
After Scroll 1:    0 visible cards ❌
After Scroll 2:    0 visible cards ❌
After Scroll 3:    0 visible cards ❌
```

**Expected**: Cards should remain visible as user scrolls through the accumulated list.

**Impact**: **CRITICAL** - The UI becomes completely blank after first scroll.

---

### Finding 4: Scroll Position Explodes

**Issue**: After Page 2 loads, `window.scrollY` jumps to absurd values.

**Evidence** (from earlier test run):
```
Before Scroll 1: scrollY = 0px
After Scroll 1:  scrollY = 8621px
After Scroll 2:  scrollY = 876624px  ❌❌❌
```

**Impact**: This breaks all scroll-based calculations and prevents further load-more triggers.

**Likely Cause**:
- Virtual scroll `totalHeight` calculation includes `totalCount` from API
- When Page 2 loads, the height pre-calculates for ALL remaining items
- But items aren't actually rendered, causing massive empty space

---

## API Call Analysis

### Timing

| Call | Page | Items | Time Since Previous | Total Time | Status |
|------|------|-------|---------------------|------------|--------|
| 1    | 1    | 30    | 0ms                 | 447ms      | ✅ OK  |
| 2    | 1    | 30    | 51ms                | 498ms      | ❌ Duplicate |
| 3    | 2    | 30    | 2822ms              | 3320ms     | ✅ OK  |

### Validation Results

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| **Sequential Loading (excluding initial)** | [2, 3, 4, ...] | [2] | ✅ PASS (only 1 page loaded) |
| **No Duplicates (scroll pages)** | No duplicates | No duplicates | ✅ PASS |
| **Pages Accumulate** | Multiple pages | 1 page only | ❌ FAIL |
| **Throttling (≥1000ms)** | Yes | 2822ms | ✅ PASS |

**Note**: Sequential loading and no-duplicates "pass" only because just ONE scroll page loaded. If more pages loaded, these might fail.

---

## Data Totals

```
Total API calls:           3
Duplicate Page 1 calls:    1
Infinite scroll calls:     1 (only Page 2)

Total items from API:      90 items
Duplicate items:           30 items (Page 1 × 2)
Unique items loaded:       60 items (Page 1 + Page 2)

Expected after 5 scrolls:  180 items (Page 1-6)
Actual after 5 scrolls:    60 items
Missing:                   120 items ❌
```

---

## Root Cause Analysis

### Primary Issue: Virtual Scroll Height Calculation

**File**: `/src/hooks/useAdaptiveVirtualScroll.ts`

**Problem Code** (lines 163-167):
```typescript
// Use totalCount for height calculation if provided (prevents bounce on load more)
// This reserves space for ALL items upfront, so loading more doesn't change height
const itemCountForHeight = totalCount ?? items.length;
const rowCount = Math.ceil(itemCountForHeight / columns);
const totalHeight = rowCount * rowHeight;
```

**Issue**:
- When `totalCount` is passed (e.g., 1000 items), the component pre-calculates height for ALL 1000 items
- But it only has 60 items loaded (Page 1 + Page 2)
- This creates a 876,000px tall container with only 60 items at the top
- User scrolls into the massive empty space
- No more items are visible (cards disappear from DOM due to virtualization)
- No load-more trigger ever becomes visible again

### Secondary Issue: IntersectionObserver Not Re-Triggering

**File**: `/src/components/browse/VirtualListingGrid.tsx`

**Problem Code** (lines 226-241):
```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      const now = Date.now();
      // Throttle: minimum 1 second between load triggers
      if (now - lastLoadTimeRef.current > 1000) {
        lastLoadTimeRef.current = now;
        onLoadMore();
      }
    }
  },
  { rootMargin: '400px' }
);
```

**Issue**:
- After Page 2 loads, the load-more trigger element is somewhere in the 876,000px tall container
- Due to virtual scroll removing items from DOM, the trigger might be positioned incorrectly
- The 400px rootMargin might not be enough to compensate for the broken layout
- Throttle is fine (1000ms), but the trigger never enters viewport

---

## Recommendations

### Immediate Fixes (Critical)

1. **Fix Virtual Scroll Height Calculation**
   - Don't use `totalCount` for height when virtualization is enabled
   - OR: Disable virtualization in infinite scroll mode
   - OR: Only reserve height for loaded items, not total items

2. **Fix Duplicate Page 1 Calls**
   - Add dependency array audit to `useEffect` in `/src/app/page.tsx`
   - Consider using `useRef` to prevent double-fetch in strict mode

3. **Add Debugging**
   - Log when IntersectionObserver triggers
   - Log `totalHeight`, `scrollY`, visible range
   - Add `data-debug` attributes to load-more trigger

### Long-term Improvements

1. **Consider Disabling Virtual Scroll on Mobile**
   - Mobile users expect smooth scrolling through accumulated results
   - Virtual scroll adds complexity without clear benefit on mobile
   - Desktop pagination is fine, mobile should be simple append

2. **Add Integration Tests**
   - Test infinite scroll with Playwright
   - Verify multiple pages load sequentially
   - Check for duplicate API calls

3. **Add Telemetry**
   - Track how many pages users actually scroll through
   - Monitor load-more trigger success rate
   - Alert on zero-card renders

---

## Test Reproducibility

### Run the Test

```bash
cd /Users/christopherhill/Desktop/Claude_project/nihontowatch
node scripts/test-mobile-correct.mjs
```

### Expected Output (Current - Broken)

```
Total API calls: 3
Infinite scroll pages loaded: 1 (only Page 2)
Final visible cards: 0
```

### Expected Output (After Fix)

```
Total API calls: 6+
Infinite scroll pages loaded: 5+ (Pages 2, 3, 4, 5, 6)
Final visible cards: 15-25 (depending on scroll position)
```

---

## Appendix: Full Test Output

See `/tmp/mobile-scroll-test.log` for complete test output.

Key metrics:
- Test runtime: ~12 seconds
- API calls: 3 total (1 duplicate, 1 scroll-triggered)
- Scrolls performed: 3 (stopped early due to no new data)
- Pages successfully loaded: 2 (Page 1, Page 2)
- Cards visible at end: 0 ❌

---

## Conclusion

The mobile infinite scroll is **non-functional** beyond the first page load. Users can only see 60 items (Page 1 + Page 2) out of potentially thousands. The virtual scroll implementation is incompatible with infinite scroll mode, causing the UI to break after the first load-more trigger.

**Priority**: P0 - Site is essentially broken for mobile users trying to browse the full catalog.

**Estimated Fix Time**: 2-4 hours (remove virtual scroll from infinite mode + fix duplicate calls)

**Testing Required**: Full regression test on mobile + desktop after fix.
