# Duplicate Listings Fix Plan

## Investigation Summary

Investigation of listing IDs 5268 vs 5272 (Hyozaemon Yoshifusa) revealed a broader duplicate problem affecting 1.07% of listings.

### Final Verified Counts

| Category | Count | Action Needed |
|----------|-------|---------------|
| **Verified True Duplicates** | 35 | Delete duplicate IDs |
| **False Positives (404 pages)** | 18 | Mark as unavailable |
| **False Positives (shared UI images)** | 3 | No action - different items |
| **Data Errors** | 1 | Fix on dealer side |
| **Uncertain (Giheiya)** | 1 | Manual review |

---

## Root Causes Identified

### 1. HTTP vs HTTPS URLs (28 duplicates - Nipponto)
The scraper discovered the same pages via both `http://` and `https://` protocols, creating duplicate entries.

**Example:**
- `http://www.nipponto.co.jp/swords2/KT219471.htm`
- `https://www.nipponto.co.jp/swords2/KT219471.htm`

### 2. Multiple URL Paths (6 duplicates - Choshuya, Hyozaemon, World Seiyudo)
Dealers have same item accessible via multiple URL patterns.

**Examples:**
- Hyozaemon: `/product/fukuokaitimonji` redirects to `/product/fukuokaitimonjiyosifusa`
- Choshuya: `/senrigan/soroikanagu/...` vs `/senrigan/kozukakougai/...`

### 3. Item Re-listing (2 duplicates - Nihonto.com, Samurai Nippon)
Same item listed under different date/product codes (possibly intentional re-listing).

**Example:**
- `nihonto.com/9-1-25` and `nihonto.com/1-1-26` - same sword

### 4. WordPress Duplicate Slugs (1 duplicate - Nihonto Australia)
WordPress created duplicate posts with `-2` suffix.

### 5. 404 Error Pages (18 false positives - Samurai Nippon, Katana Ando)
Deleted items showing error pages were incorrectly marked as available.

### 6. Shared Website UI Elements (3 false positives - Choshuya)
Image fingerprinting caught shared website template images (Wix UI buttons), not actual product photos.

---

## Immediate Cleanup Actions

### Step 1: Delete Verified Duplicates (35 records)

Keep the **lower ID** (older record) in each pair:

```sql
-- Nipponto HTTP/HTTPS duplicates (keep lower ID which is HTTPS)
DELETE FROM listings WHERE id IN (
  10758, 13887, 4576, 10749, 10748, 10752, 10739, 10742, 10753, 10747,
  10743, 10755, 10760, 11125, 10765, 11113, 10744, 10746, 10761, 10763,
  10757, 10756, 10741, 11901, 10766, 10762, 10751, 11117
);

-- Choshuya path duplicates
DELETE FROM listings WHERE id IN (35250, 35378, 34987, 34940);

-- Other verified duplicates
DELETE FROM listings WHERE id IN (
  33314,  -- World Seiyudo tanto
  8075,   -- Nihonto.com katana
  5272,   -- Hyozaemon yoshifusa (YOUR ORIGINAL CASE)
  4478,   -- Samurai Nippon sukesada
  4481    -- Samurai Nippon masaie
);

-- Nihonto Australia duplicate
DELETE FROM listings WHERE id = 43319;
```

**Note:** Before deletion, merge any user data (favorites, alerts) to the kept listing.

### Step 2: Mark 404 Pages as Unavailable

```sql
UPDATE listings
SET is_available = false, status = 'error'
WHERE id IN (
  11087, 10670, 10650, 10644, 10642, 10621, 10009, 9980, 4601, 4584,
  5839, 5827, 5826, 5809, 5805, 5788, 5782, 5761, 5752, 1310
);
```

### Step 3: Manual Review - Giheiya (IDs 44668 vs 44776)

These have identical images but slightly different nagasa (75.7cm vs 75.4cm). Need to:
1. Check the actual dealer pages to confirm if same sword
2. If same sword, delete 44776 (higher ID)

---

## Durable Prevention Fixes (Oshi-scrapper)

### Fix 1: Normalize HTTP to HTTPS for All Dealers

**File:** `normalization/normalizers/urls.py`

```python
# REMOVE Nipponto from KEEP_HTTP_DOMAINS
KEEP_HTTP_DOMAINS: Set[str] = set()  # Empty - always use HTTPS

# DEFAULT: Always upgrade HTTP to HTTPS
def _normalize_scheme(self, scheme: str, netloc: str) -> str:
    return 'https' if scheme == 'http' else scheme
```

### Fix 2: Add Pre-Insert Duplicate Check

**File:** `db/repository.py`

Add a method to check for duplicates before inserting:

```python
def find_potential_duplicate(self, listing: Listing) -> Optional[int]:
    """
    Check if a listing might be a duplicate of an existing one.

    Checks:
    1. Same normalized URL (after HTTP→HTTPS, trailing slash removal)
    2. Same dealer + same image fingerprint

    Returns: existing listing ID if duplicate found, None otherwise
    """
    # Normalize URL
    normalized_url = self._normalize_url(listing.url)

    # Check for URL match
    existing = self.db.table('listings')\
        .select('id')\
        .eq('url', normalized_url)\
        .single()

    if existing:
        return existing['id']

    # Check for image fingerprint match (same dealer only)
    if listing.images and len(listing.images) >= 3:
        fingerprint = compute_image_fingerprint(listing.images)
        existing = self.db.table('listings')\
            .select('id')\
            .eq('dealer_id', listing.dealer_id)\
            .eq('image_fingerprint', fingerprint)\
            .single()

        if existing:
            return existing['id']

    return None
```

