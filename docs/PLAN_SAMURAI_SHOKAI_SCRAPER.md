# Samurai Shokai Scraper Implementation Plan

**Target:** https://www.samuraishokai.jp
**Dealer Type:** Japanese Dealer
**Status:** Planning Phase
**Date:** 2026-02-02

---

## 1. Site Analysis Summary

### Overview
Samurai Shokai is a traditional Japanese sword dealer with a bilingual (Japanese/English) static HTML website. The site has a simple structure with no JavaScript frameworks or dynamic content loading.

### Site Structure
```
samuraishokai.jp/
├── index.html              # Homepage with "What's New" feed
├── sword/
│   ├── index.html          # Sword catalog (all swords by category)
│   └── [ID].html           # Individual sword pages
└── equipment/
    ├── index.html          # Tosogu catalog (all fittings by category)
    ├── ts[ID].html         # Tsuba pages
    ├── fc[ID].html         # Fuchi/Kashira pages
    ├── mk[ID].html         # Menuki pages
    ├── j[ID].html          # Antique firearms
    └── [other prefixes]    # Kozuka, kogai, koshirae, etc.
```

### URL Patterns

| Item Type | URL Pattern | Example |
|-----------|-------------|---------|
| Sword (all types) | `/sword/[5-digit].html` | `/sword/26104.html` |
| Tsuba | `/equipment/ts[5-digit].html` | `/equipment/ts25001.html` |
| Fuchi/Kashira | `/equipment/fc[5-digit].html` | `/equipment/fc24001.html` |
| Menuki | `/equipment/mk[3-digit].html` | `/equipment/mk005.html` |
| Antique Firearms | `/equipment/j[5-digit].html` | `/equipment/j17001.html` |

### Data Available on Listing Pages

**Always Present:**
- Title (Japanese + English)
- Item number (No-sw26104, No-ts25001, etc.)
- Price in JPY (e.g., "1,050,000円(JPY)")
- Images (multiple JPGs in `/sy_sword/[ID]/` or `/sy_equip/[ID]/`)

**Sword-Specific:**
- Blade length (刃長/Blade length): cm + traditional units
- Curvature (反り/Curvature): cm + traditional units
- Base width (元幅/Motohaba): cm
- Tip width (先幅/Sakihaba): cm
- Thickness (元重/Kasane): cm
- Era/Period (時代/Period)
- Smith attribution
- Province/origin
- Certification (NBTHK: Juyo, Tokubetsu Hozon, Hozon, etc.)

**Tosogu-Specific:**
- Height (縦/Height): cm
- Width (横/Width): cm
- Thickness (耳厚/Rim thickness): mm
- Period/Era
- School/maker (if known)
- Material (iron, shakudo, etc.)
- Technique (sukashi, inlay, etc.)

### Sold/Reserved Indicators

| Japanese | English | Status |
|----------|---------|--------|
| 販売済 | SOLD | Sold |
| ご予約済 | HOLD | Reserved (temporary) |

### Image Structure

**Swords:**
- Directory: `/sy_sword/sw[ID]/`
- Thumbnails: `tg.gif`
- Full size: `750.jpg`, `kt.jpg`, `ks.jpg`, `hb.jpg`, etc.

**Equipment:**
- Directory: `/sy_equip/[prefix][ID]/`
- Similar structure with multiple angle shots

---

## 2. Implementation Components

