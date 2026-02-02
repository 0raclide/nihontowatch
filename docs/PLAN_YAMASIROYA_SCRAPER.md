# Yamasiroya Scraper Implementation Plan

**Status:** Implemented
**Priority:** High
**Dealer:** Yamasiroya (山城屋)
**Domain:** yamasiroya.com
**Country:** Japan

---

## Executive Summary

Yamasiroya is a well-established Japanese sword dealer specializing in nihonto (blades), tsuba, tosogu (fittings), and yoroi (armor). The site has a clean bilingual structure (Japanese/English integrated), UTF-8 encoding, and provides rich metadata including specifications, certifications, and detailed descriptions.

**Key characteristics:**
- ~156 total URLs in sitemap
- No pagination (all items on single category pages)
- Bilingual content (extraction-friendly)
- Clean specification tables
- UTF-8 encoding (no special handling needed)
- XML sitemap available

---

## Site Analysis

### 1. Domain & Structure

| Property | Value |
|----------|-------|
| Domain | `www.yamasiroya.com` |
| Encoding | UTF-8 |
| Language | Japanese + English (bilingual) |
| Sitemap | `https://www.yamasiroya.com/sitemap.xml` (156 URLs) |
| Last Update | 2022-07-08 (per sitemap) |

### 2. URL Patterns

#### Catalog Pages (Discovery)

| Category | URL | Item Types |
|----------|-----|------------|
| Swords | `/katana/` | Katana, Wakizashi, Tanto, Tachi, Yari, Naginata |
| Tsuba | `/tsuba/` | Tsuba (sword guards) |
| Fittings | `/tousougu/` | Menuki, Fuchi-kashira, Kozuka, Kogai, Mitokoromono |
| Armor | `/yoroi/` | Yoroi, Kabuto (helmets) |
| Other | `/others/` | Miscellaneous |
| Paintings | `/japanesepaintings/` | Japanese art (out of scope) |

#### Item Pages (Extraction)

```
Swords:    /katana/[subcategory]/[id].html
           e.g., /katana/tanto/_1545.html
                 /katana/katana/post_23.html
                 /katana/yari/post_27.html

Tsuba:     /tsuba/[id].html
           e.g., /tsuba/post_29.html
                 /tsuba/_owari_tsuba.html

Fittings:  /tousougu/[code]/[id].html
           e.g., /tousougu/010/post_5.html (menuki)
                 /tousougu/020/post_3.html (fuchi-kashira)
                 /tousougu/030/post_2.html (kozuka)

Armor:     /yoroi/[id].html
           e.g., /yoroi/post.html
```

**Subcategory Codes for Fittings:**
- `010/` = Menuki
- `020/` = Fuchi-kashira
- `030/` = Kozuka
- `040/` = Kogai (inferred)
- `050/` = Mitokoromono

### 3. Catalog Page Structure (Discovery)

**Layout:** Vertical list (not grid), no pagination
**Content per item:**
- Title (Japanese + sometimes English)
- Thumbnail image
- Category tags
- Status indicator ("ご案内終了" = sold)
- No prices on catalog pages

**Discovery Strategy:**
Since there's no pagination and total inventory is ~100-150 items, the discovery crawler can fetch each category page once and extract all item URLs in a single pass.

### 4. Listing Page Structure (Extraction)

#### Common Elements (All Item Types)

| Field | Location | Format |
|-------|----------|--------|
| Title | `<title>` or `<h2>` | Japanese with brackets, e.g., "【短刀】相州住康春作" |
| Price | Specification table | "Price(JPY)" row, e.g., "￥220,000" or "1,800,000 JPY" |
| Status | Title or price field | "ご案内終了" = sold, "Sold out" |
| Product No. | Specification table | e.g., "KA-155", "tu-313" |
| Images | Thumbnail gallery | Pattern: `/img/qXX_picY.jpg` |
| Description | After specs table | Japanese paragraph text ("解説" section) |

