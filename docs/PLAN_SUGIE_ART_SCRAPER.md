# Sugie Art Scraper Implementation Plan

## Executive Summary

This plan details the implementation of a robust, production-grade scraper for **Sugie Art** (sugieart.com), a Japanese fine art and antique dealer with nihonto (swords and tosogu) inventory.

**Key Discovery:** Despite using Wix/Thunderbolt framework, **standard HTTP requests work** because Wix pre-renders product data in meta tags and JSON-LD for SEO. This is the same approach used successfully for **Choshuya** (another Wix dealer).

**NO Playwright required** - simple BeautifulSoup extraction from:
- `og:` meta tags (title, description, image, availability)
- `product:price:amount` / `product:price:currency` meta tags
- JSON-LD structured data (schema.org/Product)
- Sitemap for discovery

---

## Site Analysis

### Domain Information
| Field | Value |
|-------|-------|
| **Domain** | www.sugieart.com |
| **Platform** | Wix (Thunderbolt framework v1.16803.0) |
| **Language** | Japanese (ja) |
| **Rendering** | Client-side JavaScript (requires headless browser) |

### URL Patterns

**Category/Catalog Pages:**
```
/swords          - Main swords page
/swords-1        - Additional swords page (possibly pagination)
/tsuba-etc       - Tosogu (sword fittings)
/netsuke         - Netsuke (NOT nihonto - filter out)
/fine-arts       - Fine arts (NOT nihonto - filter out)
/antiques        - Antiques (mixed - needs filtering)
/paintings-calligraphy - Paintings (NOT nihonto - filter out)
```

**Product Pages:**
```
/product-page/[Japanese-Item-Name]

Examples:
/product-page/銘-肥前唐津正国-牡丹に蝶図透鐔     (Tsuba)
/product-page/額銘-波平宗行-網屋拵付脇指          (Wakizashi)
/product-page/銘-越前国住兼植                    (Sword)
/product-page/銘-法橋一乗門-一勝-花押-明烏図小柄  (Kozuka)
```

### Sitemap Structure
- **Index:** `/sitemap.xml`
- **Products:** `/store-products-sitemap.xml` (67+ items as of 2026-01-30)
- **Pages:** `/pages-sitemap.xml` (12 pages)

### Nihonto-Relevant Categories
Based on sitemap analysis, relevant items include:
- **Swords:** Items with 刀 (katana), 脇指 (wakizashi), 太刀 (tachi) in titles
- **Tsuba:** Items with 鐔 or 透鐔 in titles
- **Kozuka:** Items with 小柄 in titles
- **Inro:** Items with 印籠 in titles (technically NOT nihonto, but often collected alongside)

### Non-Nihonto Items to Filter
- Ceramics (茶碗, 花入, 壺, etc.)
- Paintings (筆, 画, 幅)
- Lacquerware (蒔絵 without 印籠)
- Calligraphy
- General antiques

---

## Architecture Design

### Simple HTTP-Based Approach (Like Choshuya)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUGIE ART SCRAPER                            │
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │ SugieArtCrawler  │     │ SugieArtScraper  │                 │
│  │ (Discovery)      │     │ (Detail)         │                 │
│  │ - Sitemap XML    │     │ - og: meta tags  │                 │
│  │ - Store products │     │ - JSON-LD        │                 │
│  └────────┬─────────┘     │ - product:price  │                 │
│           │               └────────┬─────────┘                 │
│           └───────────┬────────────┘                            │
│                       │                                         │
│           ┌───────────▼───────────┐                            │
│           │   Standard HTTP       │  ← NO Playwright!          │
│           │   + BeautifulSoup     │                            │
│           └───────────┬───────────┘                            │
│                       │                                         │
│           ┌───────────▼───────────┐                            │
│           │   LLM Extraction      │  ← For description parsing │
│           │   (from og:desc)      │                            │
│           └───────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure (Minimal - Follows Existing Patterns)

