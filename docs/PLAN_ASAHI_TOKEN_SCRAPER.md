# Asahi Token Scraper Implementation Plan

## Overview

**Dealer:** Asahi Token (朝日刀剣)
**Domain:** asahitoken.jp
**Country:** Japan
**Primary Focus:** Authenticated signed blades (正真在銘作品), sword fittings
**Estimated Inventory:** 50-100 items (small but high-quality dealer)

---

## Site Analysis Summary

### Site Characteristics

| Characteristic | Value |
|----------------|-------|
| Encoding | UTF-8 (standard) |
| Content Loading | Static HTML (no JavaScript rendering required) |
| Rate Limiting | Unknown - start conservative (3s delay) |
| Authentication | None required |
| Anti-scraping | No obvious protections detected |
| Image Hosting | Same domain, relative paths |
| Languages | Japanese only |

### URL Structure

```
Base URL: https://www.asahitoken.jp/

Catalog Pages:
  /contents/01_token/product/token-A.html     (重要刀剣 - Juyo swords)
  /contents/01_token/product/token-B.html     (太刀・刀 - Tachi/Katana)
  /contents/01_token/product/token-C.html     (脇差 - Wakizashi)
  /contents/01_token/product/token-D.html     (短刀・槍・その他 - Tanto/Spears)
  /contents/01_token/product/token-O.html     (大野義光 - Ono Yoshimitsu)
  /contents/02_tosogu/product/tosogu-TB.html  (鐔 - Tsuba)
  /contents/02_tosogu/product/tosogu-KZ.html  (小柄 - Kozuka)
  /contents/02_tosogu/product/tosogu-KG.html  (笄 - Kogai)
  /contents/02_tosogu/product/tosogu-MK.html  (目貫 - Menuki)
  /contents/02_tosogu/product/tosogu-SK.html  (揃金具 - Matching sets)
  /contents/02_tosogu/product/tosogu-FK.html  (縁頭・拵 - Fuchi/Kashira/Koshirae)

Detail Pages:
  /contents/01_token/details/token-[A-D]/[CODE].html   (Sword details)
  /contents/02_tosogu/details/tosogu-[XX]/[CODE].html  (Tosogu details)

Images:
  /images/01_token/product/token-[X]/[CODE]/[filename].jpg
  /images/02_tosogu/product/tosogu-[XX]/[CODE]/[filename].jpg
```

### Product Code Patterns

| Category | Pattern | Examples |
|----------|---------|----------|
| Juyo Swords | `A_sd[NNN]`, `A-[NNN]-[NNN]` | `A_sd461`, `A-123-456` |
| Katana/Tachi | `B_sd[NNN]`, `B[NNN]`, `B_sd[NNN]_[NNN]` | `B_sd381`, `B117`, `B_sd108_091` |
| Wakizashi | `C_sd[NNN]` | `C_sd382`, `C_sd416` |
| Tanto/Other | `D_sd[NNN]`, `D-[NNN]-[NNN]` | `D_sd402`, `D-016-S-281` |
| Ono Yoshimitsu | `B[NNN]_O` | `B027_O` |
| Tsuba | `TB-[NNN]` | `TB-074`, `TB-070` |
| Kozuka | `KZ-[NNN]` | `KZ-xxx` |
| Kogai | `KG-[NNN]` | `KG-xxx` |
| Menuki | `MK-[NNN]` | `MK-xxx` |

---

## Data Extraction Patterns

### 1. Catalog Page Extraction

**Pattern:** Links to detail pages follow `../details/[category]/[code].html`

```python
# Catalog link extraction regex
CATALOG_LINK_PATTERN = re.compile(
    r'\.\.\/details\/(token-[A-DO]|tosogu-[A-Z]{2})\/([^"]+)\.html',
    re.IGNORECASE
)

# Item types by category
CATEGORY_ITEM_TYPES = {
    'token-A': ItemType.KATANA,      # Could be any sword, needs refinement
    'token-B': ItemType.KATANA,
    'token-C': ItemType.WAKIZASHI,
    'token-D': ItemType.TANTO,       # Or YARI, needs title parsing
    'token-O': ItemType.KATANA,      # Ono Yoshimitsu works
    'tosogu-TB': ItemType.TSUBA,
    'tosogu-KZ': ItemType.KOZUKA,
    'tosogu-KG': ItemType.KOGAI,
    'tosogu-MK': ItemType.MENUKI,
    'tosogu-SK': ItemType.MITOKOROMONO,  # Matching sets
    'tosogu-FK': ItemType.FUCHI_KASHIRA,  # Or KOSHIRAE
}
```

