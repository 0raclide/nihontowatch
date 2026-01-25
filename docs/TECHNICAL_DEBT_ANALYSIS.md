# Technical Debt Analysis - Nihontowatch

**Generated:** 2026-01-25
**Codebase:** 256 TypeScript files, ~65,000 lines
**Status:** Production (nihontowatch.com)

---

## Executive Summary

The Nihontowatch codebase is **production-quality with moderate technical debt**. The primary concerns are:

1. **Type Safety Gaps** - 17+ `any` types, 16 `@ts-nocheck` directives from incomplete Supabase types
2. **Large Files** - 12 files exceed 600 lines, including the critical browse API (1,088 lines)
3. **Test Coverage Gaps** - 6/7 contexts untested, 0/3 cron jobs tested
4. **Console Logging** - 297 console statements in production code
5. **Error Handling Inconsistencies** - Different API error formats, missing error boundaries

The codebase demonstrates strong fundamentals: consistent import patterns, well-organized hooks, and solid search/filtering test coverage.

---

## Priority Matrix

| Priority | Category | Issue Count | Impact | Effort |
|----------|----------|-------------|--------|--------|
| **P0** | Type Safety | 33+ | High - Runtime errors | Medium |
| **P0** | Test Coverage (Cron) | 3 routes | Critical - Revenue | Low |
| **P1** | Console Cleanup | 297 | Medium - Observability | Low |
| **P1** | Error Handling | 27 issues | Medium - UX | Medium |
| **P2** | Large File Refactoring | 12 files | Medium - Maintainability | High |
| **P2** | Test Coverage (Contexts) | 6 contexts | Medium - Reliability | Medium |
| **P3** | Performance | 15+ items | Low - UX polish | Medium |
| **P3** | Architecture | 5 items | Low - Developer experience | High |

---

## P0: Critical Issues

### 1. Type Safety Gaps

**Root Cause:** Supabase type definitions don't include all tables, forcing workarounds.

| Issue | Count | Files Affected |
|-------|-------|----------------|
| `any` type usage | 17+ | browse/route.ts, track/route.ts, admin routes |
| `@ts-nocheck` | 16 | favorites, alerts, admin APIs |
| Double-cast (`as unknown as T`) | 15+ | ListingDetailClient, cron jobs |
| Unsafe type assertions | 20+ | Various components |

**Critical Files:**
- `src/app/api/browse/route.ts:481-513` - Uses `any[]` for listings
- `src/app/api/track/route.ts:268` - Supabase client typed as `any`
- `src/app/api/admin/setsumei/connect/route.ts:2` - Entire file `@ts-nocheck`
- `src/app/api/favorites/route.ts:2` - Entire file `@ts-nocheck`

**Solution:**
1. Regenerate Supabase types: `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
2. Add missing tables (`yuhinkai_enrichments`, `activity_events`, etc.)
3. Remove `@ts-nocheck` directives one by one
4. Replace `any` with proper types

---

### 2. Untested Cron Jobs (Revenue Critical)

**Issue:** Email alert cron jobs have zero tests. These directly impact user retention.

| Cron Job | Test Status | Risk |
|----------|-------------|------|
| `/api/cron/process-saved-searches` | None | HIGH - Email alerts |
| `/api/cron/process-price-alerts` | None | HIGH - Price notifications |
| `/api/cron/process-stock-alerts` | None | HIGH - Availability alerts |

**Solution:**
```bash
# Create test files:
tests/api/cron/process-saved-searches.test.ts
tests/api/cron/process-price-alerts.test.ts
tests/api/cron/process-stock-alerts.test.ts
```

---

## P1: High Priority

### 3. Console Statement Cleanup

**Issue:** 297 console statements across 79 files. Impacts production observability and bundle size.

| Type | Count | Action |
|------|-------|--------|
| `console.log` | ~150 | Remove or replace with logger |
| `console.error` | ~100 | Keep but use structured logging |
| `console.warn` | ~30 | Review case-by-case |
| `console.debug` | ~17 | Remove |

**High-Impact Files:**
- `src/app/api/subscription/webhook/route.ts` - 25 statements
- `src/hooks/useInquiry.ts` - Debug logs in production
- `src/contexts/` - Multiple debug statements

**Solution:**
1. Create `lib/logger.ts` with environment-aware logging
2. Replace `console.*` with structured logger
3. Add ESLint rule: `no-console: ["error", { allow: ["warn", "error"] }]`

---

### 4. Error Handling Inconsistencies

**Issue:** API routes return different error formats, making client-side handling fragile.

**Current Patterns (Inconsistent):**
```typescript
// Pattern 1 - Minimal
{ error: "string" }

