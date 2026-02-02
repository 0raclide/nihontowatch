# CI Test/Lint Fixes - February 2, 2026

## Summary

Fixed pre-existing test and lint failures that were causing GitHub Actions CI to fail.

## Issues Fixed

### 1. Flaky Test: `tests/sql/search-index.test.ts` (line 433)

**Symptom:** Test expected 862 records but got 863.

**Root Cause:** The test made two separate RPC calls to verify `total_count`:
1. First call: Get `total_count` from results
2. Second call: Fetch all results and compare length to `total_count`

Between these two calls, a new listing was added to the database, causing a mismatch.

**Fix:** Use a single query with a large limit (2000) and verify that `total_count` in the response matches `allResults.length` from the same query.

```typescript
// Before (flaky - race condition)
const { data: results } = await supabase.rpc('search_listings_instant', { p_query: 'katana', p_limit: 5 });
const totalCount = results[0].total_count;
const { data: allResults } = await supabase.rpc('search_listings_instant', { p_query: 'katana', p_limit: totalCount + 10 });
expect(allResults.length).toBe(totalCount); // FAILS if data changed between calls

// After (stable - single query)
const { data: allResults } = await supabase.rpc('search_listings_instant', { p_query: 'katana', p_limit: 2000 });
const totalCount = allResults[0].total_count;
expect(allResults.length).toBe(totalCount); // Always consistent
```

### 2. Lint Error: `tests/subscription/trial-mode.test.ts` (line 319)

**Symptom:** ESLint `prefer-const` error.

**Root Cause:** Variable `canAccessFeature` was declared with `let` but never reassigned.

**Fix:** Changed `let { canAccessFeature }` to `const { canAccessFeature }`.

### 3. Lint Error: `tests/viewport/integration.test.tsx` (line 186)

**Symptom:** ESLint `react-hooks/immutability` error - "Modifying a variable defined outside a component or hook is not allowed."

**Root Cause:** Test was capturing hook's ref by assigning to an external variable:
```typescript
let refCallback = null;
function TestHookConsumer() {
  const { ref } = useListingCardTracking(999);
  refCallback = ref; // ESLint error: modifying external variable
  return <div>Test</div>;
}
```

**Fix:** Restructured test to verify ref works by actually using it:
```typescript
function TestHookConsumer() {
  const { ref } = useListingCardTracking(999);
  return <div ref={ref} data-testid="ref-test-element">Test</div>;
}
// Verify element renders (proves ref is valid)
expect(screen.getByTestId('ref-test-element')).toBeInTheDocument();
```

### 4. ESLint Config: `.vercel/**` not ignored

**Symptom:** Many lint errors from `.vercel/output/` directory (Vercel build artifacts).

**Fix:** Added `.vercel/**` to `globalIgnores` in `eslint.config.mjs`.

## Files Changed

| File | Change |
|------|--------|
| `eslint.config.mjs` | Added `.vercel/**` to ignored patterns |
| `tests/sql/search-index.test.ts` | Fixed flaky total_count test |
| `tests/subscription/trial-mode.test.ts` | Changed `let` to `const` |
| `tests/viewport/integration.test.tsx` | Restructured ref callback test |

## Verification

- All 60 tests pass locally
- No lint errors in modified test files (only warnings for unused variables)
- Commit `1590c71` pushed to `main`

## Lessons Learned

1. **Avoid multi-query assertions on live data** - When testing against a live database, data can change between queries. Always use single queries or transactions for consistency checks.

2. **ESLint react-hooks rules are strict** - The `react-hooks/immutability` rule prevents modifying external variables from within components. Restructure tests to verify behavior through rendering rather than capturing internal values.

3. **Exclude build output directories from linting** - Build artifacts like `.vercel/output` contain minified code that will fail lint rules designed for source code.
