# Implementation Plan: nihonto.com.au Scraper

**Target Site:** https://nihonto.com.au
**Dealer Name:** Nihonto Australia (Samurai Gallery Australia)
**Location:** Cairns, QLD, Australia
**Currency:** AUD
**Platform:** WordPress + WooCommerce + Divi Theme
**Estimated Inventory:** ~450+ products

---

## Executive Summary

nihonto.com.au is a WordPress/WooCommerce-based dealer site with an accessible REST API. This significantly simplifies scraping compared to HTML-only sites. The implementation will use a **dual-extraction strategy**:

1. **WooCommerce Store API** for discovery and basic product data
2. **Individual page scraping + LLM extraction** for detailed specifications

This hybrid approach maximizes reliability while capturing the full depth of data needed for nihontowatch.

---

## Site Analysis

### Discovery Findings

| Finding | Details |
|---------|---------|
| **Platform** | WordPress 6.x with WooCommerce |
| **Theme** | Divi 4.27.5 |
| **REST API** | `/wp-json/wc/store/products` - ACCESSIBLE |
| **Pagination** | API supports `per_page` (max 100) and `page` params |
| **Categories** | Japanese Swords, Sword Fittings, Tsuba, Menuki, etc. |
| **Stock Status** | In Stock, On Hold, Reserved, Consigned |
| **Price Display** | Some show $0 in API (likely "Contact for Price") |

### Product Categories Structure

```
/product-category/
├── japanese-swords/
│   ├── swords-for-sale/
│   ├── consigned-items/
│   ├── katana/
│   ├── wakizashi/
│   ├── tanto/
│   └── polearms/
├── sword-fittings/
│   ├── tsuba/
│   ├── menuki/
│   ├── kozuka/
│   ├── fuchi-kashira/
│   └── other-fittings/
└── other/
    ├── armor/
    ├── hanging-scrolls/
    └── misc/
```

### API Response Structure

```json
{
  "id": 20721,
  "name": "Katchushi Tsuba",
  "permalink": "https://nihonto.com.au/product/katchushi-tsuba/",
  "short_description": "Iron Katchushi Tsuba with Sukashi Blossom Motif",
  "prices": {
    "price": "0",
    "currency_code": "AUD"
  },
  "categories": [{"name": "Tsuba", "slug": "tsuba"}],
  "tags": [{"name": "antique", "slug": "antique"}],
  "images": [
    {"src": "https://nihonto.com.au/wp-content/uploads/..."}
  ],
  "is_in_stock": true
}
```

### Data Available from API vs Page Scrape

| Field | API | Page Scrape | LLM Extract |
|-------|-----|-------------|-------------|
| Title | ✅ | ✅ | - |
| URL | ✅ | - | - |
| Price (AUD) | ⚠️ Sometimes $0 | ✅ | - |
| Images | ✅ | ✅ | - |
| Short Description | ✅ | ✅ | - |
| Categories | ✅ | ✅ | - |
| Tags | ✅ | ✅ | - |
| Stock Status | ✅ | ✅ | - |
| Full Description | ❌ | ✅ | ✅ |
| Measurements (nagasa, etc.) | ❌ | ⚠️ | ✅ |
| Smith/School Attribution | ❌ | ⚠️ | ✅ |
| Certification Details | ❌ | ⚠️ | ✅ |
| Era/Period | ❌ | ⚠️ | ✅ |
| Provenance | ❌ | ⚠️ | ✅ |

---

## Architecture Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIHONTO AUSTRALIA SCRAPER                    │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Discovery     │    │   Extraction    │                    │
│  │   (Crawler)     │    │   (Scraper)     │                    │
│  │                 │    │                 │                    │
│  │ WooCommerce API │───►│ 1. API Data     │                    │
│  │ /wp-json/wc/    │    │ 2. Page HTML    │                    │
│  │ store/products  │    │ 3. LLM Extract  │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Cross-Validation                      │   │
│  │                                                          │   │
│  │  API Data + HTML Data + LLM Extraction = Final Record   │   │
│  │                                                          │   │
│  │  Confidence scoring: If 2+ sources agree, high conf     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                        │
│                    │    Supabase      │                        │
│                    │    Database      │                        │
│                    └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure (in Oshi-scrapper)

