# Goushuya Nihontou Scraper Implementation Plan

**Target Site:** https://www.goushuya-nihontou.com/
**Dealer Name:** Goushuya (江州屋刀剣店)
**Location:** Shiga Prefecture, Japan
**Date:** 2026-02-02

---

## Executive Summary

Goushuya is a traditional Japanese sword dealer based in Shiga Prefecture. The site runs on WordPress with Elementor and uses a mix of contact-based pricing (no online prices for some items) and listed prices for others. The scraper needs to handle:

1. **Multiple content types:** Swords (刀剣) and tosogu (鐔, 縁頭, etc.)
2. **Variable pricing:** Some items have prices (¥130,000), others require contact
3. **Japanese URL slugs:** URL-encoded Japanese characters
4. **Category-based discovery:** Multiple overlapping taxonomies

---

## Site Analysis

### 1. Site Structure

| Component | Technology |
|-----------|------------|
| CMS | WordPress |
| Page Builder | Elementor Pro |
| Navigation | JetMenu |
| Newsletter | MailPoet |
| Analytics | Google Analytics (GA-5CTMVVQPKX) |

### 2. URL Patterns

```
# Product pages - swords
https://www.goushuya-nihontou.com/sword/{id}/
https://www.goushuya-nihontou.com/sword/{japanese-slug}/

# Product pages - tosogu
https://www.goushuya-nihontou.com/tsuba/{url-encoded-japanese}/

# Category listings
https://www.goushuya-nihontou.com/category/sword-type/        # By blade type
https://www.goushuya-nihontou.com/category/article-type/tsuba/ # By item type
https://www.goushuya-nihontou.com/category/sword-type5/       # By certification
```

### 3. Category Taxonomy

**By Sword Type:**
- `/category/sword-type/` - All swords
- `/category/tachi/` - Tachi
- `/category/sword/` - Katana
- `/category/wakizashi/` - Wakizashi

**By Fitting Type:**
- `/category/article-type/tsuba/` - Tsuba
- `/category/margin/` - Fuchi-Kashira (縁頭)

**By Certification:**
- `/category/sword-type5/` - Tokubetsu Juyo (特別重要刀剣)
- `/category/sword-type8/` - Juyo (重要刀剣)
- `/category/preservation-sword-fittings/` - Hozon Tosogu (保存刀装具)
- `/category/art/` - Important Art Objects (重要美術品)

### 4. Data Fields Available

| Field | Sword Example | Tsuba Example | Notes |
|-------|---------------|---------------|-------|
| Title (商品名) | 特別保存刀剣 刀銘 水心子正次 | 老松図透鐔 | Japanese only |
| Maker (作者) | 水心子正次 | 無銘 正阿弥 | May be "無銘" (unsigned) |
| Period (時代) | 江戸時代末期 | - | Era/period |
| Certification (指定) | 特別保存刀剣 | 保存刀装具鑑定書付 | NBTHK papers |
| Cert Date | - | 平成8年8月9日 | Date of certification |
| Blade Length (刃長) | 69.2cm | - | Swords only |
| Curvature (反り) | 1.6cm | - | Swords only |
| Motohaba (元幅) | 3.0cm | - | Swords only |
| Sakihaba (先幅) | 2.2cm | - | Swords only |
| Nakago (茎長) | 23.5cm | - | Tang length |
| Kissaki (切先長) | 3.3cm | - | Point length |
| Dimensions | - | 82mm × 82mm × 5mm | Tsuba uses mm |
| Material (地金) | - | 鉄地 (iron) | Tosogu only |
| Technique | - | 金布目象嵌 | Inlay technique |
| Price (価格) | Missing | ¥130,000 | Variable availability |
| Images | 1 image typically | 2 images (front/back) | Limited gallery |

### 5. Price Behavior Analysis

**Cross-validated findings:**

| Page Type | URL | Price Present? |
|-----------|-----|----------------|
| Sword page | `/sword/1381/` | NO - contact required |
| Tsuba page | `/tsuba/老松図透鐔/` | YES - ¥130,000 |

**Conclusion:** Price availability varies by item. Tosogu pages tend to have prices; higher-value swords may require contact.

---

## Implementation Plan

### Phase 1: Core Scraper

**File:** `scrapers/goushuya.py`

```python
@ScraperRegistry.register
class GoushuyaScraper(BaseScraper):
    DEALER_NAME = "Goushuya"
    DOMAINS = ["goushuya-nihontou.com", "www.goushuya-nihontou.com"]
```

**Key Methods:**

1. `_extract_data()` - Main extraction logic
2. `_extract_title()` - From h1 or WordPress title
3. `_extract_specs()` - Parse key-value specification pairs
4. `_extract_price_from_page()` - Handle ¥XXX,XXX format
5. `_extract_product_images()` - WordPress media library images
6. `_detect_item_type()` - Distinguish sword vs tosogu
7. `_extract_certification()` - Parse NBTHK certification info
8. `_check_sold()` - Detect sold indicators (if any)