### 2. Title Extraction

**Pattern:** Main heading contains smith/maker name

```python
# Title is typically in the main content heading
# Format: "伊勢守藤原岩捲信貞" (smith name in Japanese)
# May also contain era/province: "江戸時代初期 美濃"

def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
    # Look for main content heading
    # Multiple possible locations - inspect actual HTML structure
    candidates = [
        soup.select_one('h1'),
        soup.select_one('.product-title'),
        soup.select_one('#main h2'),
        # Fallback to first significant heading in content area
    ]
    for candidate in candidates:
        if candidate and candidate.get_text(strip=True):
            return candidate.get_text(strip=True)
    return None
```

### 3. Price Extraction

**Formats encountered:**
- `¥5,500,000` - Standard yen format
- `5,500,000円` - Alternative yen format
- `440,000円` - Without leading yen symbol
- `お問合せください` - Price on application (POA)
- `売約済` - Sold/Reserved (no price)

```python
PRICE_PATTERNS = [
    # ¥1,234,567
    re.compile(r'[¥￥]\s*([\d,]+)'),
    # 1,234,567円
    re.compile(r'([\d,]+)\s*円'),
]

POA_INDICATORS = [
    'お問合せ',      # Please inquire
    'お問い合わせ',  # Please inquire (variant)
    '要問合',        # Inquiry required
    '応相談',        # Negotiable
]

SOLD_INDICATORS = [
    '売約済',     # Sold/Reserved
    '売切',       # Sold out
    '完売',       # Sold out
    '商談中',     # Under negotiation
]
```

### 4. Specifications Extraction

**Sword Specifications Format:**
```
刃長：66.9cm・2尺2寸     (Blade length)
反：1.8cm・5分9厘        (Curvature)
元幅：32.5mm             (Base width)
先幅：21.6mm             (Tip width)
元重：6.8mm              (Base thickness)
先重：4.4mm              (Tip thickness)
目釘孔：2                 (Peg holes)
```

```python
SPEC_PATTERNS = {
    'nagasa_cm': re.compile(r'刃長[：:]\s*([\d.]+)\s*cm'),
    'nagasa_shaku': re.compile(r'刃長[：:].*?・\s*([\d尺寸分厘]+)'),
    'sori_cm': re.compile(r'反[：:]\s*([\d.]+)\s*cm'),
    'motohaba_cm': re.compile(r'元幅[：:]\s*([\d.]+)\s*(?:cm|mm)'),
    'sakihaba_cm': re.compile(r'先幅[：:]\s*([\d.]+)\s*(?:cm|mm)'),
    'kasane_cm': re.compile(r'元重[：:]\s*([\d.]+)\s*(?:cm|mm)'),
    'nakago_ana': re.compile(r'目釘[孔穴][：:]\s*(\d+)'),
}

# Era/Province pattern
ERA_PROVINCE_PATTERN = re.compile(
    r'(平安|鎌倉|南北朝|室町|桃山|江戸|明治|大正|昭和|平成|令和)'
    r'[時代]*(前期|中期|後期|初期|末期)?'
    r'.*?'
    r'([\u4e00-\u9fff]+[国州]|[\u4e00-\u9fff]+\（[\u4e00-\u9fff]+\）)?'
)
```

### 5. Certification Extraction

**NBTHK Designations (ordered by prestige):**
```python
CERT_PATTERNS = [
    # Most specific first (longer patterns)
    ('特別重要刀剣', CertType.TOKUBETSU_JUYO),     # Tokubetsu Juyo
    ('特別保存刀剣', CertType.TOKUBETSU_HOZON),   # Tokubetsu Hozon
    ('重要刀剣', CertType.JUYO),                   # Juyo
    ('保存刀剣', CertType.HOZON),                  # Hozon
    ('特別保存刀装具', CertType.TOKUBETSU_HOZON),  # Tosogu cert
    ('保存刀装具', CertType.HOZON),                # Tosogu cert
]

# Reference to appraisal books (unique to Asahi Token)
APPRAISAL_BOOK_PATTERN = re.compile(
    r'鑑刀日々抄\s*(続)?\s*[\(（]?\s*(\d+)[頁ページ]?'
)
```