### 2.1 Scraper Class: `SamuraiShokaiScraper`

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/samurai_shokai.py`

**Key Features:**
- Handles both swords (`/sword/`) and tosogu (`/equipment/`)
- Static HTML parsing (no JavaScript needed)
- Bilingual text extraction (Japanese primary, English fallback)
- Robust spec extraction with regex patterns

**Class Structure:**
```python
@ScraperRegistry.register
class SamuraiShokaiScraper(BaseScraper):
    DEALER_NAME = "Samurai Shokai"
    DOMAINS = ["samuraishokai.jp", "www.samuraishokai.jp"]

    # Item type mappings
    SWORD_TYPES = {
        '刀': ItemType.KATANA,
        '太刀': ItemType.TACHI,
        '脇差': ItemType.WAKIZASHI,
        '短刀': ItemType.TANTO,
        '槍': ItemType.YARI,
        '薙刀': ItemType.NAGINATA,
        '剣': ItemType.KEN,
    }

    TOSOGU_PREFIXES = {
        'ts': ItemType.TSUBA,
        'fc': ItemType.FUCHI_KASHIRA,
        'mk': ItemType.MENUKI,
        'kz': ItemType.KOZUKA,
        'kg': ItemType.KOGAI,
    }

    # Certification patterns (ordered by specificity - longest first)
    CERT_PATTERNS = [
        ('特別重要刀剣', 'Tokubetsu Juyo Token'),
        ('特別重要刀装具', 'Tokubetsu Juyo Tosogu'),
        ('重要刀剣', 'Juyo Token'),
        ('重要刀装具', 'Juyo Tosogu'),
        ('特別保存刀剣', 'Tokubetsu Hozon Token'),
        ('特別保存刀装具', 'Tokubetsu Hozon Tosogu'),
        ('保存刀剣', 'Hozon Token'),
        ('保存刀装具', 'Hozon Tosogu'),
    ]

    # Sold/reserved patterns
    SOLD_PATTERNS = ['販売済', 'SOLD']
    RESERVED_PATTERNS = ['ご予約済', 'HOLD', '商談中']
```

### 2.2 Catalog Crawler: `SamuraiShokaiCrawler`

**File:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/discovery/samurai_shokai.py`

**Catalog URLs:**
```python
CATALOG_URLS = [
    "https://www.samuraishokai.jp/sword/index.html",      # All swords
    "https://www.samuraishokai.jp/equipment/index.html",  # All tosogu
]
```

**Extraction Strategy:**
- No pagination (all items on single page per category)
- Extract all `<a href="*.html">` links within listing containers
- Filter for valid item URL patterns
- Extract thumbnail price/title for lightweight discovery

---

## 3. Detailed Implementation Steps

### Step 1: Create Base Scraper File

**File:** `scrapers/samurai_shokai.py`

```python
"""
Samurai Shokai (samuraishokai.jp) scraper.

Japanese dealer with bilingual site. Handles swords and tosogu.
Static HTML, no JavaScript required.
"""

import re
from typing import Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from scrapers.base import BaseScraper
from scrapers.registry import ScraperRegistry
from models.listing import (
    ScrapedListing, ItemType, SwordSpecs, TosoguSpecs,
    SwordAttribution, Certification
)


@ScraperRegistry.register
class SamuraiShokaiScraper(BaseScraper):
    DEALER_NAME = "Samurai Shokai"
    DOMAINS = ["samuraishokai.jp", "www.samuraishokai.jp"]

    # Implementation follows...
```

### Step 2: Implement Item Type Detection

**Strategy (Priority Order):**
1. URL path analysis (most reliable)
2. Title/heading content
3. Default based on path

```python
def _detect_item_type(self, url: str, title: Optional[str]) -> ItemType:
    """Detect item type from URL and title."""
    url_lower = url.lower()

    # 1. Check URL path first
    if '/sword/' in url_lower:
        # It's a sword - determine specific type from title
        if title:
            title_lower = title.lower()
            for jp_term, item_type in self.SWORD_TYPES.items():
                if jp_term in title:
                    return item_type
            # English fallback
            if 'wakizashi' in title_lower:
                return ItemType.WAKIZASHI
            if 'tanto' in title_lower or 'tantou' in title_lower:
                return ItemType.TANTO
            if 'tachi' in title_lower:
                return ItemType.TACHI
        return ItemType.KATANA  # Default for /sword/

    if '/equipment/' in url_lower:
        # Check prefix in filename
        filename = url.split('/')[-1]
        for prefix, item_type in self.TOSOGU_PREFIXES.items():
            if filename.startswith(prefix):
                return item_type
        return ItemType.TSUBA  # Default for /equipment/

    return ItemType.UNKNOWN
```

### Step 3: Implement Price Extraction

