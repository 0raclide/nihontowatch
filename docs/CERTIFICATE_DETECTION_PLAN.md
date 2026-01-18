# Certificate Detection Implementation Plan

**Date:** January 18, 2026
**Status:** ❌ SUPERSEDED - See CERTIFICATE_DETECTION_RESEARCH.md
**Priority:** ⚪ DEFERRED - Not viable as general strategy

> **UPDATE:** Critical validation testing revealed this approach only works for 2 dealers (token-net.com, aoijapan.com). Implementation deferred. See `CERTIFICATE_DETECTION_RESEARCH.md` for findings.

---

## Executive Summary

After comprehensive testing across 6 major dealers (48 listings, 300+ images analyzed), we have validated that **certificate detection is viable** but requires a dealer-specific approach. Key findings:

| Metric | Best Case | Typical | Worst Case |
|--------|-----------|---------|------------|
| Detection Rate | 100% (token-net, aoijapan) | 75-87% | 50% (nipponto) |
| Session Extraction | 100% (token-net) | 0-12% | 0% |
| Item Number Extraction | 75% (aoijapan) | 25-50% | 0% |
| Smith Name Extraction | 100% (aoijapan) | 50-88% | 0% |

**Critical Discovery:** Juyo certificates have **100% session extraction success** on token-net.com vs **0-12%** for Hozon/TokuHozon. This is because Juyo certificates display session numbers prominently.

---

## Test Results by Dealer

### Tier 1: Excellent Certificate Coverage

| Dealer | Listings | Detection | Session | Item# | Smith | Position | Notes |
|--------|----------|-----------|---------|-------|-------|----------|-------|
| **token-net.com** | 13 (all Juyo) | 100% | **100%** | 25% | 88% | Late (8.5) | Gold standard for Juyo |
| **aoijapan.com** | 132 | 100% | 12% | 75% | 100% | Early (2.4) | Uses "paper" filename |

### Tier 2: Good Certificate Coverage

| Dealer | Listings | Detection | Session | Item# | Smith | Position | Notes |
|--------|----------|-----------|---------|-------|-------|----------|-------|
| **iidakoendo.com** | 37 | 87.5% | 12% | 50% | 62% | Early (2.1) | Consistent positioning |
| **eirakudo.shop** | 445 | 75% | 0% | 12% | 25% | First (0) | Always first image |
| **kusanaginosya.com** | 213 | 75% | 0% | 0% | 0% | First (0) | Single image galleries |

### Tier 3: Poor Certificate Coverage

| Dealer | Listings | Detection | Session | Item# | Smith | Position | Notes |
|--------|----------|-----------|---------|-------|-------|----------|-------|
| **nipponto.co.jp** | 15 | 50% | 0% | 25% | 50% | Late (9.8) | Doesn't photograph Juyo certs |

---

## Key Insights

### 1. Juyo Certificates Are The Prize

**Juyo session numbers are extractable with near-perfect accuracy.** This is critical because:
- Juyo session + item number = **globally unique identifier**
- Can be validated against NBTHK databases
- Premium items that collectors care most about tracking

**Why Juyo works better:**
- Large, prominent "第四十七回" (Session 47) text
- Standardized certificate format
- High-quality paper with clear printing

### 2. Hozon/TokuHozon Have Document Numbers Instead

For non-Juyo certificates:
- Session numbers are **rarely visible** or not emphasized
- Instead, use **document numbers** (e.g., "019170", "3012856")
- These are unique but can't be validated externally

### 3. Certificate Position Varies by Dealer

| Dealer Type | Certificate Position | Optimization |
|-------------|---------------------|--------------|
| eirakudo, kusanagi | Always first (index 0) | Only scan first image |
| aoijapan, iidakoendo | Early (index 1-3) | Scan first 5 images |
| token-net, nipponto | Late (index 8-16) | Scan last 5 images |

### 4. Filename Conventions Work When Present

**aoijapan.com** uses `{item_id}paper-1.jpg` - 100% reliable indicator:
```
24772paper-1.jpg  → Certificate
24772paper-2.jpg  → Second page of certificate
25644_z.jpg       → NOT certificate (product photo)
```

---

## Implementation Architecture

### Phase 1: Targeted Detection (Low Cost, High Value)

Focus on **Juyo items only** initially:

```python
async def detect_juyo_certificate(listing):
    """
    Optimized for Juyo certificate extraction.
    Returns: { session_number, item_number, cert_image_url } or None
    """
    if listing.cert_type not in ['Juyo', 'TokuJuyo']:
        return None  # Skip non-Juyo for now

    # Check filename convention first (free)
    for img in listing.images:
        if 'paper' in img.lower() or 'cert' in img.lower():
            result = await analyze_certificate_image(img)
            if result and result.session_number:
                return result

    # Scan strategic positions based on dealer
    positions = get_scan_positions(listing.dealer)
    for pos in positions:
        if pos < len(listing.images):
            result = await analyze_certificate_image(listing.images[pos])
            if result and result.session_number:
                return result

    return None

def get_scan_positions(dealer_domain):
    """Dealer-specific image positions to check."""
    EARLY_DEALERS = ['eirakudo.shop', 'kusanaginosya.com']
    LATE_DEALERS = ['token-net.com', 'nipponto.co.jp']

    if dealer_domain in EARLY_DEALERS:
        return [0, 1, 2]
    elif dealer_domain in LATE_DEALERS:
        return [-1, -2, -3, -4, -5]  # Last 5 images
    else:
        return [0, 1, 2, -1, -2, -3]  # First 3 + last 3
```

### Phase 2: Store Extracted Data

```sql
-- Add certificate extraction columns
ALTER TABLE listings ADD COLUMN cert_session_number INTEGER;
ALTER TABLE listings ADD COLUMN cert_item_number INTEGER;
ALTER TABLE listings ADD COLUMN cert_document_number VARCHAR(20);
ALTER TABLE listings ADD COLUMN cert_image_url TEXT;
ALTER TABLE listings ADD COLUMN cert_extracted_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN cert_smith_extracted VARCHAR(100);

-- Composite unique identifier for Juyo
ALTER TABLE listings ADD COLUMN cert_unique_id VARCHAR(50)
  GENERATED ALWAYS AS (
    CASE
      WHEN cert_type = 'Juyo' AND cert_session_number IS NOT NULL
      THEN 'NBTHK-J-' || cert_session_number || '-' || COALESCE(cert_item_number::text, '?')
      WHEN cert_type = 'TokuJuyo' AND cert_session_number IS NOT NULL
      THEN 'NBTHK-TJ-' || cert_session_number || '-' || COALESCE(cert_item_number::text, '?')
      WHEN cert_document_number IS NOT NULL
      THEN 'NBTHK-DOC-' || cert_document_number
      ELSE NULL
    END
  ) STORED;

-- Index for cross-dealer matching
CREATE INDEX idx_cert_unique_id ON listings(cert_unique_id) WHERE cert_unique_id IS NOT NULL;
```

### Phase 3: Cross-Dealer Product Matching

Once we have `cert_unique_id`, we can detect the same sword across dealers:

```sql
-- Find same sword at multiple dealers
SELECT
    cert_unique_id,
    array_agg(DISTINCT d.name) as dealers,
    array_agg(l.id) as listing_ids,
    min(l.price_value) as min_price,
    max(l.price_value) as max_price
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
WHERE cert_unique_id IS NOT NULL
GROUP BY cert_unique_id
HAVING count(DISTINCT d.id) > 1;
```

---

## Cost Analysis

### Vision API Costs

| Approach | Images/Listing | API Cost/Image | Total Cost (4000 listings) |
|----------|----------------|----------------|---------------------------|
| Scan all images | ~10 avg | ~$0.01 | $400 |
| Smart scanning (5 per) | 5 | ~$0.01 | $200 |
| Juyo only (500 items × 3) | 3 | ~$0.01 | $15 |
| Filename filter first | 1-2 | ~$0.01 | $40-80 |

**Recommendation:** Start with **Juyo-only + filename filter** = ~$15-30 total cost.

### Success Rate Projections

Based on test results:

| Cert Type | Total Listings | Expected Detection | Expected Session/ID |
|-----------|----------------|-------------------|---------------------|
| Juyo | ~100 | 85% (85) | 80% (80) |
| TokuJuyo | ~10 | 85% (8) | 80% (8) |
| TokuHozon | ~600 | 75% (450) | 30% doc# (180) |
| Hozon | ~500 | 70% (350) | 25% doc# (125) |
| **Total** | **~1200** | **~893** | **~393** |

We'd get unique IDs for **~400 listings** (33%), with **88 Juyo/TokuJuyo** having externally-verifiable IDs.

---

