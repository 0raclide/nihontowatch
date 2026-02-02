# Implementation Plan: Legacy Swords Scraper

## Dealer Overview

| Field | Value |
|-------|-------|
| **Dealer Name** | Legacy Swords |
| **Domain** | legacyswords.com |
| **Country** | USA (Mountain Time) |
| **Currency** | USD |
| **Platform** | WordPress + Visual Portfolio plugin |
| **URL Pattern** | `/portfolio/[item-slug]/` |
| **Inventory Types** | Antique Swords, Antique Fittings, Gendai Swords, Books |

## Site Analysis Summary

### Catalog Structure
- **No pagination**: All items visible on single page per category
- **Category URLs**:
  - `/antiques/` - Antique swords and fittings (main focus)
  - `/gendai/` - Gendai (modern) swords and fittings
  - `/books/` - Books and research items
- **JavaScript-heavy**: Uses Visual Portfolio with lazy loading (`.vp-lazyload` class)

### Listing Page Structure
- **Title**: `<title>` tag, format: `[Item Name] - Legacy Arts` or `[Item] by [Smith]`
- **Price**: In body text as `"Price: $X,XXX.XX USD"` or `"Price Reduced: $X,XXX.XX USD"`
- **Sold Status**: Title contains `SOLD!`, price shows `"Price: SOLD!"`
- **Images**: Visual Portfolio gallery with FancyBox lightbox, lazy-loaded images
- **Specs**: In prose format: `"Nagasa: 25.8 cm"`, `"Motohaba: 2.5 cm"`
- **Certification**: In body text: `"NBTHK Tokubetsu Hozon"`, `"Juyo Token"`

### Key Extraction Challenges
1. **Lazy-loaded images**: Must handle `data-src`, `data-lazy-src` attributes
2. **Gallery structure**: Images in Visual Portfolio divs (`.vp-portfolio__items`)
3. **Prose-style specs**: Measurements in paragraph text, not structured
4. **Sold detection**: Check for `SOLD!` in title AND price replacement
5. **Smith attribution**: Title format is `"[Type] by [Smith]"`

---

## Implementation Plan

### Phase 1: Database Setup

**Task 1.1: Add dealer to database**
```sql
INSERT INTO dealers (name, domain, catalog_url, is_active, country)
VALUES ('Legacy Swords', 'legacyswords.com', 'https://www.legacyswords.com/antiques/', true, 'US');
```

**Files to modify:**
- None (direct Supabase insert)

---

### Phase 2: Scraper Implementation

**Task 2.1: Create scraper file**

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/legacy_swords.py`

**Class structure:**
```python
@ScraperRegistry.register
class LegacySwordsScraper(BaseScraper):
    DEALER_NAME = "Legacy Swords"
    DOMAINS = ["legacyswords.com", "www.legacyswords.com"]