#### Sword-Specific Fields

| Field | Japanese Label | English Label | Example Value |
|-------|----------------|---------------|---------------|
| Nagasa | 刃長 | Blade length | "71.8cm（2尺3寸6分）" |
| Sori | 反り | Curvature | "1.1cm" |
| Motohaba | 元幅 | Base width | "3.2cm" |
| Sakihaba | 先幅 | Tip width | "2.1cm" |
| Kasane | 元重 | Thickness | "0.70cm" |
| Mekugiana | 目釘穴 | Peg holes | "1" |
| Smith | 銘 / 作者 | Maker | "近江守源久道" |
| Era | 時代 | Period | "Edo period" |
| Province | 国 | Origin | "Yamashiro" |
| Certification | 鑑定書 | NBTHK certificate | "Tokubetu Hozon paper" |

#### Tsuba-Specific Fields

| Field | Japanese Label | English Label | Example Value |
|-------|----------------|---------------|---------------|
| Height | 縦 | Length/Height | "8.0cm" |
| Width | 横 | Width | "7.9cm" |
| Thickness | 切羽台厚 | Seppadai thickness | "~4mm" |
| Weight | 重量 | Weight | "152g" |
| Material | 材質 | Material | "Iron (鉄)" |
| Technique | 技法 | Technique | "鋤出彫、金赤銅象嵌" |
| Maker | 作者 | Maker | "正阿弥一光" |
| School | 流派 | School | "会津正阿弥派" |
| Certification | 鑑定書 | Certificate | "Hozon Tosogu" |

### 5. Status Detection

**Sold Indicators (Japanese):**
- `ご案内終了` (guidance ended) - Primary indicator
- `Sold out` (in price field)
- `売約済` (sold) - Standard Japanese
- `売却済` (sold out)

**Reserved Indicators:**
- `商談中` (under negotiation) - Should be RESERVED, not SOLD
- `お取り置き` (reserved/held)

**Available Indicators:**
- Price displayed with yen symbol (￥)
- "お問い合わせ" (inquiry) button present
- No sold indicators

### 6. Image Extraction

**Pattern:** `/img/q[XX]_pic[Y].jpg`
- XX = item identifier
- Y = image number (1, 2, 3...)

**Sources:**
1. Thumbnail gallery `<a>` links with lightbox
2. `<img>` tags with `data-src` or `src`

**Filter out:**
- Icons, logos, buttons
- Social media images
- Shop photos (not product images)

---

## Implementation Plan

### Phase 1: Create Scraper Class

**File:** `/Oshi-scrapper/scrapers/yamasiroya.py`

```python
@ScraperRegistry.register
class YamasiroyaScraper(BaseScraper):
    DEALER_NAME = "Yamasiroya"
    DOMAINS = ["yamasiroya.com", "www.yamasiroya.com"]

    # Sold indicators specific to this dealer
    SOLD_INDICATORS = [
        'ご案内終了',
        'sold out',
        '売約済',
        '売却済',
    ]

    RESERVED_INDICATORS = [
        '商談中',
        'お取り置き',
    ]
```

#### Core Methods to Implement

1. **`_extract_data(soup, listing, images_only)`**
   - Orchestrate all extraction
   - Handle images_only mode for LLM path

2. **`_extract_title(soup)`**
   - Try `<title>` tag first (clean brackets)
   - Fallback to `<h2>` or og:title
   - Remove status indicators from title

3. **`_detect_item_type(title, url)`**
   - URL-based detection (most reliable):
     - `/katana/tanto/` → TANTO
     - `/katana/wakizashi/` → WAKIZASHI
     - `/katana/tachi/` → TACHI
     - `/katana/yari/` → YARI
     - `/katana/naginata/` → NAGINATA
     - `/katana/katana/` or `/katana/new/` → KATANA
     - `/tsuba/` → TSUBA
     - `/tousougu/010/` → MENUKI
     - `/tousougu/020/` → FUCHI_KASHIRA
     - `/tousougu/030/` → KOZUKA
     - `/tousougu/040/` → KOGAI
     - `/tousougu/050/` → MITOKOROMONO
     - `/yoroi/` → ARMOR or HELMET
   - Title-based fallback using Japanese keywords