### Phase 2: Specification Extraction

**Sword specs (SwordSpecs):**
```
刃長 : 69.2cm → nagasa_cm: 69.2
反り : 1.6cm → sori_cm: 1.6
元幅 : 3.0cm → motohaba_cm: 3.0
先幅 : 2.2cm → sakihaba_cm: 2.2
茎長 : 23.5cm → nakago_cm: 23.5
```

**Tosogu specs (TosoguSpecs):**
```
82mm × 82mm × 5mm → height_cm: 8.2, width_cm: 8.2, thickness_mm: 5.0
耳巾 5mm → mimi (rim width)
切羽台 5mm → seppa_dai
```

**Regex patterns needed:**
```python
# Sword dimensions (cm format)
NAGASA_PATTERN = r'刃長\s*[:：]?\s*([\d.]+)\s*(?:cm|㎝)?'
SORI_PATTERN = r'反り\s*[:：]?\s*([\d.]+)\s*(?:cm|㎝)?'
MOTOHABA_PATTERN = r'元幅\s*[:：]?\s*([\d.]+)\s*(?:cm|㎝)?'

# Tosogu dimensions (mm format, with ×)
TOSOGU_SIZE_PATTERN = r'([\d.]+)\s*[×xX]\s*([\d.]+)\s*[×xX]\s*([\d.]+)\s*mm'
```

### Phase 3: Certification Parsing

**Patterns to detect:**
```python
CERT_PATTERNS = [
    (r'特別重要刀剣', 'Tokubetsu Juyo'),
    (r'重要刀剣', 'Juyo'),
    (r'特別保存刀剣', 'Tokubetsu Hozon'),
    (r'保存刀剣', 'Hozon'),
    (r'特別保存刀装具', 'Tokubetsu Hozon Tosogu'),
    (r'保存刀装具鑑定書付', 'Hozon Tosogu'),
    (r'重要美術品', 'Important Art Object'),
]
```

**Certification date parsing:**
```python
# Pattern: 平成8年8月9日 (Heisei 8, August 9)
# Pattern: 令和X年X月X日
CERT_DATE_PATTERN = r'(平成|令和|昭和)(\d+)年(\d+)月(\d+)日'
```

### Phase 4: Image Extraction

**WordPress image patterns:**
```python
# Main image in content
IMG_PATTERN = r'https://www\.goushuya-nihontou\.com/wp-content/uploads/\d{4}/\d{2}/[^"\'>\s]+'

# Schema.org ImageObject
def _extract_images_from_schema(self, soup):
    """Extract from JSON-LD ImageObject."""
    pass
```

**Image filtering:**
- Skip icons/logos
- Skip placeholder images
- Handle single image (not gallery)
- Extract from both `<img>` tags and JSON-LD

### Phase 5: URL Discovery

**Approach: Crawl category pages**

```python
DISCOVERY_CATEGORIES = [
    'https://www.goushuya-nihontou.com/sword/',           # All swords
    'https://www.goushuya-nihontou.com/category/tachi/',
    'https://www.goushuya-nihontou.com/category/wakizashi/',
    'https://www.goushuya-nihontou.com/category/article-type/tsuba/',
    'https://www.goushuya-nihontou.com/category/margin/',  # Fuchi-kashira
]
```

**Pagination handling:**
- Check for WordPress pagination (`/page/2/`, `/page/3/`)
- Or `?paged=2` query parameter
- Stop when no more items found

**URL extraction from category pages:**
```python
# Links to individual product pages
PRODUCT_LINK_PATTERN = r'href="(https://www\.goushuya-nihontou\.com/(?:sword|tsuba|koshirae)/[^"]+)"'
```

---

## Data Quality Considerations

### 1. Price Handling

```python
def _extract_price_from_page(self, soup, listing):
    """
    Handle variable price availability.
    Some items show price, others require contact.
    """
    # Look for ¥XXX,XXX pattern
    price_match = re.search(r'[¥￥]\s*([\d,]+)', page_text)
    if price_match:
        listing.price_value = float(price_match.group(1).replace(',', ''))
        listing.price_currency = 'JPY'
    else:
        # No price - leave as None (contact required)
        listing.price_value = None
        listing.is_available = True  # Still available, just contact-based
```

### 2. Item Type Detection

```python
ITEM_TYPE_MAP = {
    '/sword/': ItemType.KATANA,  # Default for sword category
    '/tsuba/': ItemType.TSUBA,
    '/koshirae/': ItemType.KOSHIRAE,
}

# Also check title for specifics
TITLE_TYPE_PATTERNS = {
    '太刀': ItemType.TACHI,
    '刀': ItemType.KATANA,
    '脇差': ItemType.WAKIZASHI,
    '短刀': ItemType.TANTO,
    '鐔': ItemType.TSUBA,
    '縁頭': ItemType.FUCHI_KASHIRA,
}
```

### 3. Sold Status Detection

Goushuya doesn't appear to keep sold items online. Monitor for:
- 404 responses (item removed)
- "売約済" or "SOLD" text
- Category changes (moved to sold archive)

