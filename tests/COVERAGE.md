# Test Coverage Report

## Search System Coverage

### Functions Tested

| Function | File | Tests | Edge Cases |
|----------|------|-------|------------|
| `removeMacrons` | `lib/search.ts` | 9 | Empty string, mixed text, uppercase |
| `normalizeSearchText` | `lib/search.ts` | 6 | Whitespace, kanji, mixed case |
| `prepareSearchQuery` | `lib/search.ts` | 12 | SQL chars, tsquery syntax, short terms |
| `useDebounce` | `hooks/useDebounce.ts` | 11 | Timing, rapid input, cleanup |

### API Endpoints Tested

| Endpoint | Method | Tests | Notes |
|----------|--------|-------|-------|
| `/api/browse` | GET | 40+ | Filters, sorting, pagination |
| `/api/search/suggestions` | GET | 15+ | Query validation, limits |
| `/api/exchange-rates` | GET | 8 | Rate validation, caching |

### Components Tested

| Component | Tests | Interactions | Accessibility |
|-----------|-------|--------------|---------------|
| `SearchSuggestions` | 25+ | Keyboard, click, loading states | ARIA roles |
| `FilterContent` | 30+ | Category toggle, checkbox, reset | Touch targets |
| `ListingCard` | 23 | Image, price, certification display | Link attributes |
| `ListingGrid` | 20+ | Pagination, infinite scroll, empty state | Navigation |
| `Header` | 17 | Search input, mobile menu | Button labels |
| `Drawer` | 18 | Open/close, backdrop, escape key | Modal aria |

### Context Providers Tested

| Context | Tests | Features |
|---------|-------|----------|
| `MobileUIContext` | 12 | State management, mutex behavior, closeAll |

---

## Detailed Coverage by Category

### Text Normalization (`tests/lib/textNormalization.test.ts`)

**Total: 27 tests**

#### `removeMacrons` (9 tests)
- [x] Converts long vowels to short
- [x] Preserves text without macrons
- [x] Handles uppercase macrons
- [x] Converts lowercase macron vowels (a, e, i, o, u)
- [x] Converts uppercase macron vowels (A, E, I, O, U)
- [x] Converts mixed text with macrons
- [x] Handles empty string
- [x] Preserves special characters and punctuation
- [x] Handles strings with only macrons

#### `normalizeSearchText` (6 tests)
- [x] Lowercases and removes diacritics
- [x] Trims whitespace
- [x] Handles empty string
- [x] Handles whitespace-only string
- [x] Normalizes mixed case with macrons
- [x] Preserves kanji characters

#### `prepareSearchQuery` (12 tests)
- [x] Adds prefix matching (`:*`)
- [x] Joins terms with AND (`&`)
- [x] Filters short terms (< 2 chars)
- [x] Filters all terms if all too short
- [x] Escapes special characters safely
- [x] Handles quotes and parentheses
- [x] Normalizes whitespace between terms
- [x] Handles empty string
- [x] Handles whitespace-only string
- [x] Lowercases and normalizes before processing
- [x] Handles Japanese romanization with spaces
- [x] Produces valid tsquery syntax

### Filter Normalization (`tests/lib/filterNormalization.test.ts`)

**Total: 40+ tests**

#### Item Type Normalization
- [x] Japanese kanji to English (9 types)
- [x] Case variant normalization (4 types)
- [x] Special cases (fuchi_kashira, tanegashima, books)
- [x] Lowercase fallback for unknown types

#### Item Type Categorization
- [x] Nihonto types (7 items): katana, wakizashi, tanto, tachi, naginata, yari, kodachi
- [x] Tosogu types (5 items): tsuba, fuchi-kashira, kozuka, menuki, koshirae
- [x] Other types: armor, kabuto, unknown

#### Item Type Labels
- [x] Labels for all nihonto types
- [x] Labels for all tosogu types
- [x] Proper Japanese macrons (e.g., Tanto)

#### Certification Labels
- [x] Juyo formatting with macron
- [x] Tokuju as Tokubetsu Juyo
- [x] TokuHozon as Tokubetsu Hozon
- [x] TokuKicho with macron

#### Certification Ordering
- [x] Tokuju > Juyo
- [x] Juyo > TokuHozon
- [x] TokuHozon > Hozon

#### Full Pipeline Tests
- [x] 5 end-to-end normalization pipelines

### Debounce Hook (`tests/hooks/useDebounce.test.ts`)