```
Oshi-scrapper/
├── scrapers/
│   ├── sugie_art.py              # Detail scraper (like choshuya.py)
│   └── discovery/
│       └── sugie_art.py          # Sitemap-based crawler
└── tests/
    └── scrapers/
        └── test_sugie_art.py
```

**No dedicated module needed** - follows same pattern as Choshuya.

---

---

## Data Extraction (Verified via curl)

### Available Data Sources

Wix pre-renders ALL product data for SEO. Example from tsuba page:

**1. JSON-LD Structured Data (Primary Source)**
```json
{
  "@type": "Product",
  "name": "(銘)肥前唐津正国　牡丹に蝶図透鐔",
  "description": "縦×横×厚さ:7.1cm×6.9cm×0.5cm ... Paper: Tokubetsu Hozon (NBTHK)",
  "image": [
    {"contentUrl": "https://static.wixstatic.com/media/26ef6d_078c7fde..."},
    {"contentUrl": "https://static.wixstatic.com/media/26ef6d_4a4f99..."},
    // ... 5 images total
  ],
  "Offers": {
    "price": "168000",
    "priceCurrency": "JPY",
    "Availability": "https://schema.org/InStock"
  }
}
```

**2. Meta Tags (Backup/Validation)**
```html
<meta property="og:title" content="(銘)肥前唐津正国　牡丹に蝶図透鐔 | Sugie Art"/>
<meta property="og:description" content="Full bilingual description..."/>
<meta property="og:image" content="https://static.wixstatic.com/media/..."/>
<meta property="og:availability" content="InStock"/>
<meta property="product:price:amount" content="168000"/>
<meta property="product:price:currency" content="JPY"/>
```

### Extraction Strategy

```python
def _extract_from_wix_meta(self, soup: BeautifulSoup, listing: ScrapedListing) -> bool:
    """Extract data from Wix meta tags and JSON-LD. Returns True if successful."""

    # 1. Try JSON-LD first (most complete)
    json_ld = self._extract_json_ld(soup)
    if json_ld:
        listing.title = json_ld.get('name')
        listing.description = json_ld.get('description')

        # Images from JSON-LD
        images = json_ld.get('image', [])
        listing.images = [img['contentUrl'] for img in images if 'contentUrl' in img]

        # Price from Offers
        offers = json_ld.get('Offers', {})
        if offers.get('price'):
            listing.price_value = float(offers['price'])
            listing.price_currency = offers.get('priceCurrency', 'JPY')

        # Availability
        if 'InStock' in str(offers.get('Availability', '')):
            listing.is_available = True
            listing.is_sold = False
        return True

    # 2. Fallback to og: meta tags (like Choshuya)
    og_title = soup.find('meta', property='og:title')
    og_desc = soup.find('meta', property='og:description')
    og_image = soup.find('meta', property='og:image')
    price_amount = soup.find('meta', property='product:price:amount')
    price_currency = soup.find('meta', property='product:price:currency')
    availability = soup.find('meta', property='og:availability')

    if og_title:
        # Strip site suffix: "Title | Sugie Art" → "Title"
        listing.title = og_title['content'].split(' | ')[0].strip()

    if og_desc:
        listing.description = og_desc['content']

    if og_image:
        listing.images = [og_image['content']]
        # Find more images from wixstatic URLs
        self._extract_wix_images(soup, listing)

    if price_amount:
        listing.price_value = float(price_amount['content'])
        listing.price_currency = price_currency['content'] if price_currency else 'JPY'

    if availability:
        listing.is_available = availability['content'] == 'InStock'
        listing.is_sold = availability['content'] != 'InStock'

    return bool(og_title)
```

---

## Implementation Phases

### Phase 1: Detail Scraper (Day 1)

#### 1.1 Core Scraper (Based on Choshuya Pattern)

