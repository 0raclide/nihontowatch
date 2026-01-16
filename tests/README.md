# Nihontowatch Test Suite

## Overview

Comprehensive test coverage for the Nihontowatch search system - a Japanese sword and fittings marketplace aggregator. This test suite ensures reliability across text normalization, search functionality, API endpoints, and UI components.

## Test Structure

```
tests/
├── lib/                          # Unit tests for library functions
│   ├── textNormalization.test.ts # Text normalization (macrons, diacritics)
│   └── filterNormalization.test.ts # Filter normalization (item types, certs)
├── hooks/                        # React hook tests
│   └── useDebounce.test.ts       # Debounce timing tests
├── api/                          # API integration tests
│   ├── browse.test.ts            # /api/browse endpoint tests
│   ├── search.test.ts            # /api/search/suggestions + browse search
│   ├── concordance.test.ts       # Facet/result consistency tests
│   └── exchange-rates.test.ts    # Currency exchange rate API
├── components/                   # Component tests
│   ├── search/
│   │   └── SearchSuggestions.test.tsx
│   ├── browse/
│   │   ├── FilterContent.test.tsx
│   │   ├── ListingCard.test.tsx
│   │   └── ListingGrid.test.tsx
│   ├── layout/
│   │   └── Header.test.tsx
│   └── ui/
│       └── Drawer.test.tsx
├── contexts/                     # React context tests
│   └── MobileUIContext.test.tsx  # Mobile UI state management
└── setup.ts                      # Global test setup
```

## Running Tests

### All Tests
```bash
npm run test
```

### Run Tests Once (no watch mode)
```bash
npm run test:run
```

### Unit Tests Only (fast)
```bash
npm run test:unit
```

### API Integration Tests (requires dev server)
```bash
# Start dev server on port 3020 first
npm run dev -- -p 3020

# In another terminal
npm run test:api
```

### Component Tests Only
```bash
npm run test:components
```

### With Coverage Report
```bash
npm run test:coverage
```

## Test Categories

### 1. Unit Tests (tests/lib/, tests/hooks/)

Fast, isolated tests for pure functions and hooks.

| File | Tests | Description |
|------|-------|-------------|
| `textNormalization.test.ts` | 27 | Macron removal, diacritics, FTS query preparation |
| `filterNormalization.test.ts` | 40+ | Item type normalization, certification labels, categorization |
| `useDebounce.test.ts` | 11 | Debounce timing with fake timers |

#### Key Test Scenarios - Text Normalization
- **Macron Removal**: Converts `Juyo` to `Juyo`, `Goto` to `Goto`
- **Search Text Normalization**: Lowercasing, whitespace trimming, diacritic handling
- **FTS Query Preparation**: Prefix matching, term joining, special character escaping

#### Key Test Scenarios - Filter Normalization
- **Japanese Kanji**: Maps `刀` to `katana`, `鍔` to `tsuba`
- **Case Variants**: Normalizes `Katana` and `KATANA` to `katana`
- **Certification Labels**: Formats `Juyo` as `Juyo` with proper macrons
- **Category Classification**: Routes types to `nihonto`, `tosogu`, or `other`

### 2. Component Tests (tests/components/)

React component tests with React Testing Library.

| File | Tests | Description |
|------|-------|-------------|
| `SearchSuggestions.test.tsx` | 25+ | Dropdown rendering, keyboard navigation, click handling |
| `FilterContent.test.tsx` | 30+ | Filter UI, category toggles, checkbox interactions |
| `ListingCard.test.tsx` | 23 | Card rendering, images, prices, certifications |
| `ListingGrid.test.tsx` | 20+ | Grid layout, pagination, infinite scroll |
| `Header.test.tsx` | 17 | Search input, mobile/desktop layouts |
| `Drawer.test.tsx` | 18 | Modal behavior, accessibility, gestures |

#### Key Component Test Patterns
- **Mocking**: Next.js Image component, context providers
- **Accessibility**: ARIA attributes, keyboard navigation
- **Responsive**: Testing mobile vs desktop class variants
- **State Management**: User interactions, filter changes

### 3. API Integration Tests (tests/api/)

End-to-end tests against actual API endpoints.

| File | Tests | Description |
|------|-------|-------------|
| `browse.test.ts` | 40+ | Filtering, sorting, pagination |
| `search.test.ts` | 40+ | Search suggestions + browse with search |
| `concordance.test.ts` | 15+ | Facet counts match filtered results |
| `exchange-rates.test.ts` | 12 | Currency conversion accuracy |

#### API Test Requirements
- Development server must be running on port 3020
- Tests use real database (Supabase)
- Rate limiting may affect test execution

### 4. Context Tests (tests/contexts/)

React context provider tests.