```python
def _extract_price(self, soup: BeautifulSoup) -> tuple[Optional[float], str]:
    """Extract price value and currency."""
    text = soup.get_text()

    # Check for sold/reserved first
    for pattern in self.SOLD_PATTERNS:
        if pattern in text:
            return None, 'SOLD'

    for pattern in self.RESERVED_PATTERNS:
        if pattern in text:
            return None, 'RESERVED'

    # Price pattern: "1,050,000円(JPY)" or "価格(Price) 400,000円(JPY)"
    price_match = re.search(r'([\d,]+)\s*円\s*\(?JPY\)?', text)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        return float(price_str), 'JPY'

    return None, 'UNKNOWN'
```

### Step 4: Implement Sword Specs Extraction

```python
def _extract_sword_specs(self, soup: BeautifulSoup) -> Optional[SwordSpecs]:
    """Extract sword measurements."""
    text = soup.get_text()
    specs = SwordSpecs()
    found_any = False

    # Blade length: "刃長 Blade length: 69.9cm" or "Blade length: 25.4cm(八寸四分)"
    nagasa_match = re.search(
        r'(?:刃長|Blade\s*length)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if nagasa_match:
        specs.nagasa_cm = float(nagasa_match.group(1))
        found_any = True

    # Curvature: "反り Curvature: 2.2cm"
    sori_match = re.search(
        r'(?:反り|Curvature)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if sori_match:
        specs.sori_cm = float(sori_match.group(1))
        found_any = True

    # Base width (motohaba): "元幅 Width at Ha-machi: 3.1cm"
    motohaba_match = re.search(
        r'(?:元幅|Width\s*at\s*Ha-?machi)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if motohaba_match:
        specs.motohaba_cm = float(motohaba_match.group(1))
        found_any = True

    # Tip width (sakihaba): "先幅 Width at Kissaki: 2.3cm"
    sakihaba_match = re.search(
        r'(?:先幅|Width\s*at\s*Kissaki)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if sakihaba_match:
        specs.sakihaba_cm = float(sakihaba_match.group(1))
        found_any = True

    # Thickness (kasane): "元重 Kasane: 0.7cm"
    kasane_match = re.search(
        r'(?:元重|Kasane)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if kasane_match:
        specs.kasane_cm = float(kasane_match.group(1))
        found_any = True

    return specs if found_any else None
```

### Step 5: Implement Tosogu Specs Extraction

```python
def _extract_tosogu_specs(self, soup: BeautifulSoup) -> Optional[TosoguSpecs]:
    """Extract tosogu measurements."""
    text = soup.get_text()
    specs = TosoguSpecs()
    found_any = False

    # Height: "縦 Height: 8.5cm"
    height_match = re.search(
        r'(?:縦|Height)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if height_match:
        specs.height_cm = float(height_match.group(1))
        found_any = True

    # Width: "横 Width: 8.2cm"
    width_match = re.search(
        r'(?:横|Width)\s*:?\s*([\d.]+)\s*cm',
        text, re.IGNORECASE
    )
    if width_match:
        specs.width_cm = float(width_match.group(1))
        found_any = True

    # Rim thickness: "耳厚 Rim: 4.5mm"
    thickness_match = re.search(
        r'(?:耳厚|Rim|Thickness)\s*:?\s*([\d.]+)\s*mm',
        text, re.IGNORECASE
    )
    if thickness_match:
        specs.thickness_mm = float(thickness_match.group(1))
        found_any = True

    return specs if found_any else None
```

### Step 6: Implement Certification Extraction

```python
def _extract_certification(self, soup: BeautifulSoup) -> Optional[Certification]:
    """Extract NBTHK/NTHK certification."""
    text = soup.get_text()

    # Check patterns in order of specificity (longest first)
    for jp_term, eng_name in self.CERT_PATTERNS:
        if jp_term in text:
            # Determine organization
            org = 'NBTHK'  # Default for this dealer

            # Extract session number if present (第XX回)
            session_match = re.search(r'第(\d+)回', text)
            session = int(session_match.group(1)) if session_match else None

            return Certification(
                type=eng_name.split()[0],  # "Tokubetsu", "Juyo", etc.
                organization=org,
                session=session
            )

    return None
```