### 6. Image Extraction

**Pattern:** Images stored in product-specific directories

```python
def _extract_images(self, soup: BeautifulSoup, listing: ScrapedListing) -> None:
    images = []

    # Extract product code from URL to build image paths
    code = self._extract_code_from_url(listing.url)
    category = self._extract_category_from_url(listing.url)

    # Look for image elements
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src')
        if src and self._is_product_image(src):
            # Normalize to absolute URL
            full_url = urljoin(listing.url, src)
            images.append(full_url)

    # Filter icons/navigation images
    listing.images = [
        img for img in images
        if not self._is_icon(img)
    ][:20]

def _is_product_image(self, src: str) -> bool:
    """Check if image is a product image vs navigation/icon"""
    product_indicators = ['sd', 'tb-', 'kz-', 'kg-', 'mk-']
    return any(ind in src.lower() for ind in product_indicators)

# Excluded patterns
EXCLUDED_IMAGE_PATTERNS = [
    r'logo',
    r'icon',
    r'button',
    r'nav',
    r'menu',
    r'arrow',
    r'top\.gif',
    r'off\.gif',  # Navigation state images
    r'on\.gif',
]
```

---

## Implementation Architecture

### File Structure

```
Oshi-scrapper/
├── scrapers/
│   ├── asahi_token.py          # Main scraper class
│   └── discovery/
│       └── asahi_token.py      # Catalog crawler
└── tests/
    └── scrapers/
        ├── test_asahi_token.py           # Unit tests
        └── fixtures/
            └── asahi_token/
                ├── catalog_token_b.html  # Catalog page fixture
                ├── detail_sword.html     # Sword detail fixture
                ├── detail_tsuba.html     # Tosogu detail fixture
                └── detail_sold.html      # Sold item fixture
```

### Scraper Class