**Total: 11 tests**

- [x] Returns initial value immediately
- [x] Debounces value changes
- [x] Resets timer on rapid changes
- [x] Handles different delay values
- [x] Works with number values
- [x] Works with object values
- [x] Works with null values
- [x] Cleans up timer on unmount
- [x] Handles zero delay
- [x] Maintains value during intermediate changes
- [x] Handles same value updates

### Browse API (`tests/api/browse.test.ts`)

**Total: 40+ tests**

#### Basic Endpoint
- [x] Returns listings for available tab
- [x] Returns listings for sold tab

#### Item Type Filters
- [x] Filter by single item type (11 types tested)
- [x] Filter by multiple item types

#### Certification Filters
- [x] Filter by certification (4 certs tested)

#### Price Filters
- [x] Filter by minimum price
- [x] Filter by maximum price
- [x] Filter by price range

#### Dealer Filters
- [x] Filter by single dealer
- [x] Filter by multiple dealers

#### Text Search
- [x] Search by smith name
- [x] Search by title

#### Sorting
- [x] Sort by price ascending
- [x] Sort by price descending
- [x] Sort by name
- [x] Sort by recent (default)

#### Pagination
- [x] Returns paginated results
- [x] Returns different results for different pages

#### Facets
- [x] Returns item type facets
- [x] Returns certification facets
- [x] Returns dealer facets

#### Combined Filters
- [x] Multiple filters work together

#### Edge Cases
- [x] Handles empty results gracefully
- [x] Handles invalid page numbers
- [x] Limits results to max 100

### Search API (`tests/api/search.test.ts`)

**Total: 40+ tests**

#### Query Validation
- [x] Returns empty for single character query
- [x] Returns empty for empty query
- [x] Returns empty for missing query parameter
- [x] Returns empty for whitespace-only query

#### Valid Queries
- [x] Returns suggestions for valid query
- [x] Returns suggestions for two-character query
- [x] Echoes back original query
- [x] Returns proper suggestion structure

#### Limit Parameter
- [x] Limits results to specified limit
- [x] Respects default limit of 5
- [x] Clamps limit to maximum of 10
- [x] Clamps limit to minimum of 1

#### Security
- [x] Handles SQL injection attempts safely
- [x] Handles Unicode characters safely
- [x] Handles very long queries

#### Browse with Search
- [x] Searches across title, smith, tosogu_maker
- [x] Returns results for common sword terms
- [x] Is case-insensitive
- [x] Returns empty results for nonsense query
- [x] Combines search with item type filter
- [x] Combines search with certification filter
- [x] Combines search with price filter
- [x] Combines search with dealer filter
- [x] Combines search with multiple filters
- [x] Returns paginated search results
- [x] Returns consistent total across pages
- [x] Sorts search results by price

### Concordance Tests (`tests/api/concordance.test.ts`)

**Total: 15+ tests**

- [x] Certification facet counts match filtered results (5 certs)
- [x] Item type facet counts match filtered results (11 types)
- [x] Dealer facet counts match filtered results (top 5)
- [x] Cross-tab facet consistency
- [x] Total equals sum of dealer facets
- [x] Case sensitivity handling
- [x] Tokuju count accuracy (specific regression test)
- [x] No duplicate facet entries
- [x] No null/empty facet values

### Exchange Rates API (`tests/api/exchange-rates.test.ts`)

**Total: 12 tests**

#### API Endpoint
- [x] Returns exchange rates
- [x] Has USD as base currency
- [x] Includes USD, JPY, EUR rates
- [x] USD rate is 1
- [x] JPY rate in reasonable range (100-200)
- [x] EUR rate in reasonable range (0.8-1.2)
- [x] Timestamp is recent (within 24h)

#### Conversion Logic
- [x] Same currency returns same value
- [x] USD to JPY conversion
- [x] USD to EUR conversion
- [x] JPY to USD conversion
- [x] JPY to EUR conversion
- [x] EUR to USD conversion
- [x] EUR to JPY conversion
- [x] Handles null rates
- [x] Handles zero value
- [x] Case-insensitive currency codes
- [x] Real-world nihonto price examples

### SearchSuggestions Component (`tests/components/search/SearchSuggestions.test.tsx`)

**Total: 25+ tests**