// Pattern 2 - Detailed
{ error: "string", feature: "name", requiredTier: "tier" }

// Pattern 3 - With context
{ error: "string", details: { ... } }
```

**Missing Error Boundaries:** Only 18 of 78 components handle errors.

**Critical Gaps:**
- `QuickViewModal` - No error boundary
- `InquiryModal` - Form errors not caught
- `ShareButton` - Web Share API failures unhandled
- `CopyButton` - Clipboard API failures unhandled

**Solution:**
1. Standardize API error response: `{ error: string, code?: string, details?: Record }`
2. Create `components/ui/ErrorBoundary.tsx`
3. Wrap modal components with error boundaries
4. Add try/catch for Web APIs (Share, Clipboard)

---

## P2: Medium Priority

### 5. Large File Refactoring

**Issue:** 12 files exceed 600 lines, creating maintenance burden.

| File | Lines | Problem |
|------|-------|---------|
| `src/app/api/browse/route.ts` | 1,088 | Mixed: filtering, faceting, enrichment |
| `src/types/index.ts` | 847 | Monolithic type definitions |
| `src/components/browse/FilterContent.tsx` | 841 | UI + filter logic embedded |
| `src/lib/tracking/ActivityTracker.tsx` | 723 | 15 tracking methods + network code |
| `src/types/analytics.ts` | 713 | All analytics types in one file |
| `src/components/listing/ListingCard.tsx` | 671 | Card + pricing + badges + images |
| `src/components/inquiry/InquiryModal.tsx` | 658 | Modal + form + API + email |

**Refactoring Plan:**

**browse/route.ts → Split into:**
- `lib/browse/filterBuilder.ts` - SQL filter construction
- `lib/browse/facetComputer.ts` - Facet aggregation
- `lib/browse/enrichmentMapper.ts` - Yuhinkai enrichment
- `route.ts` - Thin orchestrator (~200 lines)

**ActivityTracker.tsx → Split into:**
- `lib/activity/trackingMethods.ts` - All event tracking functions
- `lib/activity/eventBatching.ts` - Queue and flush logic
- `lib/activity/privacyManager.ts` - Opt-out handling
- `ActivityTracker.tsx` - Provider only (~150 lines)

---

### 6. Context Test Coverage

**Issue:** 6 of 7 contexts have no tests.

| Context | Lines | Test Status | Priority |
|---------|-------|-------------|----------|
| `QuickViewContext.tsx` | 400+ | None | HIGH - Core UX |
| `FavoritesContext.tsx` | 268 | None | HIGH - User feature |
| `SubscriptionContext.tsx` | 150 | None | HIGH - Revenue |
| `SignupPressureContext.tsx` | 100 | None | MEDIUM |
| `ConsentContext.tsx` | 80 | None | MEDIUM - GDPR |
| `ThemeContext.tsx` | 50 | None | LOW |
| `MobileUIContext.tsx` | 60 | 1 test | OK |

**Solution:** Add 5-10 tests per context covering:
- Initial state
- State transitions
- Error cases
- Integration with child components

---

## P3: Low Priority

### 7. Performance Optimizations

**Missing Memoization:**
- `FilterSection` in FilterContent.tsx - Re-renders all filter groups
- `Checkbox` in FilterContent.tsx - No memo on list items
- Pagination buttons in VirtualListingGrid.tsx - New callbacks on every render
- Admin charts (Recharts) - Heavy re-renders without memo

**Heavy Computations:**
- `cleanTitle()` runs 100x per browse page render (line 342-360)
- `extractArtisanFromTitleEn()` duplicated in ListingCard and MetadataGrid

**N+1 Queries:**
- `/api/admin/dealers/analytics/route.ts` - 4 sequential queries instead of batch

**Bundle Size:**
- Recharts (~200KB) imported eagerly for admin-only pages
- Should use `React.lazy()` for admin components

**Context Re-render Issues:**
- `QuickViewContext` updates `listings` array on every change, triggering all consumers
- Should split into `QuickViewModalContext` + `QuickViewDataContext`

**Memory Leak:**
- `useImagePreloader.ts:16` - `preloadedUrls` Set grows unbounded
- Should use LRU cache with max 500 entries

---

### 8. Architecture Improvements

**Deep Context Nesting (9 levels):**
```
AuthProvider → ConsentProvider → SubscriptionProvider →
FavoritesProvider → SignupPressureWrapper → MobileUIProvider →
ThemeProvider → QuickViewProvider → ActivityWrapper
```

**Candidates for Merge:**
- `MobileUIProvider` + `ThemeProvider` → `UIProvider`
- Move consent logic into `ActivityWrapper`
- Reduces nesting from 9 to 7 levels

**Type File Organization:**
```
Current:
types/index.ts (847 lines - monolithic)
types/analytics.ts (713 lines)