```python
# scrapers/sugie_art.py

@ScraperRegistry.register
class SugieArtScraper(BaseScraper):
    """Scraper for Sugie Art dealer website.

    Uses Wix meta tags and JSON-LD for extraction (no Playwright needed).
    Same approach as Choshuya's Wix pages.
    """

    DEALER_NAME = "Sugie Art"
    DOMAINS = ["sugieart.com", "www.sugieart.com"]

    # Nihonto-relevant keywords for filtering
    NIHONTO_KEYWORDS = ['刀', '太刀', '脇指', '短刀', '鐔', '透鐔', '小柄', '目貫', '縁頭']

    def _extract_data(self, soup: BeautifulSoup, listing: ScrapedListing, images_only: bool = False) -> None:
        """Extract listing data from Sugie Art page using meta tags."""

        # All Sugie Art pages are Wix - use meta tag extraction
        if self._extract_from_wix_meta(soup, listing):
            listing.page_exists = True

            # Parse dimensions from description
            if listing.description:
                self._extract_specs_from_description(listing)

            # Detect item type
            listing.item_type = self._detect_item_type(listing.title, listing.url)
            listing.sync_category()

    def _extract_json_ld(self, soup: BeautifulSoup) -> Optional[dict]:
        """Extract JSON-LD Product data."""
        script = soup.find('script', type='application/ld+json')
        if script:
            try:
                data = json.loads(script.string)
                if data.get('@type') == 'Product':
                    return data
            except json.JSONDecodeError:
                pass
        return None

    def _extract_specs_from_description(self, listing: ScrapedListing) -> None:
        """Parse specs from og:description text."""
        desc = listing.description or ''

        # Tosogu dimensions: "縦×横×厚さ:7.1cm×6.9cm×0.5cm"
        tosogu_match = re.search(r'縦×横×厚さ[:：]\s*([\d.]+)cm×([\d.]+)cm×([\d.]+)cm', desc)
        if tosogu_match:
            listing.tosogu_specs = TosoguSpecs(
                height_cm=float(tosogu_match.group(1)),
                width_cm=float(tosogu_match.group(2)),
                thickness_mm=float(tosogu_match.group(3)) * 10,  # cm to mm
            )
            return

        # Sword length: "Length: About 54 cm" or "刃長:XX.Xcm"
        nagasa_match = re.search(r'(?:Length|刃長)[:\s]*(?:About\s*)?([\d.]+)\s*cm', desc, re.I)
        if nagasa_match:
            listing.specs = SwordSpecs(nagasa_cm=float(nagasa_match.group(1)))
```

### Phase 2: Discovery Crawler (Day 1-2)

#### 2.1 Sitemap-Based Discovery (Primary Method)

```python
class SugieArtCrawler(BaseCatalogCrawler):
    DEALER_NAME = "Sugie Art"

    # Primary discovery: sitemap
    SITEMAP_URL = "https://www.sugieart.com/store-products-sitemap.xml"

    # Backup: category pages
    CATALOG_URLS = [
        "https://www.sugieart.com/swords",
        "https://www.sugieart.com/swords-1",
        "https://www.sugieart.com/tsuba-etc",
    ]

    # Item type filtering keywords
    NIHONTO_KEYWORDS = [
        '刀', '太刀', '脇指', '短刀', '鐔', '透鐔',
        '小柄', '目貫', '縁頭', '鍔', '笄', '拵',
        'katana', 'wakizashi', 'tanto', 'tsuba', 'kozuka',
    ]

    NON_NIHONTO_KEYWORDS = [
        '茶碗', '花入', '壺', '皿', '香炉', '茶器',
        '筆', '画', '幅', '書', '掛軸',
        '焼', '陶', '磁器', '瀬戸', '備前', '志野',
    ]
```

#### 2.2 Nihonto Item Filter

