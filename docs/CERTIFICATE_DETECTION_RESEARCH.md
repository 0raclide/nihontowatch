# Certificate Detection Research Findings

**Date:** January 18, 2026
**Status:** Research Complete - Implementation Deferred
**Outcome:** Limited viability - not suitable as general strategy

---

## Executive Summary

We conducted extensive testing of certificate image detection and data extraction across 6 major dealers (48+ listings, 300+ images). The goal was to extract unique product identifiers (NBTHK session/item numbers) from dealer photographs of certification documents.

**Conclusion:** Certificate extraction is **only viable for 2 specific dealers** (token-net.com, aoijapan.com) and should not be pursued as a general product identification strategy.

---

## Research Questions

1. Can we reliably detect certificate images among dealer photos?
2. Can we extract session numbers (第X回) from Juyo certificates?
3. Does this work across different dealers?
4. Can extracted data be validated?

---

## Test Results by Dealer

### Tier 1: High Viability

| Dealer | Listings | Detection | Session Extract | Notes |
|--------|----------|-----------|-----------------|-------|
| **token-net.com** | 13 (all Juyo) | 100% | **100%** | Juyo specialist, photographs actual Juyo papers |
| **aoijapan.com** | 132 | 100% | 12% | Uses "paper" filename convention, good doc# extraction (75%) |

### Tier 2: Low Viability

| Dealer | Listings | Detection | Session Extract | Notes |
|--------|----------|-----------|-----------------|-------|
| iidakoendo.com | 37 | 87% | 12% | Mixed cert types in photos |
| eirakudo.shop | 445 | ~100%* | **0%** | *Requires image slicing, poor OCR |
| kusanaginosya.com | 213 | 75% | 0% | Single-image galleries |

### Tier 3: Not Viable

| Dealer | Listings | Detection | Session Extract | Notes |
|--------|----------|-----------|-----------------|-------|
| nipponto.co.jp | 15 | 50% | 0% | Doesn't photograph Juyo certificates |
| samurai-nippon.net | 7 | 50% | 0% | Inconsistent photography |
| katanahanbai.com | 20 | ~30% | 0% | Certificates often missing |

---

## Critical Findings

### 1. cert_type in Database ≠ Certificate Photographed

**The most important finding:** Items marked as "Juyo" in the database often only have Hozon or TokuHozon certificate photographs.

```
Example: eirakudo.shop Juyo items
- Listing 738:  DB says "Juyo" → Photo shows HOZON cert
- Listing 578:  DB says "Juyo" → Photo shows HOZON cert
- Listing 1098: DB says "Juyo" → Photo shows HOZON cert
```

**Why this happens:** Swords progress through certification levels (Hozon → TokuHozon → Juyo). Dealers often only photograph the original/earlier paper, not the current highest certification.

### 2. Token-net.com is the Exception

Token-net.com achieved 100% session extraction because:
- They specialize in Juyo items
- They specifically photograph Juyo papers (not older Hozon papers)
- Certificates appear consistently in late gallery positions

This success does NOT generalize to other dealers.

### 3. Eirakudo's Composite Image Problem

Eirakudo uses tall composite images (1000x20000+ pixels) that stitch together:
- Product photos
- Detail shots
- Setsumei (説明書)
- Certificates

**Technical challenges:**
- Images exceed API limit (8000px max dimension)
- Requires slicing into 5-7 chunks
- Text resolution too low for reliable OCR even when upscaled
- Certificates ARE present but unreadable

```
Eirakudo composite: 1000x18475 pixels
- Certificates found in top section (y=0-3000)
- 3 documents visible
- Text extraction: FAILED (poor resolution)
```

### 4. Session Number Extraction Rates