```

**Key implementation details:**

1. **Price Extraction**
   ```python
   PRICE_PATTERNS = [
       (r'Price(?:\s+Reduced)?:\s*\$([0-9,]+(?:\.[0-9]{2})?)\s*USD', 'USD'),
       (r'\$([0-9,]+(?:\.[0-9]{2})?)\s*USD', 'USD'),
   ]
   ```

2. **Sold Detection**
   - Check title for `SOLD!` (case-insensitive)
   - Check price area for `"Price: SOLD!"`
   - Clear price_value when sold (no price displayed)

3. **Image Extraction**
   - Look for Visual Portfolio structure (`.vp-portfolio__items`, `.nk-portfolio-item`)
   - Handle lazy-loaded images: `data-src`, `data-lazy-src`, `data-large_image`
   - Check for FancyBox links (`a[data-fancybox]`)
   - Filter: exclude placeholders, icons < 50x50, site logos

4. **Title Extraction**
   - Primary: `<h1 class="entry-title">` (WordPress)
   - Fallback: `<title>` tag, strip ` - Legacy Arts` suffix
   - Handle `SOLD!` suffix in title

5. **Specification Extraction**
   ```python
   SPEC_PATTERNS = {
       'nagasa_cm': [r'Nagasa:\s*([0-9.]+)\s*cm', r'Length:\s*([0-9.]+)\s*cm'],
       'motohaba_cm': [r'Motohaba:\s*([0-9.]+)\s*cm'],
       'kasane_cm': [r'Kasane:\s*([0-9.]+)\s*(?:cm|mm)'],  # Note: site uses mm sometimes
       'sori_cm': [r'Sori:\s*([0-9.]+)\s*cm'],
   }
   ```
   - Handle mm → cm conversion for kasane (÷10)

6. **Certification Extraction**
   - Look for NBTHK patterns: `"NBTHK Tokubetsu Hozon"`, `"NBTHK Hozon"`, `"Juyo Token"`
   - Extract date if present: `"Dated January 30th, 1991"`
   - Pattern: `r'NBTHK\s+(Tokubetsu\s+)?(Hozon|Juyo)'`

7. **Attribution Extraction**
   - Smith from title: `r'by\s+(.+?)(?:\s+SOLD|\s+-|$)'`
   - Era detection: Look for Koto, Shinto, Shinshinto, specific period names
   - Province/School: Extract from body text patterns

8. **Item Type Detection**
   - From title keywords: katana, wakizashi, tanto, tsuba, kozuka, menuki, etc.
   - From URL slug: `/portfolio/yoroidoshi-tanto-...` → tanto
   - Handle tosogu sets: mitokoromono → FUCHI_KASHIRA or special handling

9. **Description Extraction**
   - Get `.entry-content` div text
   - Limit to 2000 chars
   - Strip price line from description

---

### Phase 3: Discovery Crawler Implementation

**Task 3.1: Create discovery crawler**

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/discovery/legacy_swords.py`

**Class structure:**
```python
class LegacySwordsCrawler(BaseCatalogCrawler):
    DEALER_NAME = "Legacy Swords"

    CATALOG_URLS = [
        "https://www.legacyswords.com/antiques/",
        "https://www.legacyswords.com/gendai/",
    ]
```

**Key implementation details:**

1. **No Pagination Required**
   - Site loads all items on single page per category
   - `_build_page_url()` returns same URL for all pages
   - `_has_next_page()` always returns False

2. **Listing Extraction**
   - Find all links matching `/portfolio/[slug]/`
   - Pattern: `r'^https?://(?:www\.)?legacyswords\.com/portfolio/[^/]+/?$'`
   - Skip sold items: Check for "SOLD" in link text (optional - may want to track sold too)

3. **Title Extraction**
   - Get from link text or parent `.vp-portfolio__title` element
   - Handle overlay text in Visual Portfolio structure

4. **Thumbnail Extraction**
   - Look for `img` in Visual Portfolio item
   - Handle lazy-loading: `data-src`, `data-lazy-src`

---

### Phase 4: Registration & Integration

**Task 4.1: Register scraper**

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/__init__.py`

Add import:
```python
from .legacy_swords import LegacySwordsScraper
```

**Task 4.2: Register crawler**

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/discovery/__init__.py`

Add import:
```python
from .legacy_swords import LegacySwordsCrawler
```

Add to `CRAWLERS` dict:
```python
"Legacy Swords": LegacySwordsCrawler,
```

---

### Phase 5: Testing

**Task 5.1: Unit tests**

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/tests/scrapers/test_legacy_swords.py`

Test cases:
- `test_can_handle_url()` - Domain matching
- `test_extract_price_available()` - Normal USD price
- `test_extract_price_reduced()` - "Price Reduced" format
- `test_extract_sold_status()` - SOLD detection
- `test_extract_images()` - Lazy-loaded gallery images
- `test_extract_specs()` - Sword measurements (cm and mm handling)
- `test_extract_certification()` - NBTHK papers
- `test_extract_attribution()` - Smith from "by [Smith]" title

**Task 5.2: Integration tests**

```bash
# Test single listing
python main.py scrape --url "https://www.legacyswords.com/portfolio/yoroidoshi-tanto-by-soshu-yasuchika/"