### Step 7: Implement Image Extraction

```python
def _extract_images(self, soup: BeautifulSoup, url: str) -> list[str]:
    """Extract product images."""
    images = []

    # Find all img tags
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src')
        if not src:
            continue

        # Convert relative to absolute URL
        abs_url = urljoin(url, src)

        # Filter for product images (in sy_sword or sy_equip directories)
        if '/sy_sword/' in abs_url or '/sy_equip/' in abs_url:
            # Skip thumbnails (tg.gif)
            if not abs_url.endswith('tg.gif'):
                images.append(abs_url)

    # Also look for linked images (sometimes in <a href="*.jpg">)
    for link in soup.find_all('a', href=True):
        href = link['href']
        if href.endswith(('.jpg', '.jpeg', '.png', '.gif')):
            abs_url = urljoin(url, href)
            if ('/sy_sword/' in abs_url or '/sy_equip/' in abs_url) and abs_url not in images:
                images.append(abs_url)

    return images[:20]  # Limit to 20 images
```

### Step 8: Implement Main Extraction Method

```python
def _extract_data(
    self,
    soup: BeautifulSoup,
    listing: ScrapedListing,
    images_only: bool = False
) -> None:
    """Main extraction method required by BaseScraper."""

    # Always extract images
    listing.images = self._extract_images(soup, listing.url)

    if images_only:
        return

    # Detect item type
    title_elem = soup.find('h3') or soup.find('h4') or soup.find('title')
    title = title_elem.get_text(strip=True) if title_elem else None
    listing.title = title
    listing.item_type = self._detect_item_type(listing.url, title)

    # Extract price
    price_value, price_currency = self._extract_price(soup)
    listing.price_value = price_value
    listing.price_currency = price_currency

    # Set sold/reserved status
    if price_currency == 'SOLD':
        listing.is_sold = True
        listing.status = 'SOLD'
        listing.price_currency = 'JPY'
    elif price_currency == 'RESERVED':
        listing.is_reserved = True
        listing.status = 'RESERVED'
        listing.price_currency = 'JPY'

    # Extract certification
    listing.certification = self._extract_certification(soup)

    # Extract specs based on item type
    if ItemType.is_sword(listing.item_type):
        listing.specs = self._extract_sword_specs(soup)
        listing.attribution = self._extract_attribution(soup)
    elif ItemType.is_tosogu(listing.item_type):
        listing.tosogu_specs = self._extract_tosogu_specs(soup)

    # Extract description (full page text, cleaned)
    listing.description = self._extract_description(soup)
```

### Step 9: Create Catalog Crawler

**File:** `scrapers/discovery/samurai_shokai.py`

```python
"""
Catalog crawler for Samurai Shokai.

Crawls sword and equipment catalog pages to discover new listings.
No pagination - all items on single pages.
"""

import re
from typing import Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from scrapers.discovery.base import BaseCatalogCrawler, DiscoveredListing


class SamuraiShokaiCrawler(BaseCatalogCrawler):
    DEALER_NAME = "Samurai Shokai"

    CATALOG_URLS = [
        "https://www.samuraishokai.jp/sword/index.html",
        "https://www.samuraishokai.jp/equipment/index.html",
    ]

    # URL patterns for valid listings
    LISTING_PATTERNS = [
        r'/sword/\d+\.html$',           # Swords
        r'/equipment/ts\d+\.html$',     # Tsuba
        r'/equipment/fc\d+\.html$',     # Fuchi/Kashira
        r'/equipment/mk\d+\.html$',     # Menuki
        r'/equipment/kz\d+\.html$',     # Kozuka
        r'/equipment/kg\d+\.html$',     # Kogai
        r'/equipment/j\d+\.html$',      # Antique guns
    ]

    def _build_page_url(self, base_url: str, page_num: int) -> str:
        """No pagination needed - all items on single page."""
        return base_url if page_num == 1 else None

    def _extract_listings(
        self,
        soup: BeautifulSoup,
        page_url: str
    ) -> list[DiscoveredListing]:
        """Extract listing URLs from catalog page."""
        listings = []
        seen_urls = set()

        # Find all links
        for link in soup.find_all('a', href=True):
            href = link['href']
            abs_url = urljoin(page_url, href)

            # Check if matches listing pattern
            for pattern in self.LISTING_PATTERNS:
                if re.search(pattern, abs_url) and abs_url not in seen_urls:
                    seen_urls.add(abs_url)

                    # Extract lightweight metadata
                    title = link.get_text(strip=True) or None

                    # Try to find price near this link
                    parent = link.find_parent(['tr', 'div', 'td'])
                    price_text = None
                    if parent:
                        text = parent.get_text()
                        price_match = re.search(r'([\d,]+)\s*円', text)
                        if price_match:
                            price_text = price_match.group(0)

                    listings.append(DiscoveredListing(
                        url=abs_url,
                        title=title,
                        price_text=price_text,
                        thumbnail_url=None,
                        dealer_name=self.DEALER_NAME,
                        discovered_at=None  # Set by caller
                    ))
                    break

        return listings

    def _has_next_page(self, soup: BeautifulSoup, current_page: int) -> bool:
        """No pagination - always return False after first page."""
        return False
```