- [x] Renders suggestions list
- [x] Renders item type badges
- [x] Renders dealer domain
- [x] Shows view all link when more results
- [x] Hides view all when all shown
- [x] Calls onSelect on suggestion click
- [x] Calls onViewAll on link click
- [x] Shows loading state
- [x] Shows no results message
- [x] Highlights selected suggestion
- [x] Highlights different suggestion on index change
- [x] Has proper accessibility attributes
- [x] Shows artisan name (smith)
- [x] Shows artisan name (tosogu_maker)
- [x] Shows truncated title when no artisan
- [x] Renders image when URL provided
- [x] Shows placeholder when no image
- [x] Calls onClose when clicking outside
- [x] Does not close when clicking inside
- [x] Formats JPY price correctly
- [x] Shows "Ask" for null price
- [x] Formats USD price correctly

### FilterContent Component (`tests/components/browse/FilterContent.test.tsx`)

**Total: 30+ tests**

- [x] Renders filter sections
- [x] Renders category toggle buttons
- [x] Calls onFilterChange when category changed
- [x] Renders certification checkboxes
- [x] Calls onFilterChange when cert toggled
- [x] Shows reset button when filters active
- [x] Hides reset button when no filters
- [x] Clears all filters on reset
- [x] Renders dealer dropdown
- [x] Opens dealer dropdown on click
- [x] Shows "Price on request only" toggle
- [x] Calls onFilterChange when askOnly toggled
- [x] Shows Done button when onClose provided
- [x] Hides Done button when onClose not provided
- [x] Calls onClose when Done clicked
- [x] Shows active filter count in Done button
- [x] Shows live update indicator
- [x] Shows updating indicator when isUpdating
- [x] Has responsive checkbox sizing
- [x] Has minimum touch height for labels
- [x] Has responsive category button padding

#### getActiveFilterCount Helper
- [x] Returns 0 for default filters
- [x] Counts category change as 1
- [x] Counts each item type
- [x] Counts each certification
- [x] Counts each dealer
- [x] Counts askOnly as 1
- [x] Counts all filters combined

### ListingCard Component (`tests/components/browse/ListingCard.test.tsx`)

**Total: 23 tests**

- [x] Renders listing title/type
- [x] Renders dealer domain
- [x] Renders certification badge
- [x] Renders artisan name
- [x] Renders formatted price
- [x] Shows "Ask" for null price
- [x] Shows sold overlay when sold
- [x] Links to listing URL
- [x] Has responsive content padding
- [x] Has responsive title font size
- [x] Has responsive price font size
- [x] Has responsive dealer domain padding
- [x] Has responsive dealer domain font size
- [x] Has responsive cert badge font size
- [x] Has responsive artisan font size
- [x] Renders image when available
- [x] Shows fallback icon when no images
- [x] Shows premier tier styling for Juyo
- [x] Shows high tier styling for TokuHozon
- [x] Shows standard tier styling for Hozon
- [x] Does not show badge when no certification
- [x] Displays price in USD
- [x] Displays price in EUR

### ListingGrid Component (`tests/components/browse/ListingGrid.test.tsx`)

**Total: 20+ tests**

- [x] Renders listing cards
- [x] Shows loading skeleton
- [x] Shows empty state
- [x] Shows results count on desktop
- [x] Has responsive column classes
- [x] Has responsive gap classes
- [x] Renders pagination when totalPages > 1
- [x] Hides pagination when totalPages = 1
- [x] Calls onPageChange when next clicked
- [x] Calls onPageChange when previous clicked
- [x] Disables previous on first page
- [x] Disables next on last page
- [x] Shows simplified page indicator on mobile
- [x] Hides full pagination on mobile
- [x] Has touch-friendly button height
- [x] Shows arrow only on mobile (prev)
- [x] Shows arrow only on mobile (next)
- [x] Hides pagination in infinite scroll mode
- [x] Shows loading more indicator
- [x] Shows end of results message
- [x] Hides end message when more available

### Header Component (`tests/components/layout/Header.test.tsx`)

**Total: 17 tests**

- [x] Renders the logo
- [x] Renders mobile search and menu buttons
- [x] Renders desktop navigation links
- [x] Renders desktop search form
- [x] Calls openSearch when mobile search clicked
- [x] Calls openNavDrawer when mobile menu clicked
- [x] Includes MobileNavDrawer
- [x] Includes MobileSearchSheet
- [x] Has sticky positioning
- [x] Has responsive padding classes
- [x] Updates input value on change
- [x] Navigates on form submit
- [x] Does not navigate on empty search
- [x] Mobile header has lg:hidden class
- [x] Desktop header has hidden lg:flex class
- [x] Mobile logo has text-xl class
- [x] Desktop logo has text-2xl class