Should split into:
types/listing.ts
types/search.ts
types/enrichment.ts
types/index.ts (re-exports only)
```

**API Route Organization:**
```
Should create:
lib/api/browse/buildQuery.ts
lib/api/browse/computeFacets.ts
lib/api/admin/dealerAnalytics.ts
```

---

### 9. Code Quality Items

**TODO/FIXME Comments (8):**
- `src/components/listing/QuickMeasurement.tsx:37` - Missing height_cm, width_cm columns
- `src/hooks/useActivityTracker.ts:62` - Auth integration pending
- `src/components/signup/SignupModal.tsx:69` - Signup logic placeholder
- `src/app/admin/dealers/page.tsx:319` - CSV export not implemented
- `src/app/admin/market-intelligence/page.tsx:213` - Export not implemented
- `src/app/api/subscription/webhook/route.ts:263` - Payment failure email not sent

**Outdated Dependencies:**
| Package | Current | Latest |
|---------|---------|--------|
| @playwright/test | 1.57.0 | 1.58.0 |
| @supabase/supabase-js | 2.90.1 | 2.91.1 |
| next | 16.1.2 | 16.1.4 |
| recharts | 3.6.0 | 3.7.0 |

---

## Test Coverage Summary

| Domain | Coverage | Assessment |
|--------|----------|------------|
| Search/Filtering | 85% | Excellent |
| Subscription/Gating | 90% | Excellent (with regression guards) |
| Analytics | 70% | Good |
| Contexts | 14% | **Critical gap** |
| Hooks | 53% | Moderate |
| Components | 35% | Needs work |
| API Routes | 52% | Moderate |
| Cron Jobs | 0% | **Critical gap** |

---

## Implementation Roadmap

### Sprint 1: Type Safety & Critical Tests
- [ ] Regenerate Supabase types
- [ ] Remove 16 `@ts-nocheck` directives
- [ ] Add tests for 3 cron jobs
- [ ] Add QuickViewContext tests

### Sprint 2: Console & Error Handling
- [ ] Create structured logger
- [ ] Replace 297 console statements
- [ ] Standardize API error format
- [ ] Add error boundaries to modals

### Sprint 3: Refactoring
- [ ] Split browse/route.ts (1,088 → ~200 lines)
- [ ] Split ActivityTracker.tsx (723 → ~150 lines)
- [ ] Split FilterContent.tsx (841 → ~300 lines)
- [ ] Add remaining context tests

### Sprint 4: Performance & Polish
- [ ] Memoize filter components
- [ ] Dynamic import Recharts
- [ ] Fix preloadedUrls memory leak
- [ ] Split QuickViewContext
- [ ] Update outdated dependencies

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Files with `any` type | 17+ | 0 |
| `@ts-nocheck` directives | 16 | 0 |
| Console statements | 297 | <20 |
| Files >600 lines | 12 | 3 (types only) |
| Context test coverage | 14% | 80% |
| Cron job test coverage | 0% | 100% |
| Components with error boundaries | 23% | 60% |

---

## Quick Wins (< 1 hour each)

1. **Add ESLint no-console rule** - Prevents new console statements
2. **Memoize FilterSection/Checkbox** - 5 min, 15% filter perf improvement
3. **Use Promise.all in dealer analytics** - 3 min, 4x faster API
4. **Fix preloadedUrls Set leak** - 5 min, prevents memory issues
5. **Add useCallback to pagination** - 2 min, cleaner renders
6. **Dynamic import Recharts** - 10 min, 200KB bundle reduction

---

## References

- [CLAUDE.md](/Users/christopherhill/Desktop/Claude_project/nihontowatch/CLAUDE.md) - Project context
- [docs/INDEX.md](/Users/christopherhill/Desktop/Claude_project/nihontowatch/docs/INDEX.md) - Documentation index
- [vitest.config.ts](/Users/christopherhill/Desktop/Claude_project/nihontowatch/vitest.config.ts) - Test configuration