### Step 10: Register Scraper and Crawler

**Update:** `scrapers/__init__.py`
```python
from . import samurai_shokai  # Add to imports
```

**Update:** `scrapers/discovery/__init__.py`
```python
from . import samurai_shokai  # Add to imports
```

### Step 11: Add Dealer to Database

```sql
INSERT INTO dealers (name, domain, catalog_url, is_active, country)
VALUES (
    'Samurai Shokai',
    'samuraishokai.jp',
    'https://www.samuraishokai.jp/sword/index.html',
    true,
    'Japan'
);
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

**File:** `tests/scrapers/test_samurai_shokai.py`

```python
import pytest
from scrapers.samurai_shokai import SamuraiShokaiScraper


class TestSamuraiShokaiScraper:

    @pytest.fixture
    def scraper(self):
        return SamuraiShokaiScraper(use_llm=False)

    def test_item_type_detection_katana(self, scraper):
        item_type = scraper._detect_item_type(
            "https://www.samuraishokai.jp/sword/26104.html",
            "刀　越前守藤原吉門"
        )
        assert item_type == ItemType.KATANA

    def test_item_type_detection_tanto(self, scraper):
        item_type = scraper._detect_item_type(
            "https://www.samuraishokai.jp/sword/26601.html",
            "短刀　備州長船"
        )
        assert item_type == ItemType.TANTO

    def test_item_type_detection_tsuba(self, scraper):
        item_type = scraper._detect_item_type(
            "https://www.samuraishokai.jp/equipment/ts25001.html",
            "鍔　波濤龍図"
        )
        assert item_type == ItemType.TSUBA

    def test_price_extraction(self, scraper):
        # Test with mock soup containing price
        pass

    def test_certification_specificity(self, scraper):
        # Ensure "特別保存" matches before "保存"
        pass


class TestSamuraiShokaiCrawler:

    def test_listing_pattern_matching(self):
        # Test URL pattern matching
        pass

    def test_no_pagination(self):
        # Verify single page crawl
        pass
```

### 4.2 Integration Tests

```python
@pytest.mark.integration
def test_real_sword_page():
    """Test against live page (run sparingly)."""
    scraper = SamuraiShokaiScraper(use_llm=True)
    listing = scraper.scrape("https://www.samuraishokai.jp/sword/26104.html")

    assert listing.success
    assert listing.item_type == ItemType.KATANA
    assert listing.price_value > 0
    assert listing.price_currency == 'JPY'
    assert len(listing.images) > 0
    assert listing.specs is not None
    assert listing.specs.nagasa_cm is not None


@pytest.mark.integration
def test_real_tsuba_page():
    """Test tosogu page."""
    scraper = SamuraiShokaiScraper(use_llm=True)
    listing = scraper.scrape("https://www.samuraishokai.jp/equipment/ts25001.html")

    assert listing.success
    assert listing.item_type == ItemType.TSUBA
    assert listing.tosogu_specs is not None