4. **`_extract_price(soup)`**
   - Find "Price(JPY)" or "価格" row
   - Parse yen value: `￥220,000` or `1,800,000 JPY`
   - Handle "Sold out" in price field

5. **`_check_sold_status(soup)`**
   - Check title for "ご案内終了"
   - Check price field for "Sold out"
   - Check page text for sold indicators
   - Distinguish RESERVED from SOLD

6. **`_extract_specs(soup)`** (for swords)
   - Parse bilingual specification table
   - Extract all measurement fields
   - Handle mixed units (cm + shaku/sun)

7. **`_extract_tosogu_specs(soup)`** (for fittings)
   - Parse dimensions (height, width, thickness)
   - Extract weight, material, technique
   - Extract maker and school

8. **`_extract_attribution(soup)`**
   - Smith/maker name
   - School
   - Province
   - Era

9. **`_extract_certification(soup)`**
   - Certificate type (Juyo, Tokubetsu Hozon, Hozon)
   - Organization (NBTHK, NTHK)
   - Normalize to standard format

10. **`_extract_images(soup)`**
    - Find gallery thumbnails
    - Extract full-size URLs
    - Filter non-product images
    - Limit to 20 images

11. **`_extract_description(soup)`**
    - Find 解説 (kaisetsu) section
    - Extract Japanese text for raw_page_text
    - Used for LLM re-processing

### Phase 2: Create Discovery Crawler

**File:** `/Oshi-scrapper/scrapers/discovery/yamasiroya.py`

```python
class YamasiroyaCrawler(BaseCatalogCrawler):
    DEALER_NAME = "Yamasiroya"
    CATALOG_URLS = [
        "https://www.yamasiroya.com/katana/",
        "https://www.yamasiroya.com/tsuba/",
        "https://www.yamasiroya.com/tousougu/",
        "https://www.yamasiroya.com/yoroi/",
        "https://www.yamasiroya.com/others/",
    ]
```

#### Alternative: Sitemap-Based Discovery

Since Yamasiroya has a well-maintained sitemap, consider sitemap-based discovery:

```python
def crawl(self) -> CrawlResult:
    # Fetch sitemap.xml
    sitemap = self._fetch_sitemap("https://www.yamasiroya.com/sitemap.xml")

    # Filter to product URLs only (exclude info/faq pages)
    product_urls = [
        url for url in sitemap
        if any(cat in url for cat in ['/katana/', '/tsuba/', '/tousougu/', '/yoroi/', '/others/'])
        and url.endswith('.html')
    ]

    return CrawlResult(
        dealer=self.DEALER_NAME,
        total_found=len(product_urls),
        new_urls=product_urls,
        # ...
    )
```

#### Core Methods to Implement

1. **`_build_page_url(base_url, page_num)`**
   - Return base_url unchanged (no pagination)

2. **`_extract_listings(soup, page_url)`**
   - Find all `<a>` links to `.html` pages
   - Filter to product URLs (exclude nav/info)
   - Extract title preview if available

3. **`_has_next_page(soup, current_page)`**
   - Return `False` (no pagination)

### Phase 3: Register and Import

**File:** `/Oshi-scrapper/scrapers/__init__.py`

Add import:
```python
from . import yamasiroya  # Triggers @register decorator
```

**File:** `/Oshi-scrapper/scrapers/discovery/__init__.py`

Add import:
```python
from . import yamasiroya
```

### Phase 4: Add to Dealers Table

```sql
INSERT INTO dealers (name, domain, catalog_url, is_active, country)
VALUES ('Yamasiroya', 'yamasiroya.com', 'https://www.yamasiroya.com/', true, 'Japan');
```

---

## Extraction Patterns