```python
# sugie_art/utils/item_filter.py

class NihontoItemFilter:
    """Classify items as nihonto-relevant or not."""

    def is_nihonto_item(self, title: str, url: str) -> tuple[bool, str]:
        """
        Returns (is_nihonto, reason)

        Logic:
        1. Check for explicit nihonto keywords → include
        2. Check for explicit non-nihonto keywords → exclude
        3. Check URL path for category hints
        4. Default: exclude (safer than including non-nihonto)
        """
        title_lower = title.lower()

        # Priority 1: Explicit nihonto indicators
        for keyword in self.NIHONTO_KEYWORDS:
            if keyword in title:
                return True, f"Contains nihonto keyword: {keyword}"

        # Priority 2: Explicit non-nihonto indicators
        for keyword in self.NON_NIHONTO_KEYWORDS:
            if keyword in title:
                return False, f"Contains non-nihonto keyword: {keyword}"

        # Priority 3: URL category hints
        if '/swords' in url or '/tsuba' in url:
            return True, "URL indicates sword/tsuba category"

        # Default: exclude
        return False, "No nihonto indicators found"
```

### Phase 3: LLM Enhancement (Day 2)

Since `og:description` contains rich bilingual text with specs, certification, and attribution,
we can use LLM extraction to parse structured data from the description.

```python
def _extract_data(self, soup: BeautifulSoup, listing: ScrapedListing, images_only: bool = False) -> None:
    """Extract listing data - use meta tags + LLM for description parsing."""

    # Extract from meta tags first
    if not self._extract_from_wix_meta(soup, listing):
        return

    # If LLM enabled, parse description for detailed extraction
    if self.use_llm and listing.description:
        try:
            # LLM extraction from description text
            self._extract_with_llm(listing.description.encode('utf-8'), listing)
            listing.llm_model = self.llm_model
            listing.llm_extracted_at = datetime.now()
        except Exception as e:
            logger.warning(f"LLM extraction failed: {e}")
            # Fallback to regex parsing
            self._extract_specs_from_description(listing)
    else:
        self._extract_specs_from_description(listing)

    # Detect item type from title
    listing.item_type = self._detect_item_type(listing.title, listing.url)
    listing.sync_category()
```

### Phase 4: Cross-Validation System (Day 2-3)

#### 4.1 Multi-Method Extraction

```python
def extract_with_validation(self, soup: BeautifulSoup, url: str) -> tuple[ScrapedListing, dict]:
    """
    Extract using multiple methods and cross-validate.

    Methods:
    1. JSON-LD structured data (most reliable for Wix)
    2. og: meta tags (backup)
    3. LLM extraction from description (for specs/attribution)

    Cross-validation:
    - Compare price from JSON-LD vs product:price meta
    - Compare title from JSON-LD vs og:title
    - Flag disagreements for review
    """
    results = {}

    # Method 1: JSON-LD
    results['json_ld'] = self._extract_json_ld(soup)

    # Method 2: Meta tags
    results['meta'] = self._extract_from_meta_tags(soup)

    # Method 3: LLM from description (if available)
    desc = results.get('json_ld', {}).get('description') or results.get('meta', {}).get('description')
    if desc:
        results['llm'] = self._extract_with_llm_from_text(desc, url)

    # Cross-validate
    validation = {
        'price_match': results.get('json_ld', {}).get('price') == results.get('meta', {}).get('price'),
        'title_match': self._normalize_title(results.get('json_ld', {}).get('title', '')) ==
                       self._normalize_title(results.get('meta', {}).get('title', '')),
    }

    # Merge (prefer JSON-LD, fill gaps from meta)
    merged = self._merge_results(results)

    return merged, validation
```

#### 4.2 Validation Report

```python
@dataclass
class ValidationReport:
    """Track extraction method agreement/disagreement."""

    url: str
    extraction_timestamp: datetime

    # Field-level agreement
    field_agreements: dict[str, bool]  # field -> all methods agree
    field_conflicts: dict[str, list[dict]]  # field -> conflicting values

    # Method confidence scores
    css_confidence: float  # 0-1, based on selector matches
    llm_confidence: float  # 0-1, from LLM response
    structured_confidence: float  # 0-1, based on data completeness

    # Resolution
    resolution_method: str  # 'consensus', 'highest_confidence', 'manual'
    flagged_for_review: bool

    def to_dict(self) -> dict:
        """Serialize for storage and analysis."""
        pass
```