### Drawer Component (`tests/components/ui/Drawer.test.tsx`)

**Total: 18 tests**

- [x] Renders nothing when closed
- [x] Renders children when open
- [x] Renders title when provided
- [x] Does not render title header when no title
- [x] Renders close button with title
- [x] Calls onClose when close button clicked
- [x] Calls onClose when backdrop clicked
- [x] Calls onClose on Escape key
- [x] Does not close on Escape when already closed
- [x] Has proper accessibility attributes
- [x] Has drag handle for gestures
- [x] Applies animation classes
- [x] Has safe-area-bottom class
- [x] Has max-height constraint

### MobileUIContext (`tests/contexts/MobileUIContext.test.tsx`)

**Total: 12 tests**

- [x] Provides initial closed state
- [x] Opens filter drawer
- [x] Closes filter drawer
- [x] Opens nav drawer
- [x] Opens search
- [x] Closes filter when nav opened (mutex)
- [x] Closes nav when search opened (mutex)
- [x] Closes search when filter opened (mutex)
- [x] Closes all drawers
- [x] Throws error outside provider

---

## Dealer Portal (`tests/lib/dealer/`)

**Total: 121 tests across 7 files**

Golden tests covering the full dealer portal feature: auth, title generation, DisplayItem mapping, source auto-detection, API logic, image security, testing gate, and status change hook.

### Dealer Auth (`tests/lib/dealer/auth.test.ts`)

**Total: 11 tests**

- [x] Returns unauthorized when no user session
- [x] Returns success for dealer tier with dealer_id
- [x] Returns forbidden for dealer tier without dealer_id
- [x] Returns forbidden for free/enthusiast/collector/inner_circle tiers (4 tests)
- [x] Allows admin with dealer_id to act as dealer
- [x] Returns forbidden for admin without dealer_id
- [x] Returns forbidden when profile query returns null
- [x] Type narrows to access dealerId after isDealer check

### Title Generator (`tests/lib/dealer/titleGenerator.test.ts`)

**Total: 21 tests**

- [x] Full EN title: cert + type + artisan
- [x] Full JA title: cert + type + artisan kanji
- [x] Maps all 4 cert types in both EN and JA (4 tests)
- [x] Maps all 6 nihonto types in JA
- [x] Maps all 5 tosogu types in JA
- [x] Maps fuchi_kashira to Fuchi-Kashira in EN
- [x] Partial titles with missing fields (5 tests)
- [x] JA falls back to romaji when kanji is null
- [x] JA prefers kanji over romaji
- [x] Returns "Untitled" / "無題" when all fields null
- [x] Unknown cert type is omitted (no map entry)
- [x] Unknown item type passes through raw
- [x] Case insensitive type lookup (2 tests)

### DisplayItem Mapping & Source Auto-Detection (`tests/lib/dealer/displayItem.test.ts`)

**Total: 12 tests**

#### Source Auto-Detection (fromListing.ts)
- [x] **GOLDEN**: Auto-detects source="dealer" from listing.source field
- [x] **GOLDEN**: Auto-detects source="dealer" even without nw:// URL
- [x] Sets source="browse" for scraper listings (default)
- [x] Sets source="browse" when source is explicitly "scraper"
- [x] Sets source="browse" when source is null/undefined/absent

#### Dealer Mapper (fromDealerListing.ts)
- [x] Overrides source to "dealer"
- [x] Sets dealer extension with isOwnListing=true/false
- [x] Preserves all base fields from listingToDisplayItem
- [x] Preserves browse extension from base mapper
- [x] Respects locale for dealer display name

### Listing API Logic (`tests/lib/dealer/listingApi.test.ts`)

**Total: 28 tests**

#### POST Field Routing
- [x] Routes smith/school to sword fields for nihonto
- [x] Routes smith to tosogu_maker for tosogu
- [x] Prefers smith over tosogu_maker for tosogu (form sends smith)
- [x] Falls back to tosogu_maker when smith is null
- [x] Defaults to nihonto routing when category is null

#### PATCH Allowlist
- [x] Allows valid fields through
- [x] **GOLDEN**: Blocks "images" field (prevents upload bypass)
- [x] Blocks arbitrary/injection fields
- [x] Blocks status field (handled via side effects)
- [x] Blocks security-sensitive fields (source, dealer_id, url, etc.)

