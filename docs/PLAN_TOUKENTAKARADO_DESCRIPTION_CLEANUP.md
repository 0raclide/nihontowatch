# Plan: Toukentakarado Description Cleanup

## Issue Summary

**Date Identified:** 2026-02-02
**Affected Dealer:** Toukentakarado (dealer_id=65)
**Affected Listings:** 24 listings
**Sample Listing:** https://nihontowatch.com/?listing=42438

## Problem Description

All 24 Toukentakarado listings have polluted `description` fields containing:

1. **Navigation text at start** (repeated twice):
   ```
   ServicesConsignment/Buyer's AgentKoshirae Commission
   ServicesConsignment/Buyer's AgentKoshirae Commission
   ```

2. **UI elements embedded in text:**
   - `View fullsize` (image gallery buttons)
   - `ORDER` (purchase button)
   - `HOLD` (reservation status)

3. **Formatting issues:**
   - All content concatenated without proper spacing
   - Descriptions truncated mid-word at 3000 char limit

## Root Cause Analysis

**Location:** `/Oshi-scrapper/scrapers/toukentakarado.py:455-490`

The `_extract_description` method iterates through all `<p>` and `<div>` elements without first removing Squarespace's nested navigation structure. When it finds a large container `<div>`, it captures the entire page text including:
- Header navigation menu
- Image gallery UI
- Button text
- The actual content

**Why only Toukentakarado?**
- Site uses Squarespace with deeply nested `<div>` structure
- Main content is not in isolated `<article>` or `<main>` tags
- Navigation lives inside content containers, not separate `<nav>` elements

## Solution

### Phase 1: Fix the Scraper (Oshi-scrapper)

**File:** `/Oshi-scrapper/scrapers/toukentakarado.py`

Modify `_extract_description()` to:

1. **Remove navigation first** - Strip known Squarespace navigation patterns before text extraction
2. **Filter UI elements** - Regex remove "View fullsize", "ORDER", etc.
3. **Target article content** - Look for Squarespace blog/product content areas specifically
4. **Clean spacing** - Ensure proper paragraph breaks

```python
def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
    """Extract description/commentary from page."""

    # Work on a copy to avoid modifying original
    soup_copy = BeautifulSoup(str(soup), 'lxml')

    # Remove navigation elements first
    for elem in soup_copy.find_all(['nav', 'header', 'footer']):
        elem.decompose()
    for elem in soup_copy.find_all(class_=re.compile(r'nav|menu|header|footer|sqs-block-button', re.I)):
        elem.decompose()
    for elem in soup_copy.find_all(attrs={'data-block-type': re.compile(r'2|55')}):  # Squarespace nav/button blocks
        elem.decompose()

    # Remove button/link text patterns
    for a in soup_copy.find_all('a', class_=re.compile(r'lightbox|fullsize', re.I)):
        a.decompose()

    # Extract from main content area if available
    main_content = soup_copy.find('article') or soup_copy.find(class_='sqs-block-content')
    if main_content:
        soup_copy = main_content

    paragraphs = []
    for p in soup_copy.find_all(['p']):  # Only <p> tags, not <div>
        text = p.get_text(strip=True)

        # Skip short/navigation text
        if len(text) < 50:
            continue

        # Skip known pollution patterns
        if re.search(r'(?:ServicesConsignment|View fullsize|copyright|privacy)', text, re.IGNORECASE):
            continue

        # Skip spec-like content
        if re.search(r'^(?:Nagasa|Sori|Motohaba|Price|Designation)\s*[-:]', text, re.IGNORECASE):
            continue

        if len(text) > 100 or re.search(r'(?:blade|sword|smith|forged|hamon)', text, re.IGNORECASE):
            paragraphs.append(text)
            if len(paragraphs) >= 3:
                break

    if paragraphs:
        description = '\n\n'.join(paragraphs)
        # Clean up any remaining UI text
        description = re.sub(r'\bORDER\b', '', description)
        description = re.sub(r'View fullsize', '', description)
        description = re.sub(r'\s{2,}', ' ', description)
        return description[:3000].strip()

    # Fallback: og:description meta tag
    og_desc = soup.find('meta', property='og:description')
    if og_desc and og_desc.get('content'):
        return og_desc['content'].strip()[:2000]

    return None
```

### Phase 2: Clean Existing Data

**Option A: Re-scrape all 24 listings** (Recommended)
```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper
python main.py scrape --dealer "Toukentakarado" --force
```

**Option B: SQL cleanup** (Quick fix while re-scrape runs)
```sql
-- Strip the polluted prefix from all Toukentakarado descriptions
UPDATE listings
SET description = REGEXP_REPLACE(
    description,
    '^(ServicesConsignment/Buyer''s AgentKoshirae Commission\n?)+View fullsize',
    '',
    'i'
)
WHERE dealer_id = 65
  AND description LIKE '%ServicesConsignment%';

-- Remove "ORDER" buttons from descriptions
UPDATE listings
SET description = REGEXP_REPLACE(description, '\bORDER\b', '', 'g')
WHERE dealer_id = 65;

-- Remove "View fullsize" strings
UPDATE listings
SET description = REGEXP_REPLACE(description, 'View fullsize', '', 'g')
WHERE dealer_id = 65;

-- Clean up extra whitespace
UPDATE listings
SET description = REGEXP_REPLACE(TRIM(description), '\s{2,}', ' ', 'g')
WHERE dealer_id = 65;
```

### Phase 3: Verification

1. Check sample listings on nihontowatch.com
2. Run QA query:
   ```sql
   SELECT id, LEFT(description, 100) as desc_start
   FROM listings
   WHERE dealer_id = 65
   LIMIT 5;
   ```
3. Ensure no listings start with "Services" anymore

## Implementation Checklist

- [x] Fix `_extract_description()` in Oshi-scrapper (2026-02-02)
- [x] Test scraper locally with `--limit 1` (2026-02-02)
- [x] ~~Run SQL cleanup on existing 24 listings~~ (skipped - re-scrape overwrites)
- [x] Re-scrape all Toukentakarado listings with fixed scraper (2026-02-02)
- [x] Verify on production site (2026-02-02)
- [ ] Monitor next scrape cycle for regressions

## Resolution Summary (2026-02-02)

**Fixed by:** Modifying `_extract_description()` in `Oshi-scrapper/scrapers/toukentakarado.py` to:
1. Remove navigation elements before text extraction
2. Only extract from `<p>` tags (not container `<div>`s)
3. Filter UI patterns like "ServicesConsignment", "View fullsize", "ORDER"

**Verification:**
- 0 listings with "ServicesConsignment" pollution in `description` field
- 0 listings with "ServicesConsignment" pollution in `description_en` field
- All 24 listings now have clean LLM-generated descriptions

## Affected Files

| Repository | File | Change |
|------------|------|--------|
| Oshi-scrapper | `scrapers/toukentakarado.py` | Fix `_extract_description()` |
| nihontowatch | (none - frontend unchanged) | - |
| Supabase | `listings` table | Clean 24 rows |

## Risk Assessment

- **Low risk** - Change isolated to one dealer
- **No user impact** - Descriptions are supplementary data
- **Reversible** - Can always re-scrape