### Phase 5: LLM Prompt Engineering (Day 4)

#### 5.1 Sugie Art-Specific Prompt

```python
SUGIE_ART_EXTRACTION_PROMPT = """
You are extracting data from a Japanese sword (nihonto) and sword fitting (tosogu)
dealer website: Sugie Art (sugieart.com).

IMPORTANT CONTEXT:
- This is a high-end Japanese antique dealer
- Items may include swords, tsuba, kozuka, menuki, and other sword fittings
- Prices are typically in JPY (Japanese Yen)
- Descriptions are usually in Japanese
- Signatures (mei) use historical Japanese naming conventions

EXTRACT THE FOLLOWING (return null if not found):

1. TITLE: Product title (Japanese is fine)
2. PRICE:
   - price_value: Numeric value only
   - price_currency: Usually "JPY"
3. AVAILABILITY:
   - is_sold: true if marked as sold/SOLD OUT/売約済み/完売
   - is_available: true if available for purchase
4. ITEM_TYPE: One of [katana, wakizashi, tanto, tachi, tsuba, kozuka, menuki,
                       kogai, fuchi, kashira, fuchi_kashira, koshirae, inro]
5. ATTRIBUTION (for swords):
   - smith: Swordsmith name (e.g., "波平宗行")
   - school: Sword school (e.g., "薩摩")
   - province: Province (e.g., "肥前")
   - era: Period (e.g., "江戸時代")
   - mei_type: [signed, unsigned, attributed]
6. ATTRIBUTION (for tosogu):
   - maker: Maker name (e.g., "正阿弥")
   - school: School (e.g., "平安城")
7. MEASUREMENTS:
   - For swords: nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm
   - For tosogu: height_cm, width_cm, thickness_mm
8. CERTIFICATION: NBTHK paper type if mentioned (Juyo, Tokubetsu Juyo, Hozon, etc.)
9. DESCRIPTION: Full product description (Japanese is fine)

PAGE TEXT:
{page_text}

URL: {url}

Return JSON only, no markdown.
"""
```

### Phase 6: Testing & Calibration (Day 5)

#### 6.1 Test Suite

```python
# tests/sugie_art/test_scraper.py

class TestSugieArtScraper:
    """Scraper tests with real URLs."""

    # Sample URLs from sitemap
    SAMPLE_URLS = [
        # Tsuba
        "https://www.sugieart.com/product-page/銘-肥前唐津正国-牡丹に蝶図透鐔",
        "https://www.sugieart.com/product-page/銘-西垣勘平-作-七十一歳-桃樹臥牛透鐔",
        # Sword
        "https://www.sugieart.com/product-page/額銘-波平宗行-網屋拵付脇指",
        "https://www.sugieart.com/product-page/銘-越前国住兼植",
        # Kozuka
        "https://www.sugieart.com/product-page/銘-法橋一乗門-一勝-花押-明烏図小柄",
    ]

    @pytest.mark.asyncio
    async def test_extraction_accuracy(self):
        """Test extraction against known values."""
        pass

    @pytest.mark.asyncio
    async def test_cross_validation_agreement(self):
        """Verify multiple extraction methods agree."""
        pass
```

#### 6.2 Manual Verification Checklist

For each test URL, verify:
- [ ] Title matches visible title on page
- [ ] Price matches displayed price (if shown)
- [ ] Sold status accurate
- [ ] Item type correctly classified
- [ ] Signature/attribution parsed correctly
- [ ] Measurements extracted accurately
- [ ] Images captured (check count and quality)

---

## Cross-Validation Protocol

### Step 1: CSS Selector Discovery

```bash
# Run in browser console on a product page:
document.querySelectorAll('[data-hook]').forEach(el =>
    console.log(el.getAttribute('data-hook'), el.textContent?.slice(0,100))
);
```

### Step 2: Compare Extraction Methods