```python
# scrapers/asahi_token.py

from scrapers.base import BaseScraper
from scrapers.registry import ScraperRegistry
from models.listing import (
    ScrapedListing, ItemType, ItemCategory,
    SwordSpecs, SwordAttribution, Certification,
    TosoguSpecs, ListingStatus
)

@ScraperRegistry.register
class AsahiTokenScraper(BaseScraper):
    """
    Scraper for Asahi Token (朝日刀剣) - asahitoken.jp

    Characteristics:
    - High-quality dealer specializing in authenticated signed blades
    - Static HTML pages, UTF-8 encoding
    - Both swords and tosogu
    - Japanese-only content
    """

    DEALER_NAME = "Asahi Token"
    DOMAINS = ["asahitoken.jp", "www.asahitoken.jp"]

    # Category to ItemType mapping
    CATEGORY_TYPES = {
        'token-A': ItemType.KATANA,
        'token-B': ItemType.KATANA,
        'token-C': ItemType.WAKIZASHI,
        'token-D': ItemType.TANTO,
        'token-O': ItemType.KATANA,
        'tosogu-TB': ItemType.TSUBA,
        'tosogu-KZ': ItemType.KOZUKA,
        'tosogu-KG': ItemType.KOGAI,
        'tosogu-MK': ItemType.MENUKI,
        'tosogu-SK': ItemType.MITOKOROMONO,
        'tosogu-FK': ItemType.FUCHI_KASHIRA,
    }

    def _extract_data(
        self,
        soup: BeautifulSoup,
        listing: ScrapedListing,
        images_only: bool = False
    ) -> None:
        """Extract all data from detail page"""

        if images_only:
            self._extract_images(soup, listing)
            return

        # Extract basic info
        listing.title = self._extract_title(soup)
        listing.item_type = self._detect_item_type(listing.url, soup)
        listing.item_category = self._get_item_category(listing.item_type)

        # Extract price and availability
        self._extract_price_and_status(soup, listing)

        # Extract specs based on item type
        if listing.is_sword():
            listing.specs = self._extract_sword_specs(soup)
            listing.attribution = self._extract_attribution(soup)
        elif listing.is_tosogu():
            listing.tosogu_specs = self._extract_tosogu_specs(soup)

        # Extract certification
        listing.certification = self._extract_certification(soup)

        # Extract images
        self._extract_images(soup, listing)

        # Extract description
        listing.description = self._extract_description(soup)

    def _detect_item_type(self, url: str, soup: BeautifulSoup) -> ItemType:
        """Detect item type from URL category and page content"""
        # Extract category from URL
        category_match = re.search(
            r'(token-[A-DO]|tosogu-[A-Z]{2})',
            url, re.IGNORECASE
        )
        if category_match:
            category = category_match.group(1).lower()
            base_type = self.CATEGORY_TYPES.get(category, ItemType.UNKNOWN)

            # Refine based on content for mixed categories
            if category == 'token-d':
                # Could be tanto, yari, naginata, etc.
                return self._refine_type_from_content(soup, base_type)

            return base_type

        return ItemType.UNKNOWN

    def _extract_price_and_status(
        self,
        soup: BeautifulSoup,
        listing: ScrapedListing
    ) -> None:
        """Extract price and determine sold status"""
        page_text = soup.get_text()

        # Check sold status first
        for indicator in SOLD_INDICATORS:
            if indicator in page_text:
                listing.is_sold = True
                listing.is_available = False
                listing.status = ListingStatus.SOLD
                return

        # Check POA
        for indicator in POA_INDICATORS:
            if indicator in page_text:
                listing.price_raw = "POA"
                listing.is_available = True
                listing.status = ListingStatus.AVAILABLE
                return

        # Extract numeric price
        for pattern in PRICE_PATTERNS:
            match = pattern.search(page_text)
            if match:
                price_str = match.group(1).replace(',', '')
                listing.price_value = float(price_str)
                listing.price_currency = 'JPY'
                listing.price_raw = match.group(0)
                listing.is_available = True
                listing.status = ListingStatus.AVAILABLE
                return

    def _extract_sword_specs(self, soup: BeautifulSoup) -> Optional[SwordSpecs]:
        """Extract sword measurements from detail page"""
        text = soup.get_text()
        specs = SwordSpecs()

        for field, pattern in SPEC_PATTERNS.items():
            match = pattern.search(text)
            if match:
                value = match.group(1)
                # Convert mm to cm if needed
                if 'mm' in match.group(0) and field in ['motohaba_cm', 'sakihaba_cm', 'kasane_cm']:
                    value = float(value) / 10
                setattr(specs, field, float(value) if field != 'nakago_ana' else int(value))

        return specs if specs.has_data() else None

    def _extract_certification(self, soup: BeautifulSoup) -> Optional[Certification]:
        """Extract NBTHK certification"""
        text = soup.get_text()

        for jp_name, cert_type in CERT_PATTERNS:
            if jp_name in text:
                cert = Certification()
                cert.cert_type = cert_type
                cert.cert_organization = 'NBTHK'

                # Check for appraisal book reference (unique to this dealer)
                book_match = APPRAISAL_BOOK_PATTERN.search(text)
                if book_match:
                    cert.notes = f"鑑刀日々抄 p.{book_match.group(2)}"

                return cert

        return None
```

### Discovery Crawler