```
Oshi-scrapper/
├── scrapers/
│   ├── discovery/
│   │   └── nihonto_au.py          # NEW: Catalog crawler (WooCommerce API)
│   └── dealers/
│       └── nihonto_au.py          # NEW: Product page scraper
├── prompts/
│   └── dealers/
│       └── nihonto_au.py          # NEW: Dealer-specific LLM hints
└── tests/
    └── scrapers/
        └── test_nihonto_au.py     # NEW: Unit tests
```

---

## Implementation Plan

### Phase 1: Discovery Crawler (WooCommerce API)

**File:** `scrapers/discovery/nihonto_au.py`

```python
class NihontoAuCrawler(BaseCatalogCrawler):
    """
    Catalog crawler for nihonto.com.au using WooCommerce Store API.

    Unlike HTML-based crawlers, this uses the REST API for reliable
    product discovery and basic metadata extraction.
    """

    DEALER_NAME = "Nihonto Australia"

    # WooCommerce Store API endpoints
    API_BASE = "https://nihonto.com.au/wp-json/wc/store/products"

    # Category slugs for filtering
    CATEGORY_MAP = {
        'katana': 'katana',
        'wakizashi': 'wakizashi',
        'tanto': 'tanto',
        'tsuba': 'tsuba',
        'menuki': 'menuki',
        'kozuka': 'kozuka',
        'fuchi-kashira': 'fuchi-kashira',
        'swords': 'japanese-swords',
        'fittings': 'sword-fittings',
        'all': None,  # No category filter
    }
```

**Key Methods:**

1. `crawl_api()` - Paginate through WooCommerce API
2. `_parse_api_product()` - Convert API response to `DiscoveredListing`
3. `_infer_item_type()` - Map WooCommerce categories to our `ItemType` enum
4. `_handle_pagination()` - Handle `per_page` and `page` params

**API Pagination Strategy:**
```python
def crawl_api(self, max_pages: int = 50) -> list[DiscoveredListing]:
    """Crawl WooCommerce API with pagination."""
    all_products = []
    page = 1
    per_page = 100  # Maximum allowed

    while page <= max_pages:
        url = f"{self.API_BASE}?per_page={per_page}&page={page}"
        response = self.http_client.get(url)

        if response.status_code != 200:
            break

        products = response.json()
        if not products:
            break  # No more pages

        all_products.extend(products)
        page += 1

    return [self._parse_api_product(p) for p in all_products]
```

---

### Phase 2: Product Page Scraper

**File:** `scrapers/dealers/nihonto_au.py`

```python
class NihontoAuScraper(BaseScraper):
    """
    Scraper for nihonto.com.au product pages.

    Uses a 3-tier extraction strategy:
    1. WooCommerce API data (if pre-fetched during discovery)
    2. HTML extraction (for prices, images, descriptions)
    3. LLM extraction (for specifications, attribution, certification)
    """

    DEALER_NAME = "Nihonto Australia"
    DOMAINS = ["nihonto.com.au", "www.nihonto.com.au"]
```

**Extraction Strategy:**

```python
def _extract_data(self, soup: BeautifulSoup, listing: ScrapedListing) -> None:
    """Extract data using multi-tier strategy."""

    # Tier 1: Try to get WooCommerce product ID from page
    product_id = self._get_product_id(soup)
    if product_id:
        api_data = self._fetch_api_data(product_id)
        self._apply_api_data(api_data, listing)

    # Tier 2: HTML extraction for visible data
    self._extract_from_html(soup, listing)

    # Tier 3: LLM extraction for complex fields
    # (Handled by generic LLM pipeline)
```

**HTML Selectors (WooCommerce/Divi):**