### Specification Table Parser

The site uses consistent bilingual tables. Example extraction:

```python
def _extract_spec_value(self, soup: BeautifulSoup, labels: list[str]) -> Optional[str]:
    """Extract value from spec table by label (supports multiple label variants)."""
    for label in labels:
        # Try both th/td patterns
        row = soup.find('th', string=re.compile(label, re.IGNORECASE))
        if row:
            td = row.find_next_sibling('td')
            if td:
                return td.get_text(strip=True)

        # Also try within same cell (label: value format)
        cell = soup.find(string=re.compile(f'{label}[：:]', re.IGNORECASE))
        if cell:
            text = cell.parent.get_text()
            match = re.search(f'{label}[：:]\s*(.+)', text)
            if match:
                return match.group(1).strip()

    return None

# Usage
nagasa = self._extract_spec_value(soup, ['刃長', 'Blade length', '長さ'])
sori = self._extract_spec_value(soup, ['反り', 'Curvature', 'Sori'])
price = self._extract_spec_value(soup, ['Price', '価格', '販売価格'])
```

### Measurement Conversion

The site uses mixed units. Conversion helpers:

```python
def _parse_measurement(self, text: str) -> Optional[float]:
    """Parse measurement, convert to cm if needed."""
    if not text:
        return None

    # Extract numeric value first
    # Pattern: "71.8cm（2尺3寸6分）" or "約24.9cm" or just "0.7cm"
    cm_match = re.search(r'約?(\d+\.?\d*)\s*cm', text)
    if cm_match:
        return float(cm_match.group(1))

    # Shaku/sun/bu conversion (1 shaku = 30.3cm, 1 sun = 3.03cm, 1 bu = 0.303cm)
    shaku_match = re.search(r'(\d+)尺(\d+)寸(\d+)分', text)
    if shaku_match:
        shaku, sun, bu = map(int, shaku_match.groups())
        return round((shaku * 30.3) + (sun * 3.03) + (bu * 0.303), 2)

    return None
```

### Price Parser

```python
def _parse_price(self, text: str) -> tuple[Optional[float], Optional[str]]:
    """Parse price, return (value, currency) or (None, 'SOLD')."""
    if not text:
        return None, None

    # Check for sold indicators first
    if any(ind in text.lower() for ind in ['sold', 'ご案内終了', '売約済']):
        return None, 'SOLD'

    # Parse yen values
    # Patterns: "￥220,000", "1,800,000 JPY", "¥1,800,000"
    yen_match = re.search(r'[￥¥]?\s*([\d,]+)\s*(?:円|JPY|yen)?', text, re.IGNORECASE)
    if yen_match:
        value = float(yen_match.group(1).replace(',', ''))
        return value, 'JPY'

    return None, None
```

### Item Type Detection (URL-Based)

```python
ITEM_TYPE_URL_MAP = {
    # Swords
    '/katana/tanto/': ItemType.TANTO,
    '/katana/wakizashi/': ItemType.WAKIZASHI,
    '/katana/tachi/': ItemType.TACHI,
    '/katana/yari/': ItemType.YARI,
    '/katana/naginata/': ItemType.NAGINATA,
    '/katana/cat20/': ItemType.KOSHIRAE,  # Koshirae category
    '/katana/new/': ItemType.KATANA,  # Default for "new" items
    '/katana/katana/': ItemType.KATANA,

    # Tsuba
    '/tsuba/': ItemType.TSUBA,

    # Fittings
    '/tousougu/010/': ItemType.MENUKI,
    '/tousougu/020/': ItemType.FUCHI_KASHIRA,
    '/tousougu/030/': ItemType.KOZUKA,
    '/tousougu/040/': ItemType.KOGAI,
    '/tousougu/050/': ItemType.MITOKOROMONO,
    '/tousougu/060/': ItemType.FUTATOKORO,  # If exists

    # Armor
    '/yoroi/': ItemType.ARMOR,
}

def _detect_item_type(self, title: str, url: str) -> ItemType:
    """Detect item type primarily from URL, with title fallback."""
    url_lower = url.lower()

    # URL-based detection (most reliable)
    for pattern, item_type in self.ITEM_TYPE_URL_MAP.items():
        if pattern in url_lower:
            return item_type

    # Title-based fallback
    title_lower = title.lower() if title else ''
    if '短刀' in title_lower or 'tanto' in title_lower:
        return ItemType.TANTO
    if '脇差' in title_lower or 'wakizashi' in title_lower:
        return ItemType.WAKIZASHI
    # ... more patterns

    return ItemType.UNKNOWN
```