```python
# scrapers/discovery/asahi_token.py

from scrapers.discovery.base import BaseCatalogCrawler, DiscoveredListing

class AsahiTokenCrawler(BaseCatalogCrawler):
    """
    URL discovery crawler for Asahi Token

    Crawls all catalog pages (swords + tosogu) and extracts detail page URLs.
    """

    DEALER_NAME = "Asahi Token"

    CATALOG_URLS = [
        # Swords
        "https://www.asahitoken.jp/contents/01_token/product/token-A.html",
        "https://www.asahitoken.jp/contents/01_token/product/token-B.html",
        "https://www.asahitoken.jp/contents/01_token/product/token-C.html",
        "https://www.asahitoken.jp/contents/01_token/product/token-D.html",
        "https://www.asahitoken.jp/contents/01_token/product/token-O.html",
        # Tosogu
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-TB.html",
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-KZ.html",
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-KG.html",
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-MK.html",
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-SK.html",
        "https://www.asahitoken.jp/contents/02_tosogu/product/tosogu-FK.html",
    ]

    def _build_page_url(self, base_url: str, page_num: int) -> str:
        """Asahi Token uses single-page catalogs with no pagination"""
        if page_num == 1:
            return base_url
        return ""  # No pagination - stop after first page

    def _extract_listings(
        self,
        soup: BeautifulSoup,
        page_url: str
    ) -> list[DiscoveredListing]:
        """Extract detail page URLs from catalog"""
        listings = []

        # Pattern: ../details/[category]/[code].html
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')

            if '../details/' in href and href.endswith('.html'):
                full_url = urljoin(page_url, href)

                # Extract title from link text or nearby text
                title = link.get_text(strip=True)

                # Extract thumbnail if present
                img = link.find('img')
                thumbnail = None
                if img:
                    thumb_src = img.get('src')
                    if thumb_src:
                        thumbnail = urljoin(page_url, thumb_src)

                # Extract price if visible in catalog
                price_text = self._extract_catalog_price(link)

                listings.append(DiscoveredListing(
                    url=full_url,
                    title=title,
                    thumbnail=thumbnail,
                    price_text=price_text,
                    category=self._extract_category(page_url),
                    discovered_at=datetime.now()
                ))

        return listings

    def _extract_category(self, page_url: str) -> str:
        """Extract category from catalog URL"""
        if 'token-A' in page_url:
            return 'Juyo Token'
        elif 'token-B' in page_url:
            return 'Katana'
        elif 'token-C' in page_url:
            return 'Wakizashi'
        elif 'token-D' in page_url:
            return 'Tanto'
        elif 'token-O' in page_url:
            return 'Ono Yoshimitsu'
        elif 'tosogu-TB' in page_url:
            return 'Tsuba'
        elif 'tosogu-KZ' in page_url:
            return 'Kozuka'
        elif 'tosogu-KG' in page_url:
            return 'Kogai'
        elif 'tosogu-MK' in page_url:
            return 'Menuki'
        elif 'tosogu-SK' in page_url:
            return 'Matching Set'
        elif 'tosogu-FK' in page_url:
            return 'Fuchi Kashira'
        return 'Unknown'
```

---

## Test Plan

### Unit Tests