```python
# Price selectors
PRICE_SELECTORS = [
    '.woocommerce-Price-amount',
    '.price',
    '.product-price',
    'span.amount',
]

# Description selectors
DESCRIPTION_SELECTORS = [
    '.woocommerce-product-details__short-description',
    '.product-description',
    '.entry-content',
    '#tab-description',
]

# Image selectors
IMAGE_SELECTORS = [
    '.woocommerce-product-gallery__image img',
    '.product-images img',
    '.et_pb_image img',
]

# Stock status
STOCK_SELECTORS = [
    '.stock',
    '.in-stock',
    '.out-of-stock',
]
```

---

### Phase 3: LLM Prompt Engineering

**File:** `prompts/dealers/nihonto_au.py`

```python
from prompts.base import DealerPrompt, PromptVersion, create_prompt_version, load_base_prompt

VERSION = create_prompt_version(
    version="v1.0.0",
    description="Initial Nihonto Australia dealer prompt"
)

DEALER_HINTS = """
## Dealer: Nihonto Australia (nihonto.com.au)

### Site Characteristics
- Australian dealer located in Cairns, QLD
- Prices in AUD (Australian Dollars)
- Mix of swords and tosogu (sword fittings)
- Uses standard NBTHK/NTHK certification naming

### Price Extraction
- Prices are in AUD, NOT JPY
- Some items show "Contact for Price" or have $0 listed
- Look for "$X,XXX.XX AUD" pattern

### Stock Status Mapping
- "In Stock" = available
- "On Hold" = reserved (treat as not available)
- "Reserved" = reserved (treat as not available)
- "Consigned" = available but consigned item

### Certification Notes
- Uses standard NBTHK grades: Juyo, Tokubetsu Hozon, Hozon
- Uses NTHK grades as well
- May include Sayagaki by notable scholars

### Measurement Handling
- Measurements typically in centimeters (cm)
- Blade length = nagasa
- Curvature = sori
- Look for specifications in description text

### Common Item Types
**Swords:** Katana, Wakizashi, Tanto, Tachi, Daisho
**Tosogu:** Tsuba, Menuki, Kozuka, Kogai, Fuchi-Kashira

### Description Patterns
- Descriptions often include maker attribution
- May include historical context and provenance
- Certificate details usually listed prominently
"""

def get_prompt() -> DealerPrompt:
    """Get the Nihonto Australia dealer prompt."""
    return DealerPrompt(
        dealer_name="Nihonto Australia",
        version=VERSION,
        base_prompt=load_base_prompt(),
        dealer_hints=DEALER_HINTS,
    )
```

---

### Phase 4: Cross-Validation System

**Goal:** Maximize accuracy by comparing data from multiple sources.

```python
@dataclass
class ExtractionResult:
    """Result from a single extraction source."""
    source: str  # 'api', 'html', 'llm'
    field: str
    value: Any
    confidence: float  # 0.0 - 1.0

class CrossValidator:
    """
    Cross-validate extraction results from multiple sources.

    Agreement between sources increases confidence:
    - 3 sources agree: confidence = 1.0
    - 2 sources agree: confidence = 0.85
    - 1 source only: confidence = 0.6
    - Conflicting sources: flag for review
    """

    def validate(
        self,
        api_data: dict,
        html_data: dict,
        llm_data: dict,
    ) -> dict:
        """Cross-validate and merge extraction results."""

        merged = {}
        confidence_scores = {}
        conflicts = []

        for field in CORE_FIELDS:
            sources = []
            if field in api_data:
                sources.append(('api', api_data[field]))
            if field in html_data:
                sources.append(('html', html_data[field]))
            if field in llm_data:
                sources.append(('llm', llm_data[field]))

            if len(sources) == 0:
                continue
            elif len(sources) == 1:
                merged[field] = sources[0][1]
                confidence_scores[field] = 0.6
            else:
                # Check agreement
                values = [s[1] for s in sources]
                if self._values_agree(values, field):
                    merged[field] = values[0]
                    confidence_scores[field] = 0.85 + (0.05 * len(sources))
                else:
                    # Conflict - use priority: api > llm > html
                    merged[field] = self._resolve_conflict(sources, field)
                    conflicts.append(field)
                    confidence_scores[field] = 0.5

        return {
            'data': merged,
            'confidence': confidence_scores,
            'conflicts': conflicts,
        }
```

