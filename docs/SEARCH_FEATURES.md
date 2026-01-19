# Search Features

This document describes the search system in Nihontowatch, including query parsing, semantic extraction, and category expansion.

---

## Overview

The search system uses a **3-stage pipeline** to process user queries:

1. **Semantic Query Parsing** - Extracts certifications and item types for exact-match filtering
2. **Numeric Filter Parsing** - Extracts price and measurement filters
3. **Text Search** - Remaining terms search across title, description, artisan names, etc.

This design ensures precise filtering before fuzzy text search, preventing false matches.

---

## Category Term Expansion

**Added:** January 2026

When users type category terms like "nihonto" or "tosogu", the search expands them to **all item types** in that category. This ensures typing a category term gives the same results as selecting the corresponding filter.

### Nihonto (Blade) Terms

These terms expand to all blade types: `katana`, `wakizashi`, `tanto`, `tachi`, `naginata`, `yari`, `kodachi`, `ken`, `naginata naoshi`, `sword`

| Search Term | Expands To |
|-------------|------------|
| `nihonto` | All blade types |
| `nihon-to` | All blade types |
| `sword` | All blade types |
| `swords` | All blade types |
| `blade` | All blade types |
| `blades` | All blade types |
| `japanese sword` | All blade types |
| `japanese swords` | All blade types |

### Tosogu (Fitting) Terms

These terms expand to all fitting types: `tsuba`, `fuchi-kashira`, `fuchi_kashira`, `fuchi`, `kashira`, `kozuka`, `kogatana`, `kogai`, `menuki`, `koshirae`, `tosogu`, `mitokoromono`

| Search Term | Expands To |
|-------------|------------|
| `tosogu` | All fitting types |
| `fitting` | All fitting types |
| `fittings` | All fitting types |
| `sword fittings` | All fitting types |
| `sword fitting` | All fitting types |
| `kodogu` | All fitting types |

### Single Item Types (No Expansion)

Specific item types search for only that type:

| Search Term | Filters To |
|-------------|------------|
| `katana` | Only katana |
| `wakizashi` | Only wakizashi |
| `tanto` | Only tanto |
| `tsuba` | Only tsuba |
| `menuki` | Only menuki |
| `kozuka` | Only kozuka |

### Combined Searches

Category terms can be combined with other filters:

| Query | Behavior |
|-------|----------|
| `tosogu goto` | All tosogu types + text search for "goto" |
| `nihonto juyo` | All blade types + Juyo certification filter |
| `nihonto bizen` | All blade types + text search for "bizen" |
| `tosogu yoshioka` | All tosogu types + text search for "yoshioka" |

---

## Certification Extraction

Certification terms are extracted and converted to exact-match database filters:

| Search Term | Filters To |
|-------------|------------|
| `juyo` | Juyo certification |
| `tokuju`, `tokubetsu juyo` | Tokubetsu Juyo certification |
| `hozon` | Hozon certification |
| `tokuho`, `tokubetsu hozon` | Tokubetsu Hozon certification |
| `kicho`, `tokukicho` | Kicho/Tokubetsu Kicho |
| `nthk` | NTHK certification |

---

## Signature Status Extraction

**Added:** January 2026

Signature status terms are extracted and converted to exact-match filters on `signature_status`:

| Search Term | Filters To |
|-------------|------------|
| `signed`, `mei` | `signature_status = 'signed'` |
| `unsigned`, `mumei` | `signature_status = 'unsigned'` |

### Example

Query: `"tokuju tachi signed"`

Parsing result:
- `certifications: ['Tokuju']` → exact filter on `cert_type`
- `itemTypes: ['tachi']` → exact filter on `item_type`
- `signatureStatuses: ['signed']` → exact filter on `signature_status`
- `remainingTerms: []` → nothing left for text search

This fixes the issue where searching "tokuju tachi signed" returned 0 results because "signed" was being text-searched instead of filtered.

### Example

Query: `"tanto juyo goto"`

Parsing result:
- `itemTypes: ['tanto']` → exact filter on `item_type`
- `certifications: ['Juyo']` → exact filter on `cert_type`
- `remainingTerms: ['goto']` → text search across all fields

---

## Numeric Filter Extraction