```python
# tests/scrapers/test_asahi_token.py

import pytest
from unittest.mock import Mock
from bs4 import BeautifulSoup
from scrapers.asahi_token import AsahiTokenScraper
from models.listing import ScrapedListing, ItemType, ListingStatus

class TestAsahiTokenScraper:
    """Unit tests for Asahi Token scraper"""

    @pytest.fixture
    def scraper(self, mock_http_client):
        return AsahiTokenScraper(http_client=mock_http_client, use_llm=False)

    # ============ Domain Matching ============

    def test_can_handle_main_domain(self, scraper):
        """Test domain matching for asahitoken.jp"""
        assert scraper.can_handle("https://www.asahitoken.jp/contents/01_token/details/token-B/B_sd381.html")
        assert scraper.can_handle("https://asahitoken.jp/contents/01_token/product/token-B.html")

    def test_rejects_other_domains(self, scraper):
        """Test rejection of non-matching domains"""
        assert not scraper.can_handle("https://aoijapan.com/katana-test/")
        assert not scraper.can_handle("https://asahi.com/something")

    # ============ Title Extraction ============

    def test_extracts_smith_name_title(self, scraper, sword_detail_html):
        """Test extraction of smith name as title"""
        soup = BeautifulSoup(sword_detail_html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/contents/01_token/details/token-B/B_sd381.html")

        scraper._extract_data(soup, listing)

        assert listing.title is not None
        assert '藤原' in listing.title or '信貞' in listing.title  # Smith name characters

    # ============ Item Type Detection ============

    def test_detects_katana_from_token_b_url(self, scraper):
        """Test item type detection from URL category"""
        url = "https://www.asahitoken.jp/contents/01_token/details/token-B/B_sd381.html"
        soup = BeautifulSoup("<html></html>", 'lxml')

        item_type = scraper._detect_item_type(url, soup)

        assert item_type == ItemType.KATANA

    def test_detects_wakizashi_from_token_c_url(self, scraper):
        """Test wakizashi detection"""
        url = "https://www.asahitoken.jp/contents/01_token/details/token-C/C_sd382.html"
        soup = BeautifulSoup("<html></html>", 'lxml')

        item_type = scraper._detect_item_type(url, soup)

        assert item_type == ItemType.WAKIZASHI

    def test_detects_tsuba_from_tosogu_url(self, scraper):
        """Test tsuba detection from tosogu URL"""
        url = "https://www.asahitoken.jp/contents/02_tosogu/details/tosogu-TB/TB-074.html"
        soup = BeautifulSoup("<html></html>", 'lxml')

        item_type = scraper._detect_item_type(url, soup)

        assert item_type == ItemType.TSUBA

    # ============ Price Extraction ============

    def test_extracts_yen_price_with_symbol(self, scraper):
        """Test price extraction: ¥5,500,000"""
        html = '<div class="price">¥5,500,000</div>'
        soup = BeautifulSoup(html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/test")

        scraper._extract_price_and_status(soup, listing)

        assert listing.price_value == 5500000.0
        assert listing.price_currency == 'JPY'
        assert listing.is_available is True

    def test_extracts_yen_price_with_kanji(self, scraper):
        """Test price extraction: 440,000円"""
        html = '<div>価格：440,000円（税込）</div>'
        soup = BeautifulSoup(html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/test")

        scraper._extract_price_and_status(soup, listing)

        assert listing.price_value == 440000.0
        assert listing.price_currency == 'JPY'

    def test_detects_sold_status(self, scraper):
        """Test sold item detection: 売約済"""
        html = '<div class="status">売約済</div><div>¥500,000</div>'
        soup = BeautifulSoup(html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/test")

        scraper._extract_price_and_status(soup, listing)

        assert listing.is_sold is True
        assert listing.is_available is False
        assert listing.status == ListingStatus.SOLD
        # Price should not be set for sold items
        assert listing.price_value is None

    def test_detects_poa_status(self, scraper):
        """Test POA detection: お問合せください"""
        html = '<div>お問合せください</div>'
        soup = BeautifulSoup(html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/test")

        scraper._extract_price_and_status(soup, listing)

        assert listing.price_raw == "POA"
        assert listing.is_available is True
        assert listing.price_value is None

    # ============ Specification Extraction ============

    def test_extracts_blade_length_cm(self, scraper):
        """Test blade length extraction in cm"""
        html = '<div>刃長：66.9cm・2尺2寸</div>'
        soup = BeautifulSoup(html, 'lxml')

        specs = scraper._extract_sword_specs(soup)

        assert specs is not None
        assert specs.nagasa_cm == 66.9

    def test_extracts_curvature(self, scraper):
        """Test sori extraction"""
        html = '<div>反：1.8cm・5分9厘</div>'
        soup = BeautifulSoup(html, 'lxml')

        specs = scraper._extract_sword_specs(soup)

        assert specs is not None
        assert specs.sori_cm == 1.8

    def test_extracts_width_from_mm(self, scraper):
        """Test width extraction with mm to cm conversion"""
        html = '<div>元幅：32.5mm</div>'
        soup = BeautifulSoup(html, 'lxml')

        specs = scraper._extract_sword_specs(soup)

        assert specs is not None
        assert specs.motohaba_cm == 3.25  # Converted from mm

    # ============ Certification Extraction ============

    def test_extracts_juyo_certification(self, scraper):
        """Test Juyo certification extraction"""
        html = '<div>重要刀剣 鑑刀日々抄 続（582-583頁）</div>'
        soup = BeautifulSoup(html, 'lxml')

        cert = scraper._extract_certification(soup)

        assert cert is not None
        assert cert.cert_type.name == 'JUYO'
        assert cert.cert_organization == 'NBTHK'
        assert '582' in cert.notes

    def test_extracts_tokubetsu_hozon(self, scraper):
        """Test Tokubetsu Hozon certification"""
        html = '<div>特別保存刀剣</div>'
        soup = BeautifulSoup(html, 'lxml')

        cert = scraper._extract_certification(soup)

        assert cert is not None
        assert cert.cert_type.name == 'TOKUBETSU_HOZON'

    def test_prefers_specific_cert_over_generic(self, scraper):
        """Test that 特別重要刀剣 is extracted instead of 重要刀剣"""
        html = '<div>特別重要刀剣</div>'  # Contains both 特別重要 and 重要
        soup = BeautifulSoup(html, 'lxml')

        cert = scraper._extract_certification(soup)

        assert cert.cert_type.name == 'TOKUBETSU_JUYO'  # Not JUYO

    # ============ Image Extraction ============

    def test_extracts_product_images(self, scraper, sword_detail_html):
        """Test product image extraction"""
        soup = BeautifulSoup(sword_detail_html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/contents/01_token/details/token-B/B_sd381.html")

        scraper._extract_data(soup, listing, images_only=True)

        assert len(listing.images) >= 1
        assert all('asahitoken.jp' in img for img in listing.images)

    def test_excludes_navigation_images(self, scraper):
        """Test that navigation/icon images are filtered"""
        html = '''
        <div>
            <img src="/images/01_token/product/token-B/B_sd381/sd381_1.jpg">
            <img src="/images/common/nav_off.gif">
            <img src="/images/common/logo.png">
            <img src="/images/01_token/product/token-B/B_sd381/sd381_2.jpg">
        </div>
        '''
        soup = BeautifulSoup(html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/test")

        scraper._extract_images(soup, listing)

        assert len(listing.images) == 2
        assert not any('nav' in img for img in listing.images)
        assert not any('logo' in img for img in listing.images)

    # ============ Full Integration ============

    def test_full_extraction_available_sword(self, scraper, available_sword_html):
        """Test complete extraction of an available sword"""
        soup = BeautifulSoup(available_sword_html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/contents/01_token/details/token-A/A_sd461.html")

        scraper._extract_data(soup, listing)

        assert listing.title is not None
        assert listing.item_type == ItemType.KATANA
        assert listing.price_value == 5500000.0
        assert listing.is_available is True
        assert listing.certification is not None
        assert listing.certification.cert_type.name == 'JUYO'
        assert len(listing.images) >= 1

    def test_full_extraction_sold_item(self, scraper, sold_sword_html):
        """Test extraction of a sold item"""
        soup = BeautifulSoup(sold_sword_html, 'lxml')
        listing = ScrapedListing(url="https://www.asahitoken.jp/contents/01_token/details/token-B/B_sd381.html")

        scraper._extract_data(soup, listing)

        assert listing.is_sold is True
        assert listing.is_available is False
        assert listing.price_value is None


class TestAsahiTokenCrawler:
    """Unit tests for Asahi Token catalog crawler"""

    @pytest.fixture
    def crawler(self, mock_http_client):
        return AsahiTokenCrawler(http_client=mock_http_client)

    def test_extracts_detail_urls_from_catalog(self, crawler, catalog_html):
        """Test URL extraction from catalog page"""
        soup = BeautifulSoup(catalog_html, 'lxml')

        listings = crawler._extract_listings(
            soup,
            "https://www.asahitoken.jp/contents/01_token/product/token-B.html"
        )

        assert len(listings) > 0
        assert all('/details/' in l.url for l in listings)
        assert all(l.url.endswith('.html') for l in listings)

    def test_builds_absolute_urls(self, crawler, catalog_html):
        """Test that relative URLs are converted to absolute"""
        soup = BeautifulSoup(catalog_html, 'lxml')

        listings = crawler._extract_listings(
            soup,
            "https://www.asahitoken.jp/contents/01_token/product/token-B.html"
        )

        assert all(l.url.startswith('https://') for l in listings)

    def test_extracts_category_from_url(self, crawler):
        """Test category extraction from catalog URLs"""
        assert crawler._extract_category('.../token-A.html') == 'Juyo Token'
        assert crawler._extract_category('.../token-B.html') == 'Katana'
        assert crawler._extract_category('.../tosogu-TB.html') == 'Tsuba'
```