### Certification Parser

```python
CERT_PATTERNS = [
    # Most specific first!
    ('特別重要刀剣', 'Tokubetsu Juyo', 'NBTHK'),
    ('tokubetu juyo', 'Tokubetsu Juyo', 'NBTHK'),  # Note: their typo
    ('特別保存刀剣', 'Tokubetsu Hozon', 'NBTHK'),
    ('tokubetu hozon', 'Tokubetsu Hozon', 'NBTHK'),  # Note: their typo
    ('重要刀剣', 'Juyo', 'NBTHK'),
    ('juyo', 'Juyo', 'NBTHK'),
    ('保存刀剣', 'Hozon', 'NBTHK'),
    ('hozon paper', 'Hozon', 'NBTHK'),
    ('保存刀装具', 'Hozon Tosogu', 'NBTHK'),
    ('hozon tosogu', 'Hozon Tosogu', 'NBTHK'),
    ('特別保存刀装具', 'Tokubetsu Hozon Tosogu', 'NBTHK'),
]

def _extract_certification(self, soup: BeautifulSoup) -> Optional[Certification]:
    """Extract certification from specification table."""
    cert_text = self._extract_spec_value(soup, ['鑑定書', 'NBTHK', 'certificate'])
    if not cert_text:
        return None

    text_lower = cert_text.lower()
    for jp_pattern, cert_type, org in self.CERT_PATTERNS:
        if jp_pattern in text_lower:
            return Certification(
                cert_type=cert_type,
                cert_organization=org,
            )

    return None
```

---

## Testing Strategy

### Unit Tests

1. **URL pattern matching**
   - Test all category URL → ItemType mappings
   - Test edge cases (missing subcategory, unusual paths)

2. **Specification parsing**
   - Test measurement extraction with various formats
   - Test price parsing (sold, available, various formats)
   - Test bilingual table parsing

3. **Status detection**
   - Test sold indicators (Japanese and English)
   - Test reserved vs. sold distinction

### Integration Tests

1. **Live page scraping** (manual or CI with fixtures)
   - Scrape 5 known items, verify all fields extracted
   - Test one item from each category (sword, tsuba, fitting)

2. **Discovery crawling**
   - Verify all catalog pages crawled
   - Verify URL deduplication works
   - Verify sitemap parsing (if used)

### Validation Checklist

- [ ] Scrape a TANTO with Tokubetsu Hozon → verify specs + cert
- [ ] Scrape a KATANA with full measurements → verify nagasa, sori, etc.
- [ ] Scrape a TSUBA with dimensions → verify height, width, weight
- [ ] Scrape a FUCHI_KASHIRA → verify item_type correctly detected
- [ ] Scrape a SOLD item → verify is_sold=True, no price
- [ ] Discovery finds all items from sitemap (~100-150)
- [ ] No duplicate URLs discovered
- [ ] All images extracted correctly (no icons/logos)

---

## Edge Cases & Gotchas

### 1. Typo in Certification Names

Yamasiroya uses "Tokubetu" instead of "Tokubetsu" in some places:
- "Tokubetu Hozon paper" (missing 's')
- Handle both spellings in parser

### 2. Mixed Subcategory Structures

Swords use subcategories (`/katana/tanto/`), but tsuba doesn't (`/tsuba/post_29.html`).
Fittings use numeric codes (`/tousougu/010/`).
Handle all three patterns.