```

---

## 5. Edge Cases & Considerations

### 5.1 Known Challenges

1. **Bilingual Text Parsing**
   - Page has both Japanese and English
   - Regex must handle both formats
   - Example: "刃長 Blade length: 69.9cm(二尺三寸一分)"

2. **No Standard HTML Structure**
   - Not using WordPress/WooCommerce
   - Tables and mixed HTML layouts
   - Need flexible selectors

3. **Sold Items Remain on Catalog**
   - Items marked "販売済 SOLD" stay visible
   - Must detect and mark appropriately

4. **Variable URL Prefixes**
   - Tosogu uses multiple prefixes (ts, fc, mk, kz, kg, j)
   - Must map all to correct ItemType

### 5.2 LLM Enhancement Points

Let LLM extract when regex fails:
- Smith attribution (complex Japanese names)
- Era detection (various period names)
- Material descriptions
- Artistic descriptions

### 5.3 Post-LLM Validation

```python
def _post_llm_validation(self, listing: ScrapedListing) -> None:
    """Fix LLM hallucinations."""

    # If LLM says sold but no sold markers in page text
    if listing.is_sold:
        page_text = listing.raw_page_text or ''
        has_sold_marker = any(p in page_text for p in self.SOLD_PATTERNS)
        if not has_sold_marker:
            listing.is_sold = False
            listing.status = 'AVAILABLE'

    # Validate item type matches URL
    if '/sword/' in listing.url and ItemType.is_tosogu(listing.item_type):
        # LLM got confused, override
        listing.item_type = ItemType.KATANA
```

---

## 6. Implementation Timeline

### Phase 1: Core Scraper (First Session)
- [ ] Create `samurai_shokai.py` with base structure
- [ ] Implement item type detection
- [ ] Implement price extraction
- [ ] Implement certification extraction
- [ ] Implement image extraction
- [ ] Test against 3-5 real URLs

### Phase 2: Specs & Attribution (First Session cont.)
- [ ] Implement sword specs extraction
- [ ] Implement tosogu specs extraction
- [ ] Implement smith/era attribution extraction
- [ ] Add post-LLM validation

### Phase 3: Crawler (Second Session)
- [ ] Create `samurai_shokai.py` crawler
- [ ] Implement catalog page parsing
- [ ] Test discovery against both catalogs
- [ ] Verify all listing patterns captured

### Phase 4: Testing & Integration (Second Session cont.)
- [ ] Write unit tests
- [ ] Run integration tests
- [ ] Add dealer to database
- [ ] Run full discovery + scrape cycle
- [ ] Verify data quality in Supabase

---

## 7. Success Criteria

1. **Accuracy Targets:**
   - Item type detection: >95%
   - Price extraction: >99%
   - Certification detection: >95%
   - Image extraction: >99%
   - Spec extraction: >90%

2. **Coverage:**
   - All swords in catalog discovered
   - All tosogu in catalog discovered
   - No duplicate URLs

3. **Reliability:**
   - Handles sold items correctly
   - Handles reserved items correctly
   - Graceful 404 handling
   - No crashes on malformed pages

---

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `scrapers/samurai_shokai.py` | Create | Main scraper class |
| `scrapers/discovery/samurai_shokai.py` | Create | Catalog crawler |
| `scrapers/__init__.py` | Modify | Register scraper import |
| `scrapers/discovery/__init__.py` | Modify | Register crawler import |
| `tests/scrapers/test_samurai_shokai.py` | Create | Unit tests |
| Database | SQL | Add dealer record |

---

## 9. Reference: Similar Scrapers

Study these for patterns:
- `scrapers/eirakudo.py` - Similar bilingual approach, sword + tosogu handling
- `scrapers/aoi_art.py` - Comprehensive spec extraction
- `scrapers/choshuya.py` - Certification ordering pattern

---

**Plan Status:** Ready for implementation
**Estimated Complexity:** Medium
**Priority:** High (adds Japanese dealer coverage)