### Test Fixtures

```python
# tests/scrapers/fixtures/asahi_token/conftest.py

import pytest
from pathlib import Path

FIXTURE_DIR = Path(__file__).parent / 'asahi_token'

@pytest.fixture
def sword_detail_html():
    """Load sword detail page fixture"""
    return (FIXTURE_DIR / 'detail_sword.html').read_text(encoding='utf-8')

@pytest.fixture
def sold_sword_html():
    """Load sold sword fixture"""
    return (FIXTURE_DIR / 'detail_sold.html').read_text(encoding='utf-8')

@pytest.fixture
def available_sword_html():
    """Load available sword with price fixture"""
    return (FIXTURE_DIR / 'detail_available.html').read_text(encoding='utf-8')

@pytest.fixture
def tsuba_detail_html():
    """Load tsuba detail page fixture"""
    return (FIXTURE_DIR / 'detail_tsuba.html').read_text(encoding='utf-8')

@pytest.fixture
def catalog_html():
    """Load catalog page fixture"""
    return (FIXTURE_DIR / 'catalog_token_b.html').read_text(encoding='utf-8')
```

---

## Implementation Checklist

### Phase 1: Core Scraper
- [ ] Create `scrapers/asahi_token.py` with basic structure
- [ ] Implement domain matching (`DOMAINS`, `can_handle`)
- [ ] Implement title extraction
- [ ] Implement item type detection from URL
- [ ] Implement price extraction (all formats)
- [ ] Implement sold status detection
- [ ] Implement basic image extraction
- [ ] Register with `ScraperRegistry`

