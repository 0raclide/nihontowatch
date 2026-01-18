# CRITICAL: Content Change Detection & Product Identity

**Priority:** 🔴 HIGH - Data Integrity Issue
**Status:** Research Complete, Implementation Required
**Date:** January 18, 2026
**Affects:** Oshi-scrapper, Nihontowatch database schema

---

## Executive Summary

We have identified a fundamental flaw in our data model: **URLs are not stable identifiers for nihonto listings.** Approximately 50% of dealers reuse URLs when items sell, meaning:

1. We miss new inventory (no "new item" detection)
2. We show stale data (old item info on pages with new items)
3. We cannot track item history or sale dates
4. Our freshness data is unreliable

**This document proposes a Product/Listing architecture with image-based change detection.**

---

## Problem Statement

### Current State (Broken)

```
URL ──────► Listing (1:1)
            └── We update the same record when content changes
```

When dealer replaces sold Kotetsu katana with new Kiyomaro at same URL:
- We overwrite Kotetsu data with Kiyomaro data
- No record that Kotetsu existed or sold
- No "new listing" alert for Kiyomaro
- Freshness shows Kiyomaro listed since Kotetsu's date

### Evidence

From our Wayback validation study (18 dealers, 66 verified comparisons):
- **50% overall URL reuse rate**
- katana-ando.co.jp: 100% reuse
- eirakudo.shop: 70% reuse (even with numeric IDs!)
- samurai-nippon.net: 50% reuse

**Implication: We may be missing ~50% of new inventory.**

---

## Constraints & Challenges

### 1. Limited Product Identifiers

| Certification Level | Has Unique ID? | % of Market |
|---------------------|----------------|-------------|
| Juyo Token | ✅ Session + Number | ~5% |
| Tokubetsu Juyo | ✅ Session + Number | <1% |
| Tokubetsu Hozon | ⚠️ Paper number (inconsistent) | ~15% |
| Hozon | ⚠️ Paper number (inconsistent) | ~20% |
| NTHK | ⚠️ Varies | ~10% |
| Uncertified | ❌ None | ~50% |

**Reality: Only ~5-10% of listings have truly reliable unique identifiers.**

### 2. Measurement Unreliability

Dealers may:
- Round differently (71.2cm vs 71.5cm vs 71cm)
- Omit measurements entirely
- Use different units (cm vs shaku)
- Copy-paste errors
- Approximate values

**Measurement-based fingerprinting will have false negatives.**

Example: Same sword listed as:
- Dealer A: nagasa 71.2cm, sori 1.8cm
- Dealer B: nagasa 71.5cm, sori 1.9cm
- Hash comparison: DIFFERENT (but actually same sword)

### 3. Title Variations

Same sword, different titles:
- "Kotetsu Katana - Juyo Token"
- "刀 虎徹 重要刀剣"
- "Nagasone Kotetsu, Juyo #45-123"

**Title-based fingerprinting will have false negatives.**

### 4. The Only Reliable Signal: Images

Images cannot be "misreported." A photo is physical evidence.

| Signal | Reliability | Coverage |
|--------|-------------|----------|
| Certification # | 🟢 High | ~10% |
| Measurements | 🟡 Medium | ~60% |
| Title | 🟡 Medium | ~95% |
| **Images** | 🟢 High | ~99% |

**Image perceptual hashing is our best option for content change detection.**

---

## Proposed Architecture

