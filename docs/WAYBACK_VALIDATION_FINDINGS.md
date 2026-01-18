# Wayback Machine URL Reuse Validation Study

**Date:** January 18, 2026
**Author:** Automated Analysis
**Status:** Research Complete

---

## Executive Summary

Our investigation confirms a significant data integrity issue with using Wayback Machine archive dates as "freshness" indicators for nihonto listings. **50% of verified listings showed URL reuse** - meaning the archived content was a completely different item than the current listing.

### Key Finding

> **Wayback archive dates indicate when a URL first existed, NOT when the current item was listed.**

Dealers routinely reuse URLs for new inventory, making Wayback-based freshness data unreliable for approximately half of all listings.

---

## Methodology

### Test Design

1. **Content Extraction**: Fetched archived pages from Wayback Machine's CDX API
2. **Comparison Metrics**:
   - Title similarity (Jaccard index with Japanese bigram tokenization)
   - Image filename overlap
   - Price comparison (when available)
3. **Verdict Classification**:
   - **SAME**: High title (>60%) AND image (>50%) similarity
   - **DIFFERENT**: Low title (<15%) AND image (<15%) similarity
   - **UNCERTAIN**: Mixed signals

### Sample Size

| Metric | Value |
|--------|-------|
| Dealers tested | 18 |
| Listings sampled | 256 |
| Successful Wayback fetches | 66 (26%) |
| Verified comparisons | 66 |

*Note: 74% of Wayback fetches failed, likely due to archived pages being unavailable or rate limiting.*

---

## Results by Dealer

### Risk Classification

| Risk Level | Criteria | Dealers |
|------------|----------|---------|
| 🔴 **HIGH** | ≥70% URL reuse | aoijapan.com, katana-ando.co.jp, eirakudo.shop |
| 🟡 **MEDIUM** | 40-69% reuse | galleryyouyou.com, samurai-nippon.net |
| 🟢 **LOW** | <40% reuse | sanmei.com, hyozaemon.jp, tsuruginoya.com, ginza.choshuya.co.jp |
| ⚪ **UNKNOWN** | Insufficient data | 9 dealers (Wayback fetch failures) |

### Detailed Breakdown

```
Dealer                      | Reuse% | Same | Diff | Image Match
-----------------------------------------------------------------
🔴 katana-ando.co.jp        |   100% |    0 |   12 |    0%
🔴 aoijapan.com             |   100% |    0 |    1 |   25%
🔴 eirakudo.shop            |    70% |    0 |    7 |    0%
🟡 galleryyouyou.com        |    60% |    2 |    3 |   50%
🟡 samurai-nippon.net       |    50% |    3 |    4 |   21%
🟢 sanmei.com               |    38% |    5 |    3 |   58%
🟢 hyozaemon.jp             |    25% |    3 |    1 |   75%
🟢 tsuruginoya.com          |    14% |   12 |    2 |   85%
🟢 ginza.choshuya.co.jp     |     0% |    4 |    0 |   91%
```

---

## Case Studies

### Case 1: katana-ando.co.jp (100% URL Reuse)

Every tested listing showed completely different content between archive and current:

- **Archived**: Generic store page titles, different images
- **Current**: Specific item details
- **Image overlap**: 0%
- **Title similarity**: 0%

**Conclusion**: This dealer appears to use a CMS that recycles URL structures for new inventory.

### Case 2: eirakudo.shop (70% URL Reuse)

Despite using numeric IDs in URLs (e.g., `/detail/351451`), URL reuse was common:

| Listing | Archived Price | Current Title | Verdict |
|---------|---------------|---------------|---------|
| ID 521 | ¥1,500,000 | 直江志津 刀 | DIFFERENT |
| ID 625 | ¥2,000,000 | 和泉守国貞 刀 | DIFFERENT |
| ID 1067 | ¥80,000 | 赤阪 芦雁透鍔 | DIFFERENT |

**Key Insight**: Even numeric "unique" IDs are reused when items sell.

### Case 3: tsuruginoya.com (14% URL Reuse - Reliable)

High image similarity (85%) indicates URL reuse is rare:

- When listings matched: 85% average image overlap
- Most archived content matched current content
- Low false positive risk

### Case 4: ginza.choshuya.co.jp (0% URL Reuse - Most Reliable)

