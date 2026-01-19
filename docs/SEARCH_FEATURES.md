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

## Text Search Fields

After semantic and numeric extraction, remaining terms search these fields:

| Field | Description |
|-------|-------------|
| `title` | Listing title |
| `description` | Full description |
| `smith` | Sword smith name (nihonto) |
| `tosogu_maker` | Fitting maker name (tosogu) |
| `school` | Smith school (nihonto) |
| `tosogu_school` | Maker school (tosogu) |
| `province` | Geographic origin (Bizen, Yamashiro, etc.) |
| `era` | Time period |
| `mei_type` | Signature status |
| `tosogu_material` | Material (for fittings) |

### Alias Expansion

Search terms are expanded to include common aliases:

| Term | Also Searches |
|------|---------------|
| `bizen` | `bishu` |
| `yamashiro` | `joshu` |
| `goto` | `gotou` |

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
| `src/lib/search/index.ts` | Library exports |
| `src/app/api/browse/route.ts` | Main search/filter API endpoint |

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

## Future Enhancements

- [ ] Autocomplete suggestions for category terms
- [ ] Visual indicator when category expansion is applied
- [ ] Search history with category term recognition
- [ ] Synonym expansion for artisan names (e.g., "Goto" → "Gotō", "後藤")