Numeric filters can be embedded in the search query:

### Blade Length (Nagasa)

| Syntax | Example | Meaning |
|--------|---------|---------|
| `nagasa>N` | `nagasa>70` | Blade length > 70cm |
| `nagasa>=N` | `nagasa>=72.5` | Blade length >= 72.5cm |
| `nagasa<N` | `nagasa<65` | Blade length < 65cm |
| `cm>N` | `cm>70` | Same as nagasa>70 |

### Price

| Syntax | Example | Meaning |
|--------|---------|---------|
| `price>N` | `price>500000` | Price > 500,000 JPY |
| `jpy>N` | `jpy>=1000000` | Price >= 1,000,000 JPY |
| `usd>N` | `usd>5000` | Converts to JPY, filters |
| `eur<N` | `eur<10000` | Converts to JPY, filters |

### Example

Query: `"bizen cm>70 jpy<2000000"`

Parsing result:
- `filters: [{ field: 'nagasa_cm', op: 'gt', value: 70 }, { field: 'price_jpy', op: 'lt', value: 2000000 }]`
- `textWords: ['bizen']` → text search

---

## Full-Text Search (FTS) Implementation

**Added:** January 2026

The search system uses PostgreSQL Full-Text Search (FTS) for text matching, providing **word boundary matching** instead of substring matching. This prevents false positives like "rai" matching "grained".

### Architecture

```
User Query: "koto tanto"
         ↓
┌─────────────────────────────────────────────────┐
│ 1. Semantic Parsing (certifications, types)     │
│    → No semantic terms found                    │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ 2. Alias Expansion (with OR)                    │
│    "koto" → ["koto", "kotou"]                   │
│    "tanto" → ["tanto"]                          │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ 3. FTS Query Builder                            │
│    tsquery: "(koto:* | kotou:*) & tanto:*"      │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ 4. PostgreSQL textSearch on search_vector       │
│    Uses GIN index for fast lookups              │
└─────────────────────────────────────────────────┘
```

### Search Vector Fields (Weighted)

The `search_vector` column is a pre-computed `tsvector` with weighted fields:

| Weight | Fields | Description |
|--------|--------|-------------|
| **A** (highest) | `title`, `smith`, `tosogu_maker` | Primary identifiers |
| **B** | `school`, `tosogu_school` | Attribution lineage |
| **C** | `province`, `era`, `description`, `description_en` | Context |

**Important:** `raw_page_text` was **removed** from the search vector (migration 026) because it contained noise from dealer page sidebars (Related Items, navigation, etc.) that caused false positives.

### Word Boundary Matching

FTS provides word boundary matching via the `@@` operator:

| Query | ILIKE (old) | FTS (current) |
|-------|-------------|---------------|
| `rai` | ✗ Matches "g**rai**ned" | ✓ Only matches "rai" as word |
| `kunimitsu` | ✗ Matches substrings | ✓ Word boundary match |

### Alias Expansion with OR

Aliases are joined with OR (`|`) to match ANY variant:

```
"koto"  → tsquery: "(koto:* | kotou:*)"
"goto"  → tsquery: "(goto:* | gotou:*)"
```

**Critical:** Using AND for aliases would require BOTH variants in the same document, returning 0 results. This was a bug fixed in commit `e6af058`.

---

## Text Search Fields

After semantic and numeric extraction, remaining terms search these fields via the `search_vector`:

| Field | Weight | Description |
|-------|--------|-------------|
| `title` | A | Listing title |
| `smith` | A | Sword smith name (nihonto) |
| `tosogu_maker` | A | Fitting maker name (tosogu) |
| `school` | B | Smith school (nihonto) |
| `tosogu_school` | B | Maker school (tosogu) |
| `province` | C | Geographic origin (Bizen, Yamashiro, etc.) |
| `era` | C | Time period |
| `description` | C | Japanese description (3000 chars max) |
| `description_en` | C | English description (3000 chars max) |

**Note:** `mei_type` is NOT in the search_vector. Searching "signed" won't match `mei_type="mei"`. Use the signature filter instead.

### Alias Expansion

Search terms are expanded to include romanization variants:

| Term | Also Searches |
|------|---------------|
| `bizen` | `bishu` |
| `yamashiro` | `joshu` |
| `goto` | `gotou` |
| `koto` | `kotou` |
| `shinto` | `shintou` |
| `shinshinto` | `shinshintou` |

---

## Text Normalization

All queries are normalized before processing:

1. **Lowercase** - Case-insensitive matching
2. **Macron removal** - `Tōkyō` → `tokyo`, `Gotō` → `goto`
3. **Whitespace collapse** - Multiple spaces → single space
4. **Kanji variants** - Simplified ↔ Traditional (国 ↔ 國)

---

## API Usage

### Browse Endpoint

```
GET /api/browse?q=<query>&type=<types>&cert=<certs>&...
```

**Parameters:**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `q` | string | `tanto juyo` | Search query |
| `cat` | string | `nihonto`, `tosogu`, `all` | Category filter |
| `type` | csv | `katana,wakizashi` | Item type filter |
| `cert` | csv | `Juyo,Hozon` | Certification filter |
| `dealer` | csv | `1,5,12` | Dealer ID filter |
| `sort` | string | `price_desc`, `price_asc`, `recent` | Sort order |
| `page` | number | `1` | Page number |
| `limit` | number | `100` | Results per page |

### Interaction Between Query and Filters

- Semantic terms extracted from `q` are applied as filters **only if** no explicit filter is set via URL params
- If `?type=katana` is set, item types from the query are ignored
- If `?cert=Juyo` is set, certifications from the query are ignored

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/search/semanticQueryParser.ts` | Certification, item type, and category extraction |
| `src/lib/search/numericFilters.ts` | Price and measurement filter extraction |
| `src/lib/search/textNormalization.ts` | Text normalization and alias expansion |
| `src/lib/search/ftsQueryBuilder.ts` | FTS tsquery builder (partially deprecated) |
| `src/lib/search/index.ts` | Library exports |
| `src/lib/search.ts` | Main search utilities (alias expansion used by browse) |
| `src/app/api/browse/route.ts` | Main search/filter API endpoint with FTS |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `007_fts_search.sql` | Initial FTS setup (search_vector, GIN index) |
| `024_fix_search_vector.sql` | Add description_en to search vector |
| `025_clean_raw_page_text.sql` | Strip navigation noise from raw_page_text |
| `026_remove_raw_text_from_search.sql` | Remove raw_page_text entirely from search vector |

---

## Testing

### Unit Tests

```bash
# Run all search-related tests
npm test -- semanticQueryParser
npm test -- search-edge-cases
npm test -- textNormalization

# Run browse API tests
npm test -- browse
```

### Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/lib/semanticQueryParser.test.ts` | 46 | Category expansion, certifications, item types |
| `tests/lib/search-edge-cases.test.ts` | 100+ | Unicode, Japanese text, SQL injection |
| `tests/lib/textNormalization.test.ts` | 50+ | Macrons, normalization |
| `tests/api/browse-search.test.ts` | 50+ | Integration tests |

---

## Changelog

### January 2026 - Signature Status Semantic Extraction

**Commit:** (pending)

**Problem:** Searching "tokuju tachi signed" returned 0 results because "signed" was text-searched instead of filtered.

**Root Cause:** The `mei_type` field wasn't in the search_vector, and there was no semantic extraction for signature terms.

**Solution:** Added "signed"/"unsigned"/"mei"/"mumei" to the semantic query parser:
- These terms are now extracted and converted to exact-match filters on `signature_status`
- Follows the same pattern as certifications and item types
- Bypasses text search entirely for better precision

**Files Changed:**
- `src/lib/search/semanticQueryParser.ts` - Added SIGNATURE_STATUS_TERMS and extraction logic
- `src/app/api/browse/route.ts` - Apply extracted signature filters
- `tests/lib/semanticQueryParser.test.ts` - Added 17 new unit tests

---

### January 2026 - FTS Alias OR Fix

**Commit:** `e6af058`

**Problem:** Searches like "koto tanto" returned 0 results despite valid data existing.

**Root Cause:** The alias expansion was joining aliases with AND:
- "koto" expanded to `['koto', 'kotou']`
- Query became `koto:* & kotou:*` (requiring BOTH in same document)
- No documents have both romanizations, so 0 results