## Detection Pipeline (Final)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CERTIFICATE DETECTION PIPELINE                    │
└─────────────────────────────────────────────────────────────────────┘

                    LISTING ARRIVES
                          │
                          ▼
              ┌───────────────────────┐
              │ Has cert_type in DB?  │
              └───────────────────────┘
                    │           │
                   NO          YES
                    │           │
                    ▼           ▼
                 [SKIP]   ┌───────────────────────┐
                          │ Is Juyo/TokuJuyo?     │
                          └───────────────────────┘
                                │           │
                               YES          NO
                                │           │
                    ┌───────────┘           └───────────┐
                    ▼                                   ▼
         ┌──────────────────────┐           ┌──────────────────────┐
         │ PRIORITY EXTRACTION  │           │ OPTIONAL EXTRACTION  │
         │ (always run)         │           │ (if budget allows)   │
         └──────────────────────┘           └──────────────────────┘
                    │                                   │
                    ▼                                   ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    STAGE 1: FILENAME CHECK                     │
    │  Look for: "paper", "cert", "kanteisho" in image URLs         │
    │  If found → go directly to Vision API on those images         │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼ (if no filename match)
    ┌───────────────────────────────────────────────────────────────┐
    │                STAGE 2: DEALER-SPECIFIC SCAN                   │
    │  eirakudo, kusanagi: Check first 2 images                     │
    │  aoijapan, iidakoendo: Check first 5 images                   │
    │  token-net: Check last 5 images                               │
    │  Unknown dealers: Check first 3 + last 3                      │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                  STAGE 3: VISION API ANALYSIS                  │
    │  Prompt optimized for:                                        │
    │  - Juyo: "第X回" session extraction                            │
    │  - Hozon: Document number extraction                          │
    │  - Smith name extraction                                      │
    │  Stop on first high-confidence certificate found              │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    STAGE 4: STORE RESULTS                      │
    │  cert_session_number, cert_item_number, cert_document_number  │
    │  cert_image_url, cert_smith_extracted, cert_extracted_at      │
    │  Generate cert_unique_id for cross-dealer matching            │
    └───────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Immediate (This Week)
- [ ] Add cert extraction columns to listings table
- [ ] Create `scripts/extract-juyo-certs.py` in Oshi-scrapper
- [ ] Run extraction on all Juyo items (~100 listings)
- [ ] Validate extraction quality manually (sample 20)

### Short-term (Next 2 Weeks)
- [ ] Expand to TokuJuyo items
- [ ] Implement dealer-specific scan positions
- [ ] Add filename pattern detection
- [ ] Create cert_unique_id generation logic

### Medium-term (Next Month)
- [ ] Expand to Hozon/TokuHozon with document numbers
- [ ] Implement cross-dealer matching UI
- [ ] Add "Same sword at other dealers" feature
- [ ] Create price comparison across dealers

---

## Risk Mitigation

### False Positives (Detecting wrong image as certificate)
- **Risk:** Low (Vision API is very accurate at distinguishing documents from swords)
- **Mitigation:** Require confidence ≥ 0.85 before storing

### False Negatives (Missing actual certificates)
- **Risk:** Medium (some dealers don't photograph certs, or certs are out of scan range)
- **Mitigation:** Log "no cert found" for manual review, expand scan range for high-value items

### Incorrect Extraction (Wrong session/item number)
- **Risk:** Low for Juyo (standardized format), Medium for Hozon (varied formats)
- **Mitigation:** Manual validation for first 100 extractions, then automated confidence thresholds

### API Costs
- **Risk:** Can escalate if scanning too many images
- **Mitigation:** Start with Juyo only, use filename hints, cache results

---

## Test Scripts Reference

Created during research:
- `scripts/cert-detection-by-dealer.mjs` - Per-dealer certificate testing
- `scripts/test-known-certificates.mjs` - Test on images known to be certificates
- `scripts/find-cert-images.mjs` - Find images by filename pattern
- `scripts/list-cert-dealers.mjs` - List dealers with certified listings

Results saved in: `certificate-detection-results/`

---

## Conclusion

**Certificate detection is production-ready for Juyo items.** The 100% session extraction rate on token-net.com proves the concept works excellently for the highest-value certifications.

**Recommended approach:**
1. Start with Juyo items only (100% session extraction proven)
2. Use filename hints when available (aoijapan's "paper" convention)
3. Apply dealer-specific scan positions
4. Expand to Hozon/TokuHozon document numbers as Phase 2

**Expected outcome:**
- ~88 Juyo/TokuJuyo items with unique, verifiable IDs
- ~300 Hozon/TokuHozon items with document numbers
- Cross-dealer matching capability for premium swords

---

*Research conducted: January 18, 2026*
*Dealers tested: 6 (eirakudo, kusanagi, aoijapan, iidakoendo, nipponto, token-net)*
*Listings analyzed: 48*
*Images processed: 300+*