### Phase 2: Specifications & Certification
- [ ] Implement sword specs extraction (nagasa, sori, widths)
- [ ] Implement tosogu specs extraction
- [ ] Implement NBTHK certification extraction
- [ ] Implement appraisal book reference extraction
- [ ] Handle POA (Price on Application) items

### Phase 3: Discovery Crawler
- [ ] Create `scrapers/discovery/asahi_token.py`
- [ ] Implement all 11 catalog URL crawling
- [ ] Implement detail page URL extraction
- [ ] Handle no-pagination catalog structure

### Phase 4: Testing
- [ ] Create HTML fixtures from real pages
- [ ] Write unit tests for all extraction methods
- [ ] Write integration tests
- [ ] Test edge cases (sold items, POA, missing data)
- [ ] Test LLM fallback integration

### Phase 5: Quality Assurance
- [ ] Run against live site (small sample)
- [ ] Verify data quality vs manual inspection
- [ ] Check image URL validity
- [ ] Validate spec extraction accuracy
- [ ] Test rate limiting behavior

### Phase 6: Database Integration
- [ ] Add dealer to `dealers` table
- [ ] Run initial discovery crawl
- [ ] Run initial scrape of discovered URLs
- [ ] Verify data appears correctly in nihontowatch.com

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Site structure changes | Medium | High | Comprehensive test fixtures, monitoring |
| Rate limiting/blocking | Low | High | Conservative delays (3s), respectful User-Agent |
| Japanese encoding issues | Low | Medium | UTF-8 standard, tested patterns |
| Missing spec data | Medium | Low | LLM fallback, graceful degradation |
| Image path changes | Low | Medium | Flexible URL construction, validation |

---

## Notes

### Unique Aspects of This Dealer

1. **High-quality, curated inventory**: Asahi Token specializes in authenticated signed blades. Expect fewer items but higher quality/value.

2. **Appraisal book references**: Unique feature where items reference pages in "鑑刀日々抄" - worth capturing in certification notes.

3. **No pagination**: All catalog pages are single-page, making discovery straightforward.

4. **Mixed sword/tosogu**: Separate URL structures for swords (01_token) and fittings (02_tosogu).

5. **Ono Yoshimitsu section**: Special category for modern master smith - may have unique attributes.

### Comparison to Similar Scrapers

Most similar to:
- **Nipponto**: Japanese dealer, static HTML, but Asahi uses UTF-8 (no encoding complexity)
- **Aoi Art**: Both have sword + tosogu, but Asahi has simpler structure (no WooCommerce)
- **Choshuya**: Not similar (Choshuya uses JavaScript data objects)

### LLM Integration

This dealer is a good candidate for regex-only extraction due to:
- Consistent, predictable HTML structure
- Clear Japanese patterns for specs/certifications
- Static pages without JavaScript loading

LLM fallback should be enabled for:
- Description text summarization/translation
- Handling unexpected format variations
- Attribution extraction from complex title strings