### 3. Price Includes Tax Notice

Some prices show "(税・送料込み)" (tax & shipping included).
This is informational only - extract the numeric value.

### 4. Koshirae Category

`/katana/cat20/` appears to be koshirae (sword mountings), not blades.
Map to `ItemType.KOSHIRAE` if that exists, or handle appropriately.

### 5. Low Inventory Volume

~100-150 total items means:
- No need for aggressive rate limiting
- Single-pass discovery sufficient
- Changes detected via full rescrape

### 6. Bilingual Extraction Opportunity

Since pages have both Japanese and English, we can:
- Use English fields directly when available
- Fall back to Japanese with mapping
- Reduces LLM dependency for basic fields

---

## Estimated Implementation Effort

| Task | Complexity | Dependencies |
|------|------------|--------------|
| Create scraper class | Medium | Base patterns understood |
| Implement specification parser | Medium | Table structure analyzed |
| Implement item type detection | Low | URL patterns mapped |
| Implement certification parser | Low | Patterns documented |
| Implement status detection | Low | Indicators identified |
| Create discovery crawler | Low | No pagination |
| Add tests | Medium | Fixtures needed |
| Register and deploy | Low | Standard process |

**Recommended approach:** Start with LLM-enabled mode for initial extraction, then add regex extraction methods to handle cases where LLM underperforms. The bilingual content makes this dealer easier than Japanese-only sites.

---

## Files to Create/Modify

### New Files

1. `/Oshi-scrapper/scrapers/yamasiroya.py` - Main scraper class (~300-400 lines)
2. `/Oshi-scrapper/scrapers/discovery/yamasiroya.py` - Discovery crawler (~100 lines)
3. `/Oshi-scrapper/tests/scrapers/test_yamasiroya.py` - Unit tests (~200 lines)

### Modified Files

1. `/Oshi-scrapper/scrapers/__init__.py` - Add import
2. `/Oshi-scrapper/scrapers/discovery/__init__.py` - Add import
3. Database: Add dealer record

---

## Success Criteria

1. **Extraction accuracy ≥ 95%** for core fields (title, price, item_type, status)
2. **Specification accuracy ≥ 90%** for measurements (nagasa, sori, dimensions)
3. **Zero false sold detections** (reserved items not marked as sold)
4. **All images extracted** for available items
5. **Discovery finds all items** from catalog pages
6. **No duplicate URLs** in discovered_urls table

---

## Open Questions

1. **Should we use sitemap-based discovery?**
   - Pro: Single fetch, all URLs, includes lastmod dates
   - Con: May include non-product URLs requiring filtering
   - Recommendation: Use sitemap with URL filtering

2. **How to handle `/others/` category?**
   - Contains miscellaneous items (stands, books?)
   - May need ItemType.OTHER or specific types
   - Recommendation: Scrape and use LLM to classify

3. **Japanese Paintings section?**
   - Out of scope for nihonto aggregator?
   - Recommendation: Exclude from discovery (filter out `/japanesepaintings/`)

---

## Appendix: Sample URLs for Testing

### Swords
- Tanto (sold): `https://www.yamasiroya.com/katana/tanto/_1545.html`
- Katana (available): `https://www.yamasiroya.com/katana/katana/post_23.html`
- Yari: `https://www.yamasiroya.com/katana/yari/post_27.html`
- Koshirae: `https://www.yamasiroya.com/katana/cat20/post_18.html`

### Tsuba
- Available: `https://www.yamasiroya.com/tsuba/post_29.html`
- Multiple: `https://www.yamasiroya.com/tsuba/post_28.html`

### Fittings
- Menuki: `https://www.yamasiroya.com/tousougu/010/post_5.html`
- Fuchi-kashira: `https://www.yamasiroya.com/tousougu/020/post_3.html`

### Armor
- Helmet: `https://www.yamasiroya.com/yoroi/post.html`