**Solution:** Changed alias expansion to use OR (`|`) operator:
- "koto" now generates `(koto:* | kotou:*)`
- "koto tanto" generates `(koto:* | kotou:*) & tanto:*`

**Files Changed:**
- `src/app/api/browse/route.ts` - Fixed alias expansion logic

---

### January 2026 - Remove raw_page_text from Search Vector

**Migration:** `026_remove_raw_text_from_search.sql`

**Problem:** False positives for "Rai Kunimitsu" returning unrelated items because dealer page sidebars (Related Items, navigation) were indexed.

**Root Cause:** `raw_page_text` contained content from both BEFORE and AFTER the main listing content, including other products from the dealer's Related Items section.

**Solution:** Removed `raw_page_text` from search vector entirely. We have sufficient structured fields:
- Weight A: title, smith, tosogu_maker
- Weight B: school, tosogu_school
- Weight C: province, era, description, description_en

**Files Changed:**
- `supabase/migrations/026_remove_raw_text_from_search.sql` - Updated `build_listing_search_vector` function

---

### January 2026 - FTS Implementation

**Commits:** Multiple (see git log)

**Problem:** ILIKE `%term%` matching caused false positives:
- "rai" matched "g**rai**ned" in descriptions
- No word boundary enforcement
- No relevance scoring

**Solution:** Replaced ILIKE with PostgreSQL Full-Text Search:
- Uses pre-computed `search_vector` column with GIN index
- Provides word boundary matching (no substring pollution)
- Supports weighted relevance scoring
- Uses `simple` config (no stemming) for Japanese romanization

**Files Changed:**
- `src/app/api/browse/route.ts` - Replaced ILIKE loop with FTS textSearch
- `src/lib/search/ftsQueryBuilder.ts` - Created FTS query builder (now partially deprecated, inline logic in route)
- `supabase/migrations/024-026` - Search vector improvements

---

### January 2026 - Category Term Expansion

**Commit:** `1abd6a3`

**Problem:** Typing "tosogu" or "nihonto" gave different results than selecting the category filter.

- Typing "tosogu" → text search finding ~50 items with "tosogu" in description
- Selecting Tosogu filter → all 1000+ fitting items

**Solution:** Added category term mappings that expand to all types in the category:

- `nihonto`, `sword`, `blade` → all blade types
- `tosogu`, `fittings`, `kodogu` → all fitting types

**Files Changed:**
- `src/lib/search/semanticQueryParser.ts` - Added category mappings and expansion logic
- `tests/lib/semanticQueryParser.test.ts` - 46 new unit tests

---

## Known Limitations

### 1. ~~mei_type Not Searchable by Text~~ ✅ FIXED

~~The `mei_type` field (signed/unsigned) is NOT in the search_vector. Searching "signed" will not find items with `mei_type="mei"`.~~

**Fixed (January 2026):** Added "signed"/"unsigned"/"mei"/"mumei" to semantic query parser. These terms are now extracted and applied as exact-match filters on `signature_status` column, bypassing text search entirely.

### 2. ID 7701 False Positive for "Rai Kunimitsu"

One listing (ID 7701) still appears for "Rai Kunimitsu" because its `description` field genuinely contains "Rai Kunimitsu" text (likely an attribution comparison). This is a data quality issue, not a search issue.

### 3. No Relevance Sorting in Main Browse

The main browse endpoint doesn't yet support `sort=relevance` with `ts_rank_cd` scoring. All results are sorted by price or date, not search relevance.

**Potential Fix:** Create RPC function with relevance sorting, or add `ts_rank_cd` to query builder.

---

## Future Enhancements

- [x] ~~Add `mei_type` to search vector~~ → Solved via semantic extraction instead (Jan 2026)
- [ ] Relevance sorting option with `ts_rank_cd`
- [ ] Autocomplete suggestions for category terms
- [ ] Visual indicator when category expansion is applied
- [ ] Search history with category term recognition
- [ ] Synonym expansion for artisan names (e.g., "Goto" → "Gotō", "後藤")
- [ ] Phrase matching with quotes: `"Rai Kunimitsu"` → `rai <-> kunimitsu`