---

### Phase 5: Database Registration

**Add dealer to Supabase:**

```sql
INSERT INTO dealers (name, domain, catalog_url, is_active, country)
VALUES (
    'Nihonto Australia',
    'nihonto.com.au',
    'https://nihonto.com.au/product-category/japanese-swords/swords-for-sale/',
    true,
    'Australia'
);
```

**Register crawler in registry:**

```python
# scrapers/discovery/__init__.py
from .nihonto_au import NihontoAuCrawler

CRAWLERS = {
    ...
    "Nihonto Australia": NihontoAuCrawler,
}
```

---

### Phase 6: Testing Strategy

**Unit Tests:** `tests/scrapers/test_nihonto_au.py`

```python
import pytest
from scrapers.discovery.nihonto_au import NihontoAuCrawler
from scrapers.dealers.nihonto_au import NihontoAuScraper

class TestNihontoAuCrawler:
    """Tests for WooCommerce API crawler."""

    def test_parse_api_product(self):
        """Test parsing WooCommerce API response."""
        api_response = {
            "id": 20721,
            "name": "Katchushi Tsuba",
            "permalink": "https://nihonto.com.au/product/katchushi-tsuba/",
            "short_description": "Iron Katchushi Tsuba",
            "prices": {"price": "450", "currency_code": "AUD"},
            "categories": [{"name": "Tsuba", "slug": "tsuba"}],
            "is_in_stock": True,
        }

        crawler = NihontoAuCrawler()
        listing = crawler._parse_api_product(api_response)

        assert listing.url == "https://nihonto.com.au/product/katchushi-tsuba/"
        assert listing.title == "Katchushi Tsuba"
        assert listing.category == "Tsuba"

    def test_infer_item_type_katana(self):
        """Test item type inference from categories."""
        crawler = NihontoAuCrawler()

        categories = [{"name": "Katana", "slug": "katana"}]
        assert crawler._infer_item_type(categories) == ItemType.KATANA

    def test_infer_item_type_tsuba(self):
        """Test item type inference for tsuba."""
        crawler = NihontoAuCrawler()

        categories = [{"name": "Tsuba", "slug": "tsuba"}]
        assert crawler._infer_item_type(categories) == ItemType.TSUBA


class TestNihontoAuScraper:
    """Tests for product page scraper."""

    def test_extract_price_aud(self):
        """Test AUD price extraction."""
        scraper = NihontoAuScraper()

        html = '<span class="woocommerce-Price-amount">$2,500.00</span>'
        soup = BeautifulSoup(html, 'html.parser')

        price_value, currency = scraper._extract_price(soup)

        assert price_value == 2500.0
        assert currency == "AUD"

    def test_detect_sold_status(self):
        """Test sold/reserved detection."""
        scraper = NihontoAuScraper()

        # On hold
        html = '<p class="stock on-hold">On Hold</p>'
        soup = BeautifulSoup(html, 'html.parser')
        assert scraper._is_unavailable(soup) == True

        # In stock
        html = '<p class="stock in-stock">In Stock</p>'
        soup = BeautifulSoup(html, 'html.parser')
        assert scraper._is_unavailable(soup) == False
```

**Integration Tests:**

```python
@pytest.mark.integration
class TestNihontoAuIntegration:
    """Integration tests with live site (run manually)."""

    def test_api_connectivity(self):
        """Test WooCommerce API is accessible."""
        crawler = NihontoAuCrawler()
        response = crawler.http_client.get(
            "https://nihonto.com.au/wp-json/wc/store/products?per_page=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_full_crawl_sample(self):
        """Test full crawl of 1 page."""
        crawler = NihontoAuCrawler()
        result = crawler.crawl(max_pages=1)

        assert result.error is None
        assert result.total_found > 0
        assert all(l.url.startswith("https://nihonto.com.au/") for l in result.listings)
```