| File | Tests | Description |
|------|-------|-------------|
| `MobileUIContext.test.tsx` | 12 | Drawer state management, mutex behavior |

## Coverage Targets

| Category | Target | Notes |
|----------|--------|-------|
| Unit tests | 90% | Pure functions should be fully covered |
| Component tests | 80% | Key user interactions covered |
| API tests | 70% | Main endpoints and error cases |
| Overall | 75% | Balance of coverage vs maintenance |

## Key Test Scenarios

### Japanese Text Handling
```typescript
// Romanization
expect(normalizeSearchText('Masamune')).toBe('masamune');

// Macrons
expect(removeMacrons('Goto')).toBe('Goto');

// Kanji mapping
expect(normalizeItemType('刀')).toBe('katana');
```

### Search Edge Cases
- Empty/whitespace queries return empty results
- Very long queries (500+ chars) are handled safely
- Special characters (!@#$%^&*) are escaped
- SQL injection attempts are prevented
- Unicode combining characters are normalized

### Price Filtering
```typescript
// Minimum price
expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);

// Price range
expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
expect(listing.price_value).toBeLessThanOrEqual(maxPrice);
```

### Facet Concordance
Tests ensure that:
1. Facet counts match actual filtered results
2. Total equals sum of dealer facet counts
3. No duplicate facet entries exist
4. No null/empty facet values appear

### Currency Conversion
```typescript
// JPY to USD
const usdPrice = convertPrice(1500000, 'JPY', 'USD', rates);
expect(usdPrice).toBe(10000); // At 150 JPY/USD rate

// Bidirectional
expect(convertPrice(convertPrice(price, 'JPY', 'USD', rates), 'USD', 'JPY', rates)).toBeCloseTo(price);
```

### Security Tests
```typescript
// SQL injection prevention
const maliciousQuery = "test'; DROP TABLE listings; --";
const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(maliciousQuery)}`);
expect(res.ok).toBe(true); // Should not cause server error
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `TEST_API_URL` | API base URL for integration tests | `http://localhost:3020` |
| `SKIP_STRESS_TESTS` | Skip performance/load tests | `true` |
| `SUPABASE_URL` | Database URL | (from .env.local) |
| `SUPABASE_SERVICE_KEY` | Service role key | (from .env.local) |

## Adding New Tests

### 1. Follow Existing Patterns

```typescript
// Use descriptive test names
it('should filter by certification when cert param is provided', async () => {
  // Test implementation
});

// Group related tests with describe blocks
describe('Certification Filters', () => {
  certifications.forEach(cert => {
    it(`should filter by certification: ${cert}`, async () => {
      // Parameterized test
    });
  });
});
```

### 2. Mock External Dependencies

```typescript
// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt }) => <img src={src} alt={alt} />,
}));

// Mock context hooks
vi.mock('@/contexts/MobileUIContext', () => ({
  useMobileUI: () => ({
    openSearch: mockOpenSearch,
    // ...
  }),
}));
```

### 3. Handle Async Operations

```typescript
// API tests
it('returns suggestions for valid query', async () => {
  const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana`);
  expect(res.ok).toBe(true);

  const data = await res.json();
  expect(data.suggestions.length).toBeGreaterThan(0);
});

// Fake timers for debounce
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('debounces value changes', () => {
  // ...
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe('updated');
});
```

### 4. Test Accessibility

```typescript
it('has proper accessibility attributes', () => {
  render(<SearchSuggestions {...props} />);

  expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Search suggestions');

  const options = screen.getAllByRole('option');
  expect(options[0]).toHaveAttribute('aria-selected', 'true');
});
```

## Common Issues and Solutions

### API Tests Failing
1. Ensure dev server is running: `npm run dev -- -p 3020`
2. Check database connection in Supabase dashboard
3. Verify environment variables are set

### Component Tests with Context
Always wrap components in their required providers:
```typescript
render(
  <MobileUIProvider>
    <Header />
  </MobileUIProvider>
);
```

### Timing Issues with Debounce
Use fake timers and explicit time advancement:
```typescript
vi.useFakeTimers();
// ... trigger change
act(() => vi.advanceTimersByTime(300));
// ... assert result
vi.useRealTimers();
```

### Mock scrollIntoView
JSDOM doesn't have scrollIntoView, mock it in setup:
```typescript
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
```

## CI/CD Integration

Tests are designed to run in CI environments:

- **Unit + Component Tests**: Run on every PR
- **API Integration Tests**: Run on main branch (requires server)
- **Coverage Reports**: Generated with `npm run test:coverage`

### GitHub Actions Example
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:run
```

## Related Documentation

- [Test Coverage Details](./COVERAGE.md)
- [Main Project README](../README.md)
- [CLAUDE.md](../CLAUDE.md) - Project context for AI assistants