| Dealer Type | Session Extraction Rate |
|-------------|------------------------|
| Juyo specialist (token-net) | 100% |
| General dealers with Juyo | 0-12% |
| Hozon/TokuHozon items | 0% (use doc# instead) |

### 5. False Positive Rate

**Good news:** 0% false positive rate across 27 tested non-certificate images. The model correctly distinguishes sword/fitting photos from certificates.

### 6. Certificate Position Varies by Dealer

| Dealer Pattern | Certificate Position |
|----------------|---------------------|
| eirakudo, kusanagi | First image (index 0) |
| aoijapan, iidakoendo | Early (index 1-3) |
| token-net | Late (index 8-16, ~80-90% through gallery) |

---

## Validation Results

Attempted to validate extracted session numbers against listing titles:

| Metric | Result |
|--------|--------|
| Sessions extracted | 7/21 (33%) |
| Sessions validated | **0/7 (0%)** |
| Mismatches found | 1 (extracted 56, title said 39) |

**Conclusion:** Cannot reliably validate extracted data against other sources.

---

## Cost Analysis

| Approach | API Calls/Listing | Estimated Cost (4000 listings) |
|----------|-------------------|-------------------------------|
| Full scan (all images) | ~10 | $400 |
| Smart scan (positions) | 3-5 | $150-200 |
| Eirakudo slicing | 5-7 | $200-280 |
| Token-net + aoijapan only | 1-2 | **$15-30** |

---

## Why This Approach Fails as General Strategy

1. **Fundamental mismatch:** DB cert_type reflects highest certification; photos show what dealer chose to photograph (often earlier cert)

2. **Dealer variance:** 100% success on token-net, 0% on most others - too inconsistent

3. **Resolution issues:** Composite images (Eirakudo) contain certificates but text is unreadable

4. **Validation impossible:** Cannot verify extracted data is correct

5. **Limited coverage:** Only ~24 Juyo items would get reliable extraction out of ~100 total

---

## What Works Instead

### Image pHash for Change Detection
- Works universally (99% image coverage)
- No dealer-specific logic needed
- Reliable for detecting content changes at same URL
- Lower cost (compute only, no API calls)

### Document Numbers (Not Session Numbers)
- Hozon/TokuHozon certificates use document numbers (e.g., "019170")
- Extractable at ~50-75% rate on some dealers
- Unique but not externally verifiable

### Filename Conventions
- aoijapan.com uses `{item_id}paper-1.jpg` - 100% reliable indicator
- Can skip vision API entirely for detection (use for extraction only)

---

## Recommendations

### Immediate
- **Do not implement** general certificate extraction
- **Focus on** image pHash for content change detection
- **Document** that certificate extraction is not viable at scale

### If Revisited Later
- Limit to token-net.com + aoijapan.com only
- Use filename detection for aoijapan (`paper` in URL)
- Accept ~24 Juyo items with reliable session extraction
- Consider as "bonus feature" not core functionality

### Alternative Approaches to Explore
1. **OCR preprocessing** - Enhance images before analysis
2. **Dealer partnerships** - Get structured data directly
3. **Community contribution** - Let users submit cert IDs
4. **NBTHK database matching** - If public data becomes available

---

## Test Scripts Created

```
scripts/cert-detection-by-dealer.mjs    - Per-dealer testing
scripts/test-known-certificates.mjs     - Test on "paper" filename images
scripts/find-cert-images.mjs            - Find images by filename pattern
scripts/critical-cert-validation.mjs    - Cross-dealer validation
scripts/test-eirakudo-composite.mjs     - Composite image testing
scripts/test-eirakudo-sliced.mjs        - Sliced composite analysis
scripts/test-eirakudo-upscaled.mjs      - Upscaled slice analysis
```

Results saved in: `certificate-detection-results/`

---

## Raw Data Summary

| Metric | Value |
|--------|-------|
| Dealers tested | 6 |
| Listings analyzed | 48+ |
| Images processed | 300+ |
| API calls made | ~200 |
| Juyo items tested | 21 |
| Certificates detected | 71% overall |
| Sessions extracted | 33% overall |
| Sessions validated | 0% |
| False positives | 0% |

---

## Conclusion

Certificate extraction looked promising based on token-net.com results (100% session extraction) but **does not generalize** to other dealers. The fundamental issue is that dealers photograph earlier certificates, not current ones.

**For unique product identification, we should rely on:**
1. Image pHash (change detection)
2. Our own `first_seen_at` tracking
3. Price/content fingerprinting

**Certificate extraction should be deferred** until either:
- We have partnerships with dealers for structured data
- OCR technology significantly improves
- We decide the limited token-net/aoijapan coverage is worth the implementation cost

---

*Research conducted: January 18, 2026*
*Status: Complete - Implementation Deferred*