| Field | CSS Result | LLM Result | Structured | Consensus | Notes |
|-------|------------|------------|------------|-----------|-------|
| title | | | | | |
| price_value | | | | | |
| is_sold | | | | | |
| item_type | | | | | |
| smith | | | | | |
| nagasa_cm | | | | | |

### Step 3: Resolve Discrepancies

1. **CSS vs LLM disagree:**
   - Check raw HTML for CSS target
   - Verify LLM understood context
   - Update selector or prompt as needed

2. **Price extraction issues:**
   - Check for hidden price elements
   - Verify currency detection
   - Handle "Price on request" scenarios

3. **Sold status false positives:**
   - Ensure "SOLD" keywords aren't in description
   - Check for Wix-specific sold indicators
   - Add negative patterns

---

## Error Handling & Edge Cases

### 1. Missing Meta Tags

```python
def _extract_from_wix_meta(self, soup: BeautifulSoup, listing: ScrapedListing) -> bool:
    """Extract data from Wix meta tags. Returns True if successful."""

    # Try JSON-LD first (most reliable)
    json_ld = self._extract_json_ld(soup)
    if json_ld:
        return self._parse_json_ld(json_ld, listing)

    # Fallback to og: meta tags
    og_title = soup.find('meta', property='og:title')
    if not og_title:
        logger.warning(f"No og:title found for {listing.url}")
        return False

    # ... rest of extraction
    return True
```

### 2. Japanese URL Encoding

```python
def normalize_url(self, url: str) -> str:
    """Handle Japanese characters in URLs."""
    from urllib.parse import quote, unquote, urlparse, urlunparse

    parsed = urlparse(url)
    # Wix stores Japanese characters directly, but we need to handle
    # both encoded and unencoded forms
    path = unquote(parsed.path)  # Decode first
    path = quote(path, safe='/:-_')  # Re-encode properly

    return urlunparse(parsed._replace(path=path))
```

### 3. Price Not Available

```python
def _extract_price(self, soup: BeautifulSoup, listing: ScrapedListing) -> None:
    """Extract price from multiple sources."""
    # Try product:price meta tag first
    price_meta = soup.find('meta', property='product:price:amount')
    if price_meta:
        listing.price_value = float(price_meta['content'])
        listing.price_currency = 'JPY'
        return

    # Try JSON-LD Offers
    json_ld = self._extract_json_ld(soup)
    if json_ld and 'Offers' in json_ld:
        offers = json_ld['Offers']
        if offers.get('price'):
            listing.price_value = float(offers['price'])
            listing.price_currency = offers.get('priceCurrency', 'JPY')
            return

    # No price found - inquiry-based
    logger.info(f"No price found for {listing.url} - likely inquiry-based")
```

---

## Performance Considerations

### 1. Rate Limiting

```python
# Standard rate limiting (no Playwright = much faster)
class SugieArtScraper(BaseScraper):
    RATE_LIMIT = 1.0  # 1 request per second (conservative)
```

### 2. HTTP-Only = Low Resource Usage

No browser process = minimal memory/CPU:
- Standard requests library
- BeautifulSoup parsing
- Much faster than Playwright approach

### 3. Caching Sitemap

```python
# Cache sitemap for 24 hours to reduce requests
SITEMAP_CACHE_TTL = 86400  # seconds
```

---

## Integration with Oshi-scrapper

### 1. Register with ScraperRegistry

```python
# scrapers/registry.py - auto-registration via decorator
@ScraperRegistry.register
class SugieArtScraper(BaseScraper):
    ...
```

### 2. Add to Dealer List

```python
# Update dealers table in Supabase
INSERT INTO dealers (name, domain, catalog_url, is_active, country)
VALUES (
    'Sugie Art',
    'sugieart.com',
    'https://www.sugieart.com/swords',
    true,
    'Japan'
);
```

### 3. Discovery Job Configuration

```yaml
# discovery jobs config
sugie_art:
  enabled: true
  schedule: "0 8 * * *"  # Daily at 8am JST
  method: sitemap
  sitemap_url: https://www.sugieart.com/store-products-sitemap.xml
  filter: nihonto_only
```

