# Testing Documentation

## Overview

The Nihontowatch test suite ensures the reliability of the browse API, faceted search, and user-facing features. Tests are organized into three categories:

1. **Unit Tests** - Fast, isolated tests for business logic
2. **Integration Tests** - Tests that require database/API access
3. **Concordance Tests** - Production API tests that verify data consistency

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- browse              # Browse API unit tests
npm test -- browse-concordance  # Concordance tests (hits production)
npm test -- signup              # Signup system tests

# Run with verbose output
npm test -- --reporter=verbose

# Run in watch mode (development)
npm test -- --watch
```

## Test Categories

### 1. Unit Tests (`tests/api/browse.test.ts`)

Fast tests that verify the browse API query building logic without hitting the database.

**Coverage:**
- Parameter parsing (tab, category, type, cert, dealer, page, limit, sort)
- Search query building (text search, numeric filters)
- Filter construction (status, item types, certifications, schools, dealers)
- Pagination and sorting
- Response structure validation

**Key Test Groups:**

| Test Group | Purpose |
|------------|---------|
| Search Utility Functions | Macron normalization, alias expansion |
| Parameter Parsing | URL param validation and defaults |
| Numeric Filter Parsing | `cm>70`, `price<1000000` syntax |
| Text Search Query Building | Field coverage, ILIKE patterns |
| Filter Query Building | Status, type, cert, school, dealer filters |
| Sorting | Price, name, recency ordering |
| Pagination | Offset calculation, range building |

### 2. Concordance Tests (`tests/api/browse-concordance.test.ts`)

Integration tests that verify mathematical consistency of facet counts across the production API. These tests catch data integrity bugs where facet counts don't reflect user filter selections.

**Why Concordance Tests?**

On January 17, 2026, we discovered a bug where certification facet counts remained identical across all categories (All, Nihonto, Tosogu). The facets showed `Juyo: 126` for every category even though the totals were different. This happened because Supabase's `.or()` method doesn't combine with AND when chained.

These tests would have caught that bug immediately.

**Critical Invariants Tested:**

#### Category Filter Must Affect Facet Counts
```
MUST: nihonto_cert_count ≠ all_cert_count (when totals differ)
MUST: tosogu_cert_count ≠ all_cert_count (when totals differ)
MUST: nihonto_cert_count ≠ tosogu_cert_count
```

If these invariants fail, facets are returning stale/cached data that ignores filters.

#### Subset Relationships
```
MUST: nihonto_cert_count ≤ all_cert_count (for each cert)
MUST: tosogu_cert_count ≤ all_cert_count (for each cert)
MUST: nihonto_total ≤ all_total
MUST: tosogu_total ≤ all_total
```

Category facets should always be subsets of the "all" facets.

#### Approximate Additivity
```
SHOULD: nihonto_total + tosogu_total ≈ all_total (±15%)
SHOULD: nihonto_cert + tosogu_cert ≈ all_cert (±15%)
```

The sum of category counts should approximately equal the total (allowing for items that don't fit either category).

**Test Structure:**

| Test Suite | Description | Tests |
|------------|-------------|-------|
| Critical Invariants | Category filter affects counts | 3 |
| Subset Relationships | Category counts ≤ all counts | 4 |
| Approximate Additivity | Sum checks with tolerance | 2 |
| Facet Bounds | No count exceeds total | 5 |
| Dealer Facets | Dealer counts reflect category | 4 |
| Cross-Filter Concordance | Combined filters work | 4 |
| Stale Data Detection | Fresh data on each request | 2 |
| Mathematical Consistency | Non-negative, bounds checks | 4 |
| Specific Certifications | Per-cert invariants | 15 |
| Snapshot Regression | Response structure | 3 |
| Edge Cases | Invalid inputs | 4 |
| Performance | Response time, array sizes | 2 |

**Total: 52 tests**

### 3. Signup Tests (`tests/signup/`)

Tests for the signup pressure system (modal triggers, storage, context).

## CI/CD Integration

Tests run automatically on GitHub Actions for every push to `main` and every pull request.

### Workflow: `.github/workflows/test.yml`

```yaml
jobs:
  unit-tests:        # Fast unit tests (~10s)
  integration-tests: # Database tests (~30s)
  concordance-tests: # Production API tests (~2min)
  build-check:       # Verifies build succeeds
```

### Concordance Test Timing

The concordance tests wait 90 seconds after push before running. This allows Vercel to complete the deployment so tests run against the newly deployed code.

```
Push to main → Vercel deploys (~60s) → Wait (90s) → Concordance tests run
```

### Test Failures

If concordance tests fail in CI:

1. **Check the specific failure** - Which invariant broke?
2. **Compare facet counts** - Are they identical when they shouldn't be?
3. **Check for caching issues** - Clear Vercel edge cache if needed
4. **Review recent changes** - Did the facet query logic change?

## Writing New Tests

### Unit Test Pattern

```typescript
describe('Feature Name', () => {
  it('should do specific thing', () => {
    // Arrange
    const input = { ... };

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

### Concordance Test Pattern

```typescript
describe('New Concordance Check', () => {
  it('invariant: X should relate to Y', async () => {
    const response = await fetchBrowse({ param: 'value' });

    // Test mathematical relationship
    expect(response.x).toBeLessThanOrEqual(response.y);
  });
});
```

### Adding New Facet Concordance Tests

If adding a new facet type:

1. Add subset test: `new_facet_count ≤ all_count`
2. Add category filter test: counts differ by category
3. Add bounds test: `count ≤ total`
4. Add to approximate additivity if applicable

## Test Data

Concordance tests run against production data at `https://nihontowatch.com`. They don't modify data - only read.

For local testing against a different environment:

```bash
TEST_API_URL=http://localhost:3000 npm test -- browse-concordance
```

## Debugging Test Failures

### Unit Test Failures

1. Check the specific assertion that failed
2. Review the mock setup
3. Verify the expected value matches current implementation

### Concordance Test Failures

1. **Fetch the API manually** to see actual values:
   ```bash
   curl "https://nihontowatch.com/api/browse?tab=available" | jq '.facets'
   curl "https://nihontowatch.com/api/browse?tab=available&cat=nihonto" | jq '.facets'
   ```

2. **Compare totals and facets** - Are category facets different from "all"?

3. **Check for caching** - Add `_t=$(date +%s)` to bust cache:
   ```bash
   curl "https://nihontowatch.com/api/browse?tab=available&_t=$(date +%s)"
   ```

4. **Review the browse route** - Check `src/app/api/browse/route.ts`

## Historical Issues

### January 2026: Stale Facet Counts

**Symptom:** Certification facet counts identical across all categories
**Root Cause:** Supabase `.or()` calls don't combine with AND
**Fix:** JavaScript-side filtering for category constraints
**Prevention:** Concordance tests now verify category filter affects facet counts

## Test File Locations

```
tests/
├── api/
│   ├── browse.test.ts           # Unit tests for browse API
│   └── browse-concordance.test.ts # Production concordance tests
├── integration/
│   └── ...                      # Database integration tests
├── signup/
│   ├── SignupModal.test.tsx     # Modal component tests
│   ├── SignupPressureContext.test.tsx # Context tests
│   └── storage.test.ts          # Storage utility tests
└── e2e/
    └── ...                      # Playwright E2E tests
```