---

### Phase 7: Accuracy Validation

**Manual Validation Checklist:**

For a sample of 20 products (10 swords, 10 tosogu), manually verify:

| Field | Expected Source | Validation Method |
|-------|-----------------|-------------------|
| Title | API | Exact match |
| Price (AUD) | API/HTML | Within 1% or exact |
| Item Type | Derived from categories | Correct classification |
| Images | API | All images captured |
| Stock Status | API | Matches website |
| Nagasa (cm) | LLM from description | Manual check |
| Smith | LLM from description | Manual check |
| Certification | LLM from description | Exact match |
| Era/Period | LLM from description | Reasonable inference |

**Target Accuracy:**
- Core fields (title, price, images): > 99%
- Derived fields (item type): > 95%
- LLM-extracted fields: > 90%

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API rate limiting | Medium | High | Implement exponential backoff, 2s delay between requests |
| API endpoint changes | Low | High | Monitor for 4xx/5xx errors, alert on failures |
| Price shown as $0 | Known | Medium | Fall back to HTML extraction when API returns $0 |
| Complex descriptions | Medium | Medium | Robust LLM prompts with examples |
| Mixed content (scrolls, etc.) | Known | Low | Filter by categories, flag unknowns |

---

## Implementation Order

1. **Day 1: Discovery Crawler**
   - Implement `NihontoAuCrawler` class
   - Test API connectivity and pagination
   - Verify category mapping

2. **Day 2: Product Scraper**
   - Implement `NihontoAuScraper` class
   - HTML extraction for prices, images
   - Stock status detection

3. **Day 3: LLM Integration**
   - Create `prompts/dealers/nihonto_au.py`
   - Test extraction on sample products
   - Tune prompts for accuracy

4. **Day 4: Cross-Validation**
   - Implement `CrossValidator` class
   - Test with conflicting data scenarios
   - Define confidence thresholds

5. **Day 5: Testing & Registration**
   - Write unit tests
   - Run integration tests
   - Register dealer in database
   - Initial discovery run

6. **Day 6: Validation & Tuning**
   - Manual validation of 20 products
   - Fix any extraction issues
   - Final accuracy assessment

---

## Success Criteria

- [ ] Discovery crawler finds > 400 products
- [ ] All swords/tosogu correctly classified by item type
- [ ] Prices extracted correctly (or flagged as "Contact for Price")
- [ ] All product images captured
- [ ] > 90% accuracy on LLM-extracted fields
- [ ] Zero critical errors in 7-day monitoring period
- [ ] Crawler runs successfully in daily job

---

## Appendix: Sample Product Data

### Sword Example

**Title:** Kunikiyo Katana made from Nanbantetsu with Futatsudo (Double Gold Test) Tokubetsu Hozon Certificate
**URL:** https://nihonto.com.au/product/kunikiyo-katana-made-from-nambantetsu-with-futatsudo-double-gold-test-tokubetsu-hozon-certificate/
**Price:** Contact for Price
**Categories:** Japanese Swords, Swords For Sale, Important swords
**Certification:** Tokubetsu Hozon (NBTHK)
**Smith:** Kunikiyo
**Features:** Nanbantetsu (foreign steel), Futatsudo (double cutting test)

### Tosogu Example

**Title:** Late Jingo School Dragon Katana Tsuba with NBTHK Hozon Certificate
**URL:** https://nihonto.com.au/product/late-jingo-school-dragon-tsuba/
**Price:** Contact for Price
**Categories:** Tsuba
**Certification:** Hozon (NBTHK)
**School:** Jingo
**Motif:** Dragon

---

## Monitoring & Maintenance

After initial deployment:

1. **Daily Health Check**
   - Verify API accessibility
   - Check for new products (delta vs previous day)
   - Monitor error rates

2. **Weekly Review**
   - Accuracy spot-check on 5 random products
   - Review any flagged conflicts
   - Update prompts if needed

3. **Monthly Assessment**
   - Full accuracy audit
   - Performance metrics
   - Dealer inventory trends