---

## Monitoring & Alerting

### 1. Extraction Quality Metrics

```python
# Track in monitoring dashboard
METRICS = [
    'sugie_art.scrape.success_rate',
    'sugie_art.scrape.css_extraction_rate',
    'sugie_art.scrape.llm_extraction_rate',
    'sugie_art.scrape.cross_validation_agreement_rate',
    'sugie_art.scrape.avg_extraction_time_ms',
]
```

### 2. Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Success rate | < 90% | < 80% |
| Cross-validation agreement | < 85% | < 70% |
| Extraction time | > 30s | > 60s |
| New items/day | = 0 for 3 days | = 0 for 7 days |

---

## Timeline (Simplified - No Playwright)

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Detail Scraper (meta tags + JSON-LD) | Day 1 |
| 2 | Discovery Crawler (sitemap) | Day 1 |
| 3 | LLM Enhancement for description parsing | Day 2 |
| 4 | Cross-Validation & Testing | Day 2-3 |
| 5 | Integration & Deployment | Day 3 |

**Total: 3 days** (vs 6 days with Playwright approach)

---

## Success Criteria

1. **Accuracy:** >95% field extraction accuracy on test set
2. **Reliability:** >95% success rate on valid URLs
3. **Coverage:** All nihonto items from sitemap discovered
4. **Performance:** <2s average extraction time per listing (HTTP-only = fast!)
5. **Cross-validation:** >90% agreement between JSON-LD and meta tags

---

## Open Questions (Answered via Analysis)

1. **Price visibility:** ✅ Prices shown in `product:price:amount` meta tag (example: ¥168,000)
2. **Sold indication:** ✅ `og:availability` meta tag shows "InStock" vs "OutOfStock"
3. **Inventory churn:** 67 items in sitemap as of 2026-01-30, moderate size
4. **Non-nihonto handling:** Filter using `NIHONTO_KEYWORDS` - exclude ceramics/paintings/calligraphy

---

## Appendix: Sample URLs from Sitemap

### Nihonto Items (High Confidence)

| URL | Item Type | Confidence |
|-----|-----------|------------|
| `/product-page/銘-肥前唐津正国-牡丹に蝶図透鐔` | Tsuba | High |
| `/product-page/額銘-波平宗行-網屋拵付脇指` | Wakizashi | High |
| `/product-page/銘-越前国住兼植` | Sword | High |
| `/product-page/銘-周防国住永弘-丙寅陽月吉辰` | Sword | High |
| `/product-page/銘-法橋一乗門-一勝-花押-明烏図小柄` | Kozuka | High |
| `/product-page/銘-西垣勘平-作-七十一歳-桃樹臥牛透鐔` | Tsuba | High |
| `/product-page/銘-平安城竹斎-金唐草図鐔` | Tsuba | High |
| `/product-page/銘-武州住正次-襷透四方紋散図鐔` | Tsuba | High |
| `/product-page/出羽秋田住正阿弥伝七作-流水透鐔` | Tsuba | High |
| `/product-page/銘-八代甚吾作-三代-宝尽図鐔` | Tsuba | High |
| `/product-page/銘-次郎太郎直勝-天保六年乙未秋八月日` | Sword | High |

### Mixed/Uncertain Items

| URL | Analysis |
|-----|----------|
| `/product-page/梶川作-太鼓図印籠` | Inro by Kajikawa - include? |
| `/product-page/銘-梶川作-花押-孔雀図蒔絵印籠` | Inro - include? |

### Non-Nihonto Items (Exclude)

| URL | Reason |
|-----|--------|
| `/product-page/川合玉堂-筆-高原帰牧` | Painting |
| `/product-page/金重陶陽-作-備前平茶碗` | Bizen ceramic |
| `/product-page/浜田庄司-作-地掛緑黒茶碗` | Ceramic tea bowl |
| `/product-page/勝海舟-二行書` | Calligraphy |