- 91% average image similarity
- All 4 verified listings confirmed as SAME item
- URL structure appears to be permanent per item

---

## Root Cause Analysis

### Why Dealers Reuse URLs

1. **CMS Limitations**: Many e-commerce platforms generate URLs based on item attributes (type, smith) rather than unique identifiers
2. **SEO Preservation**: Dealers may want to maintain page authority for category pages
3. **Inventory Management**: Simpler to update existing pages than create new ones
4. **No Technical Enforcement**: Nothing prevents updating a page with completely different content

### URL Pattern Risk Assessment

| Pattern Type | Example | Risk |
|--------------|---------|------|
| Smith-based slug | `/katana/katana-norishige` | 🔴 HIGH |
| Category + text | `/tosogu/tsuba/goto-style` | 🔴 HIGH |
| Numeric ID (recycled) | `/detail/351451` | 🟡 MEDIUM |
| Unique hash/UUID | `/item/a1b2c3d4` | 🟢 LOW |
| Date-based | `/2025/01/listing-123` | 🟢 LOW |

---

## Impact Assessment

### Current State

- **1,000+ listings** have Wayback-based freshness data
- **~50% may be incorrect** based on our sample
- Users see "Listed X days" that could be off by **years**

### User Trust Impact

A listing showing "Listed 778 days ago" when it's actually new:
- Misleads collectors about market availability
- Creates false sense of item being "stale"
- Undermines trust in the platform's data accuracy

---

## Recommendations

### Immediate Actions

1. **Remove/Hide Wayback-based freshness** for HIGH RISK dealers:
   - aoijapan.com
   - katana-ando.co.jp
   - eirakudo.shop

2. **Add confidence indicators** for MEDIUM RISK dealers:
   - Show "Approximate" or "Estimated" labels
   - galleryyouyou.com
   - samurai-nippon.net

3. **Keep Wayback data** for LOW RISK dealers:
   - tsuruginoya.com
   - ginza.choshuya.co.jp
   - sanmei.com
   - hyozaemon.jp

### Medium-Term Improvements

1. **Content-based validation**: Before displaying Wayback dates, verify content similarity
2. **Image hash comparison**: Most reliable indicator of same item
3. **Per-dealer trust scores**: Track validation rates over time
4. **Hybrid freshness**: Combine Wayback with our `first_seen_at`

### Long-Term Strategy

1. **Sunset Wayback-based freshness** in favor of our own scrape history
2. **Price history tracking** as freshness proxy (price changes = active listing)
3. **New listing detection** via content hashing on each scrape

---

## Data Files

All raw data from this study is available:

- `wayback-validation-results/*.json` - Per-dealer detailed results
- `wayback-validation-summary.json` - Aggregated statistics
- `scripts/wayback-dealer-test.mjs` - Test script (reusable)
- `scripts/wayback-content-validator.mjs` - Single-URL validator

---

## Appendix: Technical Details

### Similarity Algorithms

**Title Similarity (Jaccard Index)**:
```
For Japanese text: Character bigrams
For English text: Word tokens (length > 2)
Similarity = |A ∩ B| / |A ∪ B|
```

**Image Comparison**:
```
Extract filenames from image URLs
Compare sets of filenames
Overlap = |common| / max(|set1|, |set2|)
```

### Verdict Thresholds

```javascript
if (titleSim > 0.6 && imageSim > 0.5) → SAME (high confidence)
if (titleSim < 0.15 && imageSim < 0.15) → DIFFERENT (high confidence)
if (titleSim < 0.25 && imageSim < 0.25) → DIFFERENT (medium confidence)
else → UNCERTAIN
```

### Wayback API Used

```
https://web.archive.org/web/{timestamp}id_/{url}
```

The `id_` modifier returns raw archived content without Wayback's toolbar injection.

---

## Conclusion

**Wayback Machine archive dates should not be used as the primary freshness indicator** for nihonto listings. The 50% URL reuse rate makes this data unreliable for approximately half of all dealers.

Recommended approach:
1. Use our own `first_seen_at` as the primary freshness indicator
2. Supplement with Wayback data only for verified LOW RISK dealers
3. Implement content-based validation before trusting any Wayback date
4. Display appropriate uncertainty indicators to users

---

*This study was conducted using automated content comparison across 18 dealers and 256 sampled listings.*