### 4. LLM Extraction Enhancement

The base scraper uses LLM (Gemini Flash) for primary extraction. For Goushuya:
- LLM handles Japanese text well
- Fallback regex for structured specs
- Images extracted via regex (LLM doesn't handle images)

---

## Test Cases

### 1. Sword Page with No Price
```
URL: https://www.goushuya-nihontou.com/sword/1381/
Expected:
- title: "特別保存刀剣 刀銘 水心子正次（花押）天保十二年仲春"
- item_type: KATANA
- certification.type: "Tokubetsu Hozon"
- specs.nagasa_cm: 69.2
- specs.sori_cm: 1.6
- price_value: None (contact required)
- images: 1 image
```

### 2. Tsuba Page with Price
```
URL: https://www.goushuya-nihontou.com/tsuba/老松図透鐔/
Expected:
- title: "老松図透鐔"
- item_type: TSUBA
- tosogu_specs.height_cm: 8.2
- tosogu_specs.width_cm: 8.2
- tosogu_specs.thickness_mm: 5.0
- certification.type: "Hozon Tosogu"
- price_value: 130000
- price_currency: "JPY"
- images: 2 images (front/back)
```

### 3. Category Discovery
```
URL: https://www.goushuya-nihontou.com/sword/
Expected:
- Discover N product URLs
- Handle pagination if present
- Filter out non-product links
```

---

## Implementation Checklist

### Scraper Core
- [ ] Create `scrapers/goushuya.py`
- [ ] Implement `GoushuyaScraper` class
- [ ] Register with `@ScraperRegistry.register`
- [ ] Define `DEALER_NAME = "Goushuya"`
- [ ] Define `DOMAINS = ["goushuya-nihontou.com"]`

### Data Extraction
- [ ] `_extract_data()` main method
- [ ] `_extract_title()` from h1/WordPress
- [ ] `_extract_specs()` for swords (cm format)
- [ ] `_extract_tosogu_specs()` for fittings (mm format)
- [ ] `_extract_price_from_page()` with fallback to None
- [ ] `_extract_certification()` with date parsing
- [ ] `_extract_product_images()` from WordPress media
- [ ] `_detect_item_type()` from URL and title
- [ ] `_check_sold()` for sold indicators

### Testing
- [ ] Create `tests/scrapers/test_goushuya.py`
- [ ] Test sword page extraction
- [ ] Test tsuba page extraction
- [ ] Test price-less items
- [ ] Test category discovery
- [ ] Test URL-encoded Japanese slugs

### Database Integration
- [ ] Add dealer to `dealers` table:
  ```sql
  INSERT INTO dealers (name, domain, catalog_url, is_active, country)
  VALUES ('Goushuya', 'goushuya-nihontou.com',
          'https://www.goushuya-nihontou.com/sword/', true, 'JP');
  ```

### Discovery System
- [ ] Implement category page crawler
- [ ] Handle WordPress pagination
- [ ] Store discovered URLs in `discovered_urls` table
- [ ] Set appropriate `scrape_priority`

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing prices | Medium | Accept None, mark as "contact for price" |
| URL encoding issues | Low | Use `urllib.parse.unquote` for Japanese slugs |
| Limited inventory | Low | Site appears to have modest inventory (~50-100 items) |
| No sold archive | Low | 404 tracking handles removed items |
| Elementor dynamic content | Medium | Content appears in HTML, not JS-rendered |

---

## Success Metrics

1. **Extraction accuracy > 95%** for structured fields (title, specs, certification)
2. **Price extraction** where available (estimated ~50% of listings)
3. **Zero false sold detections** (no items incorrectly marked sold)
4. **Complete image capture** (all product images extracted)
5. **Full catalog discovery** (all categories crawled)

---

## Cross-Validation Results

| Field | WebFetch Analysis | Manual Verification | Status |
|-------|-------------------|---------------------|--------|
| Title | ✅ Extracted | - | Verified |
| Specs (sword) | ✅ 69.2cm, 1.6cm, etc. | - | Verified |
| Specs (tsuba) | ✅ 82mm × 82mm | - | Verified |
| Price (tsuba) | ✅ ¥130,000 | - | Verified |
| Price (sword) | ❌ Not present | Expected | Verified |
| Certification | ✅ 特別保存刀剣 | - | Verified |
| Images | ✅ wp-content URLs | - | Verified |
| Sold status | ⚠️ No indicators seen | Expected | Verified |

---

## Notes

1. **Low inventory volume:** Goushuya appears to maintain a small but high-quality inventory. Expect ~50-100 active listings.

2. **Contact-based sales model:** The dealer prefers personal consultation for sales, especially for higher-value swords. Price display is selective.

3. **Regional dealer:** Based in Shiga Prefecture, not Tokyo. May have different inventory profile than major Tokyo dealers.

4. **Quality focus:** Listings emphasize certification and provenance. Good source for certified (Hozon/Tokubetsu Hozon) items.