### Data Model: Product + Listing Separation

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCT                                  │
│                   (The Physical Sword)                          │
├─────────────────────────────────────────────────────────────────┤
│ id: UUID                                                        │
│ canonical_cert: "Juyo-45-123" (nullable)                       │
│ primary_image_phash: "abc123..." (64-bit perceptual hash)      │
│ created_at: timestamp                                           │
│ confidence: HIGH/MEDIUM/LOW (how sure are we this is one item) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:many
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         LISTING                                  │
│              (A Dealer's Page for a Product)                    │
├─────────────────────────────────────────────────────────────────┤
│ id: serial                                                      │
│ product_id: FK → Product (nullable until matched)              │
│ url: string                                                     │
│ dealer_id: FK → Dealer                                         │
│ ─────────────────────────────────────────────────────────────── │
│ first_seen_at: timestamp                                        │
│ last_seen_at: timestamp                                         │
│ status: AVAILABLE / SOLD / REPLACED / WITHDRAWN                │
│ ─────────────────────────────────────────────────────────────── │
│ content_fingerprint: hash (for change detection)               │
│ main_image_phash: 64-bit perceptual hash                       │
│ ─────────────────────────────────────────────────────────────── │
│ title, description, price, measurements, images, etc.          │
│ ─────────────────────────────────────────────────────────────── │
│ replaces_listing_id: FK → Listing (URL reuse chain)           │
│ replaced_by_listing_id: FK → Listing                           │
│ replaced_at: timestamp                                          │
└─────────────────────────────────────────────────────────────────┘
```

### URL Reuse Chain Example

```
URL: dealer.com/katana/katana-kotetsu

Listing #1001                    Listing #1456                    Listing #1789
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ Kotetsu Katana   │  REPLACED  │ Kiyomaro Katana  │  REPLACED  │ Sukehiro Katana  │
│ Jan-Jun 2024     │ ─────────► │ Jun-Dec 2024     │ ─────────► │ Dec 2024-present │
│ phash: aaa111    │            │ phash: bbb222    │            │ phash: ccc333    │
│ status: REPLACED │            │ status: REPLACED │            │ status: AVAILABLE│
│ product_id: P001 │            │ product_id: P002 │            │ product_id: P003 │
└──────────────────┘            └──────────────────┘            └──────────────────┘
         │                               │                               │
         ▼                               ▼                               ▼
    Product P001                   Product P002                   Product P003
    (Kotetsu)                      (Kiyomaro)                     (Sukehiro)
```

---

## Image-Based Change Detection

### Perceptual Hashing (pHash)

Perceptual hashing creates a compact fingerprint of an image that:
- Survives resizing, compression, minor crops
- Different images → very different hash (Hamming distance > 20)
- Similar images → similar hash (Hamming distance < 10)

```python
from PIL import Image
import imagehash

def compute_phash(image_url: str) -> str:
    """Compute 64-bit perceptual hash of image."""
    response = requests.get(image_url, timeout=10)
    img = Image.open(BytesIO(response.content))
    return str(imagehash.phash(img))  # Returns 16-char hex string

def images_similar(hash1: str, hash2: str, threshold: int = 15) -> bool:
    """Check if two images are perceptually similar."""
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    distance = h1 - h2  # Hamming distance (0-64)
    return distance <= threshold
```

### Detection Logic

```python
def detect_content_change(stored_listing, current_content) -> ChangeResult:
    """
    Determine if URL content has changed to a different item.

    Returns: SAME_ITEM, DIFFERENT_ITEM, or UNCERTAIN
    """

    # 1. Image comparison (PRIMARY signal)
    if stored_listing.main_image_phash and current_content.main_image:
        current_phash = compute_phash(current_content.main_image)
        distance = hamming_distance(stored_listing.main_image_phash, current_phash)

        if distance > 25:
            # Images completely different → HIGH confidence different item
            return ChangeResult.DIFFERENT_ITEM, "high", f"Image distance: {distance}"

        if distance < 10:
            # Images very similar → Likely same item
            return ChangeResult.SAME_ITEM, "high", f"Image distance: {distance}"

    # 2. Certification number (if available)
    if stored_listing.cert_number and current_content.cert_number:
        if stored_listing.cert_number != current_content.cert_number:
            return ChangeResult.DIFFERENT_ITEM, "high", "Cert number changed"
        else:
            return ChangeResult.SAME_ITEM, "high", "Cert number matches"

    # 3. Title comparison (SECONDARY signal)
    title_similarity = jaccard_similarity(stored_listing.title, current_content.title)

    if title_similarity < 0.2:
        # Titles completely different
        return ChangeResult.DIFFERENT_ITEM, "medium", f"Title similarity: {title_similarity}"

    # 4. Measurement comparison (TERTIARY signal, with tolerance)
    if stored_listing.nagasa and current_content.nagasa:
        nagasa_diff = abs(stored_listing.nagasa - current_content.nagasa)
        if nagasa_diff > 2.0:  # More than 2cm different
            return ChangeResult.DIFFERENT_ITEM, "medium", f"Nagasa diff: {nagasa_diff}cm"

    # 5. Uncertain - flag for review
    return ChangeResult.UNCERTAIN, "low", "Insufficient signals"
```

### Thresholds

| Signal | Same Item | Different Item | Uncertain |
|--------|-----------|----------------|-----------|
| Image pHash distance | < 10 | > 25 | 10-25 |
| Title Jaccard | > 0.6 | < 0.2 | 0.2-0.6 |
| Nagasa difference | < 0.5cm | > 2cm | 0.5-2cm |
| Cert number | Matches | Different | N/A |

---

## Certificate Image Extraction (Alternative Approach)

### Concept

Many dealers photograph NBTHK certification documents alongside their swords. These certificates contain **unique identifiers** that can serve as product fingerprints:

- **Juyo Token**: Session number + Item number (e.g., "第四十五回" → Juyo-45)
- **Tokubetsu Hozon/Hozon**: Document number (e.g., 019170, 1023264)
- **NTHK**: Paper number

**Key insight:** Different photos of the same certificate will yield the same extracted ID, providing a reliable product identifier even when dealers use different photography.

### Feasibility Test Results (January 2026)

We tested certificate detection on **15 known certificate images** (identified by "paper" in filename):

| Metric | Result |
|--------|--------|
| Correctly identified as certificate | 60% (9/15) |
| Cert type identified | 67% (10/15) |
| Full cert ID extracted | 20% (3/15) |
| Session number extracted | 13% (2/15) |
| Smith name extracted | 73% (11/15) |

**Sample extractions:**
```
Listing 1345: Juyo-45 (session 45, smith: 河内守長藤原国助)
Listing 140:  019170 (TokuHozon document number)
Listing 58:   1023264 (TokuHozon document number)
```

### Dealer Certificate Photography Patterns

| Dealer | Images with "paper" | Convention |
|--------|---------------------|------------|
| aoijapan.com | 133 | `{item_id}paper-1.jpg`, `{item_id}paper-2.jpg` |
| nihontoart.com | 7 | `{name}-Kanteisho.jpeg` |
| Other dealers | Unknown | No clear pattern - visual detection required |

**Key finding:** aoijapan.com uses predictable filenames, enabling targeted certificate detection.

### Certificate Detection Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: Quick Filters (No API cost)                       │
├─────────────────────────────────────────────────────────────┤
│ • URL pattern: filename contains "paper", "cert", etc.     │
│ • Image aspect ratio: certificates are typically ~1.4:1    │
│ • Position: often last images in gallery                   │
└────────────────────────────┬────────────────────────────────┘
                             │ Candidates
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: LLM Vision Analysis                               │
├─────────────────────────────────────────────────────────────┤
│ • Certificate detection: is_certificate? confidence        │
│ • Type identification: juyo, tokubetsu_hozon, hozon, etc.  │
│ • ID extraction: session + item number OR document number  │
│ • Smith name: attribution from certificate                 │
└────────────────────────────┬────────────────────────────────┘
                             │ Extracted Data
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: Store & Index                                     │
├─────────────────────────────────────────────────────────────┤
│ • cert_id: normalized identifier (e.g., "NBTHK-J-45-123")  │
│ • cert_type: standardized enum                             │
│ • cert_image_url: reference to certificate photo           │
│ • Link to product_id for cross-dealer matching             │
└─────────────────────────────────────────────────────────────┘
```

### Visual Indicators for Certificate Detection

Certificates have distinctive visual characteristics:

1. **Red circular seal** (印) - pathognomonic for NBTHK papers
2. **Rectangular document format** - landscape or portrait paper
3. **Japanese vertical text** - formal document layout
4. **Keywords visible**: 重要刀剣, 特別保存, 保存刀剣, 鑑定書

### Limitations

1. **Coverage**: Only ~35% of listings have certificates, and only subset photograph them
2. **Image quality**: Poor photos reduce OCR accuracy
3. **API cost**: Vision API calls add expense (~$0.01/image)
4. **Hozon/TokuHozon numbers**: Not as standardized as Juyo session/item format

### Recommendation

**Use certificate extraction as a complement to image hashing, not a replacement:**

| Approach | Coverage | Reliability | Cost |
|----------|----------|-------------|------|
| Image pHash | ~99% | High | Compute only |
| Certificate extraction | ~10-15% | Very High (when extracted) | API calls |

**Implementation priority:**
1. ✅ Image pHash for all listings (primary change detection)
2. ⬜ Certificate extraction for certified items (product identification)
3. ⬜ Cross-reference both for highest confidence matching

---

## Implementation Plan

### Phase 1: Schema Migration

```sql
-- Add image hash columns
ALTER TABLE listings ADD COLUMN main_image_phash VARCHAR(16);
ALTER TABLE listings ADD COLUMN content_fingerprint VARCHAR(32);

-- Add URL reuse tracking
ALTER TABLE listings ADD COLUMN replaces_listing_id INTEGER REFERENCES listings(id);
ALTER TABLE listings ADD COLUMN replaced_by_listing_id INTEGER REFERENCES listings(id);
ALTER TABLE listings ADD COLUMN replaced_at TIMESTAMPTZ;

-- Add REPLACED status to enum (if not exists)
-- Depends on how status is implemented

-- Index for finding similar images
CREATE INDEX idx_listings_phash ON listings(main_image_phash) WHERE main_image_phash IS NOT NULL;

-- Products table (Phase 2)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_cert VARCHAR(100),
    primary_image_phash VARCHAR(16),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confidence VARCHAR(20) DEFAULT 'low'
);

ALTER TABLE listings ADD COLUMN product_id UUID REFERENCES products(id);
```

### Phase 2: Backfill Image Hashes

For all existing listings with images:
1. Fetch main image
2. Compute pHash
3. Store in `main_image_phash`

```python
async def backfill_image_hashes():
    listings = await db.query("SELECT id, images FROM listings WHERE main_image_phash IS NULL AND images IS NOT NULL")

    for listing in listings:
        if listing.images and len(listing.images) > 0:
            try:
                phash = compute_phash(listing.images[0])
                await db.execute(
                    "UPDATE listings SET main_image_phash = $1 WHERE id = $2",
                    phash, listing.id
                )
            except Exception as e:
                log.warning(f"Failed to hash image for listing {listing.id}: {e}")

        await asyncio.sleep(0.1)  # Rate limit
```

**Estimated time:** ~4000 listings × 0.5s/image = ~33 minutes

### Phase 3: Audit Existing URLs (Critical)

Re-scrape all existing URLs and compare against stored data:

```python
async def audit_existing_listings():
    """
    One-time audit to detect past content changes.
    """
    listings = await db.query("""
        SELECT * FROM listings
        WHERE status = 'available'
        ORDER BY first_seen_at
    """)

    changes_detected = []

    for listing in listings:
        try:
            current = await scrape_url(listing.url)

            if current.page_exists:
                result, confidence, reason = detect_content_change(listing, current)

                if result == ChangeResult.DIFFERENT_ITEM:
                    changes_detected.append({
                        'listing_id': listing.id,
                        'url': listing.url,
                        'confidence': confidence,
                        'reason': reason,
                        'stored_title': listing.title,
                        'current_title': current.title,
                    })

        except Exception as e:
            log.warning(f"Audit failed for {listing.url}: {e}")

        await asyncio.sleep(1)  # Be nice to dealers

    return changes_detected
```

**Output:** List of URLs where content has changed since we stored it.

### Phase 4: Update Scraper Pipeline

Modify Oshi-scrapper to detect changes on every scrape:

```python
async def scrape_listing(url: str) -> Listing:
    current = await fetch_and_extract(url)
    existing = await db.get_listing_by_url(url)

    if existing and existing.status == 'available':
        # Compare content
        change_result, confidence, reason = detect_content_change(existing, current)

        if change_result == ChangeResult.DIFFERENT_ITEM:
            # URL REUSE DETECTED!
            log.info(f"Content change at {url}: {reason}")

            # Mark old listing as replaced
            existing.status = 'REPLACED'
            existing.replaced_at = datetime.utcnow()
            await db.save(existing)

            # Create new listing
            new_listing = create_listing_from_content(current)
            new_listing.replaces_listing_id = existing.id
            new_listing.main_image_phash = compute_phash(current.images[0]) if current.images else None
            await db.save(new_listing)

            # Link chain
            existing.replaced_by_listing_id = new_listing.id
            await db.save(existing)

            # Alert!
            await notify_new_item_detected(new_listing, replaced=existing)

            return new_listing

        else:
            # Same item, update mutable fields
            existing.price = current.price
            existing.last_scraped_at = datetime.utcnow()
            await db.save(existing)
            return existing

    else:
        # New URL or reactivated listing
        new_listing = create_listing_from_content(current)
        new_listing.main_image_phash = compute_phash(current.images[0]) if current.images else None
        await db.save(new_listing)
        await notify_new_item_detected(new_listing)
        return new_listing
```

---

## Risk Assessment

### False Positives (Detecting change when same item)

| Cause | Likelihood | Mitigation |
|-------|------------|------------|
| Dealer re-photographs item | Medium | Use pHash threshold of 15-20, not 5 |
| Image crop/resize | Low | pHash handles this |
| Different image selected as "main" | Medium | Hash first 2-3 images, compare any match |
| Title reformatted | Medium | Normalize titles before comparison |

**Impact:** Creates duplicate listing records for same item. Annoying but not data loss.

### False Negatives (Missing actual changes)

| Cause | Likelihood | Mitigation |
|-------|------------|------------|
| Same stock photo reused | Low | Cross-reference with title/measurements |
| Very similar swords | Very Low | Cert numbers when available |
| No images available | Medium | Fall back to title + measurement comparison |

**Impact:** Miss detecting a new item. Continues the current broken behavior.

### Recommended Approach

Start conservative (favor false positives over false negatives):
- Image distance > 20 → DIFFERENT
- Image distance < 12 → SAME
- 12-20 → Check secondary signals

We can tune thresholds after seeing real-world results.

---

## Metrics & Monitoring

Track these metrics:

```sql
-- Content changes detected per day
SELECT DATE(replaced_at), COUNT(*)
FROM listings
WHERE replaced_at IS NOT NULL
GROUP BY DATE(replaced_at);

-- Changes by dealer (who reuses URLs most?)
SELECT d.name, COUNT(*) as changes
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
WHERE l.replaced_at IS NOT NULL
GROUP BY d.name
ORDER BY changes DESC;

-- False positive rate (manual review sample)
-- Periodically review random sample of "DIFFERENT" verdicts
```

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Schema migration | Low | 1 day |
| Backfill image hashes | Low | 1 day (mostly automated) |
| Audit existing URLs | Medium | 2-3 days |
| Update scraper pipeline | Medium | 2-3 days |
| Testing & tuning | Medium | 2-3 days |
| **Total** | | **~2 weeks** |

---

## Open Questions

1. **Product entity creation:** When do we create a Product record vs just a Listing?
   - Option A: Every listing gets a Product (1:1 initially)
   - Option B: Only create Product when we have high-confidence identity (cert number)
   - Option C: Products created through matching algorithm (cluster similar listings)

2. **Cross-dealer matching:** Same sword at multiple dealers?
   - Could use pHash to find similar images across dealers
   - Valuable for collectors, but complex to implement
   - Phase 2 feature?

3. **Historical data:** What about changes that happened before we implement this?
   - The audit will detect current mismatches
   - We can't recover history of past changes
   - Accept this limitation

4. **Wayback integration:** Should we still use Wayback at all?
   - Recommendation: Deprecate for freshness
   - Maybe keep for one-time historical research
   - Not worth the complexity for ongoing operation

---

## Appendix: Image Hash Libraries

### Python (Oshi-scrapper)

```python
# Install: pip install imagehash pillow

from PIL import Image
import imagehash
import requests
from io import BytesIO

def compute_phash(image_url: str) -> str | None:
    try:
        response = requests.get(image_url, timeout=15)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        return str(imagehash.phash(img))
    except Exception:
        return None

def hash_distance(hash1: str, hash2: str) -> int:
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return h1 - h2
```

### JavaScript/TypeScript (Nihontowatch)

```typescript
// Install: npm install sharp phash-image

import sharp from 'sharp';
import { hash } from 'phash-image';

async function computePhash(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const normalized = await sharp(Buffer.from(buffer))
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    return hash(normalized).toString('hex');
  } catch {
    return null;
  }
}
```

---

## Appendix: Certificate Detection Test Scripts

The following scripts were created to validate the certificate extraction approach:

### Find Certificate Images by URL Pattern

```bash
node scripts/find-cert-images.mjs
```

Searches database for image URLs containing keywords like "paper", "cert", "kanteisho".

### Test Certificate Extraction on Known Certificates

```bash
node scripts/test-known-certificates.mjs
```

Tests LLM-based extraction on images known to be certificates (via filename pattern).
Results saved to `certificate-detection-results/`.

### General Certificate Detection Test

```bash
node scripts/certificate-detection-test.mjs --sample 20 [--dealer DOMAIN]
```

Tests both detection (is it a certificate?) and extraction (what's the ID?) on random listings.

---

## Conclusion

**This is a mission-critical fix.** Without content change detection:
- We miss ~50% of new inventory
- Our data becomes increasingly stale
- Freshness indicators are meaningless
- Collectors can't trust our "days listed" data

**Image perceptual hashing** is the most reliable signal given our constraints (limited product IDs, unreliable measurements).

**Recommended next step:** Implement Phase 1-2 (schema + backfill) in Oshi-scrapper, then run the audit to quantify how much content has already changed.

---

*Document created: January 18, 2026*
*Priority: 🔴 HIGH*
*Owner: TBD*