#### Status Change Side Effects
- [x] SOLD → is_available=false, is_sold=true
- [x] WITHDRAWN → is_available=false, is_sold=false
- [x] AVAILABLE → is_available=true, is_sold=false
- [x] Unknown status → no side effects

#### Nullish Coalescing
- [x] **GOLDEN**: ?? null preserves zero price (inquiry-based items)
- [x] ?? null preserves zero nagasa, empty string
- [x] ?? null converts undefined to null

#### CERT_NONE Sentinel
- [x] **GOLDEN**: Converts CERT_NONE to null before DB write
- [x] Preserves valid cert types and null
- [x] Does NOT convert old bad sentinel 'NONE_SELECTED'

#### Synthetic URL / DELETE Guard
- [x] Generates nw:// URL with dealer prefix
- [x] URL satisfies UNIQUE constraint (different UUIDs)
- [x] Allows deletion of WITHDRAWN, blocks AVAILABLE/SOLD

### Image Security (`tests/lib/dealer/imagesSecurity.test.ts`)

**Total: 23 tests**

#### Path Traversal Prevention
- [x] **GOLDEN**: Rejects ../ traversal attack (cross-dealer file access)
- [x] **GOLDEN**: Rejects nested traversal ../../
- [x] Rejects ../ in filename
- [x] Rejects Windows-style ..\\

#### Ownership Verification
- [x] **GOLDEN**: Rejects path belonging to different dealer
- [x] Rejects prefix-match attack (dealerId=4 vs path 42/)
- [x] Allows path genuinely belonging to dealer
- [x] Extracts storage path from valid public URL

#### URL Format Edge Cases
- [x] Rejects URL without bucket marker
- [x] Rejects empty imageUrl
- [x] Rejects URL with wrong bucket name
- [x] Handles URL with query parameters

#### Upload Constraints
- [x] File size limits (5MB)
- [x] Allowed types (JPEG, PNG, WebP)
- [x] Rejected types (GIF, SVG, PDF, JS, etc.)
- [x] Max 20 images per listing
- [x] File extension mapping (4 tests)

### Testing Gate (`tests/lib/dealer/testingGate.test.ts`)

**Total: 14 tests**

#### getListingDetail Gate
- [x] **GOLDEN**: Hides dealer listing when flag is off
- [x] **GOLDEN**: Shows dealer listing when flag is "true"
- [x] Shows scraper listing regardless of flag
- [x] Flag check is case-sensitive

#### Browse API Gate
- [x] **GOLDEN**: Adds .neq("source","dealer") filter when flag is off
- [x] No filter when flag is "true"

#### Featured Scores Cron Gate
- [x] Excludes dealer listings from scoring when flag is off
- [x] Includes dealer listings when flag is on

#### Phase 3 Go-Live Simulation
- [x] **GOLDEN**: All three gates open simultaneously when flag is "true"
- [x] **GOLDEN**: All three gates closed when flag is undefined

### Status Change Hook (`tests/lib/dealer/statusChangeHook.test.ts`)

**Total: 12 tests**

- [x] Starts with isUpdating=false and error=null
- [x] Calls PATCH with correct URL and body for SOLD/WITHDRAWN/AVAILABLE (3 tests)
- [x] Sets isUpdating during request
- [x] **GOLDEN**: Sets error on 4xx response (prevents silent failure)
- [x] **GOLDEN**: Sets fallback error when response.json() fails
- [x] **GOLDEN**: Sets "Network error" on fetch exception
- [x] **GOLDEN**: Auto-clears error after 3 seconds
- [x] Error stays visible before 3 seconds
- [x] Works without onStatusChange callback
- [x] Resets isUpdating to false after error

---

## Coverage Gaps

### Not Yet Covered

1. **SQL RPC Functions** - Database-level search functions
2. **Index Verification** - Search index integrity
3. **Stress/Load Tests** - Performance under load
4. **E2E Tests** - Full user flows with Playwright/Cypress
5. **Visual Regression** - Screenshot comparison tests

### Low Priority Gaps

1. Error boundary behavior
2. Network failure recovery
3. Offline mode handling
4. Memory leak detection

---

## Running Coverage Report

```bash
npm run test:coverage
```

This generates an HTML report in `coverage/` directory showing:
- Line coverage
- Branch coverage
- Function coverage
- Uncovered lines highlighted