# Test sold listing
python main.py scrape --url "https://www.legacyswords.com/portfolio/echigo-kanesada-aka-terukane/"

# Test tosogu listing
python main.py scrape --url "https://www.legacyswords.com/portfolio/mitokoromono-by-goto-teijo-new-listing/"

# Test discovery
python main.py discover --dealer "Legacy Swords" --dry-run
```

**Task 5.3: Validation checklist**

For each test URL, verify:
- [ ] Title extracted correctly
- [ ] Price extracted (or cleared for sold)
- [ ] is_sold/is_available set correctly
- [ ] Images extracted (full-size, not thumbnails)
- [ ] Specs extracted with correct units
- [ ] Certification detected when present
- [ ] Smith attribution extracted from title
- [ ] Item type detected correctly

---

## Implementation Notes

### Known Site Quirks

1. **Visual Portfolio Plugin**
   - Uses custom classes: `.vp-portfolio__items`, `.nk-portfolio-item`
   - Image containers: `.vp-portfolio__item-img`
   - Lazy loading: `.vp-lazyload` class
   - FancyBox galleries: `data-fancybox` attribute

2. **Price Display**
   - Regular: `Price: $2,850.00 USD`
   - Reduced: `Price Reduced: $2,850.00 USD`
   - Sold: `Price: SOLD!`

3. **Kasane Units**
   - Site sometimes uses mm instead of cm
   - Example: `Kasane: 8.8 mm` should convert to 0.88 cm

4. **Title Variations**
   - Available: `Yoroidoshi Tanto by Soshu Yasuchika`
   - Sold: `Echigo Kanesada, aka: Terukane SOLD!`

5. **Small Inventory**
   - Currently ~30 items total
   - No pagination needed
   - Re-crawl can be infrequent (weekly)

### LLM Extraction Strategy

Given the site structure, recommend:
- **Use LLM**: Yes, for metadata extraction (attribution, era, description)
- **Regex fallback**: Essential for images (LLM doesn't handle)
- **Hybrid approach**: LLM for complex prose, regex for structured patterns (price, specs)

### Error Handling

1. **404s**: Follow standard retry logic from BaseScraper
2. **Empty pages**: Log warning, return empty listing
3. **Missing specs**: Don't fail - many tosogu don't have sword measurements

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `scrapers/legacy_swords.py` | Create | Main scraper class |
| `scrapers/discovery/legacy_swords.py` | Create | Catalog crawler |
| `scrapers/__init__.py` | Modify | Register scraper |
| `scrapers/discovery/__init__.py` | Modify | Register crawler |
| `tests/scrapers/test_legacy_swords.py` | Create | Unit tests |

---

## Estimated Complexity

| Component | Complexity | Notes |
|-----------|------------|-------|
| Scraper | Medium | WordPress-style, well-structured |
| Discovery | Low | No pagination, simple URL pattern |
| Image extraction | Medium | Lazy loading + FancyBox handling |
| Sold detection | Low | Clear `SOLD!` indicator |
| Price extraction | Low | Standard USD format |
| Spec extraction | Medium | Prose format + mm/cm conversion |
| Testing | Low | Small inventory, easy to validate |

**Overall: Medium complexity** - Standard WordPress/portfolio site with some JavaScript handling required for images.

---

## Acceptance Criteria

1. Scraper successfully extracts all metadata from available listings
2. Sold items correctly detected and marked
3. All gallery images extracted (not thumbnails)
4. Discovery crawler finds all `/portfolio/` URLs
5. No false positives in sold detection (avoid matching "sold" in historical text)
6. Specs correctly converted to cm when mm is used
7. All tests pass
8. Manual validation of 5+ listings shows >95% accuracy