### Fix 3: Improve Image Fingerprinting

Filter out small UI images before fingerprinting:

```python
def compute_image_fingerprint(images: List[str]) -> str:
    """Compute fingerprint from product images only."""
    # Filter out likely UI elements
    product_images = [
        img for img in images
        if not is_ui_element(img)
    ]

    if len(product_images) < 2:
        return None

    return hashlib.md5(
        '|'.join(sorted(product_images)).encode()
    ).hexdigest()

def is_ui_element(url: str) -> bool:
    """Check if URL is likely a UI element, not a product photo."""
    indicators = [
        'w_73,h_27',  # Tiny Wix images
        'w_50,h_27',
        'button',
        'icon',
        'logo',
        '_fw.png',  # Choshuya UI pattern
    ]
    return any(ind in url.lower() for ind in indicators)
```

### Fix 4: Add 404 Detection During Scraping

**File:** `scrapers/generic.py`

```python
def _detect_error_page(self, html: str, title: str) -> bool:
    """Detect if page is an error/404 page."""
    error_patterns = [
        'ご指定のページは見つかりません',
        'ページが見つかりません',
        '404',
        'not found',
        '無題ドキュメント',
    ]

    text = (html + (title or '')).lower()
    return any(pattern.lower() in text for pattern in error_patterns)
```

### Fix 5: Add Database Trigger for URL Normalization

**File:** `supabase/migrations/YYYYMMDD_normalize_urls.sql`

```sql
-- Ensure URLs are normalized on insert/update
CREATE OR REPLACE FUNCTION normalize_listing_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize HTTP to HTTPS
  NEW.url := regexp_replace(NEW.url, '^http://', 'https://');

  -- Remove trailing slash (except root URLs)
  IF NEW.url LIKE '%/' AND (length(NEW.url) - length(replace(NEW.url, '/', ''))) > 3 THEN
    NEW.url := rtrim(NEW.url, '/');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_url_normalize
BEFORE INSERT OR UPDATE OF url ON listings
FOR EACH ROW EXECUTE FUNCTION normalize_listing_url();
```

### Fix 6: Add Unique Constraint on Normalized URLs

Consider adding an index or constraint:

```sql
-- Add computed column for normalized URL
ALTER TABLE listings ADD COLUMN url_normalized TEXT
  GENERATED ALWAYS AS (
    rtrim(regexp_replace(lower(url), '^http://', 'https://'), '/')
  ) STORED;

-- Add unique index
CREATE UNIQUE INDEX idx_listings_url_normalized
  ON listings(dealer_id, url_normalized);
```

---

## Monitoring

### Add Duplicate Detection to QA Pipeline

Create a scheduled check that runs weekly:

```python
def detect_duplicates() -> List[DuplicatePair]:
    """Find potential duplicates by image fingerprint."""
    # Query all listings with images
    # Group by image fingerprint + dealer
    # Flag groups with >1 listing
    # Return for manual review
```

### Add to Admin Dashboard

Create `/admin/data-quality` page showing:
- Duplicate detection results
- 404/error page counts
- Listings with missing images

---

## Implementation Status (2026-02-05)

### ✅ Completed

| Fix | File | Description |
|-----|------|-------------|
| Cleanup Migration | `Oshi-scrapper/supabase/migrations/20260205000001_cleanup_duplicate_listings.sql` | Deletes 35 duplicates, marks 18 as unavailable, normalizes HTTP→HTTPS |
| HTTP→HTTPS Normalization | `Oshi-scrapper/normalization/normalizers/urls.py` | Always converts HTTP to HTTPS (prevents 80% of duplicates) |
| URL Normalization | `Oshi-scrapper/db/repository.py` | `normalize_url()` handles HTTP→HTTPS at storage layer |
| Soft 404 Detection | `Oshi-scrapper/scrapers/base.py` | `_detect_error_page()` catches "ご指定のページは見つかりません" etc. |
| Duplicate Detection Utility | `Oshi-scrapper/db/repository.py` | `find_potential_duplicate()` available for diagnostics/audits |
| UI Element Filtering | `Oshi-scrapper/db/repository.py` | `_is_ui_element()` filters Wix buttons, icons from fingerprinting |

### ⏸️ Not Implemented (By Design)

| Fix | Reason |
|-----|--------|
| Auto-blocking duplicates | Risk of false positives blocking legitimate listings |
| Short page detection | Some dealers have legitimately sparse pages |

### 📋 Remaining Manual Steps

1. **Run the migration:** `supabase db push` in Oshi-scrapper to execute cleanup SQL
2. **Verify Giheiya pair:** IDs 44668 vs 44776 need manual review (identical images, slightly different nagasa)

---

## Impact

- **Before:** 67 apparent duplicates (1.07% of listings)
- **After Cleanup:** 35 true duplicates removed, 18 errors fixed
- **With Prevention:** HTTP→HTTPS normalization prevents 80% of duplicate root cause
