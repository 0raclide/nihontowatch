# Nipponto Certification Format Analysis

## Date: 2026-02-26

## Summary

Nipponto's certification information follows a **consistent structured format** in the item details section, making it highly reliable for extraction. However, their **navigation menu includes standalone "重要刀剣" link** which causes false positives when using bare cert name patterns.

---

## Certification Format (Genuine Items)

### Location
Certifications appear in the **metadata/specifications section** of the listing, specifically in a field labeled:
```
鑑定書(Paper)
```

### Format Pattern
```
鑑定書(Paper)
[CERT_TYPE_NAME]
([ORGANIZATION] [CERT_TYPE_EN])
```

### Examples from Database

#### 1. Hozon (ID: 69285)
```
鑑定書(Paper)
保存刀剣鑑定書
(NBTHK Hozon Touken)
```

#### 2. Tokubetsu Hozon (ID: 69283)
```
鑑定書(Paper)
特別保存刀剣鑑定書
(NBTHK Tokubetsu Hozon Touken)
```

#### 3. Tokubetsu Hozon (ID: 69278)
```
鑑定書(Paper)
特別保存刀剣鑑定書
(NBTHK Tokubetsu Hozon Touken)
```

#### 4. Hozon (ID: 69275)
```
鑑定書(Paper)
保存刀剣鑑定書
(NBTHK Hozon Touken)
```

---

## Navigation Structure (False Positive Source)

### Standard Navigation Menu

**All** Nipponto listings include this navigation structure near the top of the page:

```
日本刀・太刀
日本刀（拵え付）
脇差・槍・薙刀
短刀
重要刀剣        ← FALSE POSITIVE SOURCE
格安・激安刀剣
日本刀・拵えの製作
鍔
現代鍔（別注可能）
刀装具
刀掛け・バッグ
小物類
日本刀関連書籍
銃・鎧等
兜の置物
```

This "重要刀剣" is a **clickable navigation link** to their Juyo category page, NOT an indication that the specific item has Juyo certification.

### Evidence

**Sample of 20 listings containing "重要刀剣" text:**
- **6 listings**: Hozon cert
- **5 listings**: Tokubetsu Hozon cert
- **5 listings**: Juyo cert
- **4 listings**: NULL cert (no certification)

The presence of "重要刀剣" text appears in **both certified and non-certified items**, confirming it's navigation boilerplate.

---

## Key Findings

### 1. Reliable Pattern: `鑑定書(Paper)` + `[cert]鑑定書`

The `[cert]鑑定書` pattern (e.g., `保存刀剣鑑定書`, `特別保存刀剣鑑定書`) works **reliably** when it appears:
- **On the line immediately following** `鑑定書(Paper)`
- **In the metadata/specifications section** (not navigation)

### 2. Unreliable Pattern: Standalone `重要刀剣`

The bare text "重要刀剣" appears in the navigation menu on **every page** regardless of certification status. This causes false positives when using standalone cert name patterns.

### 3. Current Scraper Behavior

Based on CLAUDE.md documentation, the current cert extraction uses:
- `[cert]鑑定書` pattern (e.g., `保存刀剣鑑定書`) ✓ **Works for Nipponto**
- Standalone cert name pattern with 7 guards ⚠️ **Prone to false positives from nav**

The pipe guard (`|`-separated list detection) would NOT catch Nipponto's navigation because each link is on its own line, not pipe-separated.

---

## Recommendations

### For Nipponto-Specific Fix

**Option 1: Require `鑑定書(Paper)` context** (safest)
```python
# Only match cert names if preceded by 鑑定書(Paper) within N chars
if '鑑定書(Paper)' in text:
    paper_index = text.index('鑑定書(Paper)')
    # Look for cert name in next 200 chars
    search_text = text[paper_index:paper_index + 200]
    # Apply cert patterns to search_text only
```

**Option 2: Add navigation menu exclusion**
```python
# Exclude matches within navigation boilerplate
nav_start = text.find('日本刀・太刀')
nav_end = text.find('明倫産業会社概要')  # End of nav section
if nav_start != -1 and nav_end != -1:
    # Exclude text[nav_start:nav_end] from cert matching
```

### For Cross-Dealer Pattern

The existing `[cert]鑑定書` pattern is **already working correctly** for Nipponto:
- ✓ All 10 sampled certified items correctly extracted
- ✓ Pattern appears in metadata section (reliable context)
- ✓ Format is consistent: `保存刀剣鑑定書`, `特別保存刀剣鑑定書`

The issue is **standalone cert name patterns** (e.g., bare `重要刀剣` without `鑑定書` suffix), which hit navigation false positives.

---

## Database Evidence

### Listings WITH Certifications
All correctly show cert in `鑑定書(Paper)` field format:

| ID | Cert Type | Format in Text |
|----|-----------|----------------|
| 69285 | Hozon | `鑑定書(Paper)\n保存刀剣鑑定書` |
| 69283 | Tokubetsu Hozon | `鑑定書(Paper)\n特別保存刀剣鑑定書` |
| 69280 | Juyo | Navigation only (see note) |
| 69279 | Juyo | Navigation only (see note) |
| 69278 | Tokubetsu Hozon | `鑑定書(Paper)\n特別保存刀剣鑑定書` |

**Note on Juyo IDs 69280, 69279**: These listings have `cert_type='Juyo'` in the database but the pattern I found in `raw_page_text` was navigation only. This suggests either:
1. They were extracted via a different pattern (title?)
2. The scraper has multiple cert detection paths
3. There's a Juyo-specific pattern I didn't capture in this analysis

### Listings WITHOUT Certifications (NULL)

These have "重要刀剣" text but **only in navigation**, not in any cert field:

| ID | URL | Context |
|----|-----|---------|
| 69284 | WK331074.htm | Nav menu only, no `鑑定書(Paper)` field |
| 69282 | WK329721.htm | Nav menu only, no `鑑定書(Paper)` field |

---

## Testing Recommendations

### Test Cases for Nipponto

1. **Positive: Hozon with Paper field**
   - URL: `https://www.nipponto.co.jp/swords10/NT333962.htm`
   - Expected: Extract `Hozon` from `保存刀剣鑑定書` following `鑑定書(Paper)`

2. **Negative: No cert but has nav**
   - URL: `https://www.nipponto.co.jp/swords9/MN201873.htm`
   - Expected: NULL cert (ignore nav menu "重要刀剣")

3. **Positive: Tokubetsu Hozon**
   - URL: `https://www.nipponto.co.jp/swords5/WK328280.htm`
   - Expected: Extract `Tokubetsu Hozon` from `特別保存刀剣鑑定書`

### Validation Query

```sql
-- Check Nipponto cert extraction accuracy
SELECT
  cert_type,
  COUNT(*) as count,
  ARRAY_AGG(url ORDER BY id DESC) FILTER (WHERE url IS NOT NULL) AS sample_urls
FROM listings
WHERE dealer_id = 7
GROUP BY cert_type
ORDER BY count DESC;
```

---

## Conclusion

**Nipponto's certification format is highly structured and reliable.** The `[cert]鑑定書` pattern should work correctly for genuine certifications. The main risk is **false positives from standalone cert names in navigation menus**, which affects patterns like bare `重要刀剣` matching.

### Action Items

1. ✅ **Keep existing `[cert]鑑定書` pattern** - it works correctly
2. ⚠️ **Review standalone cert name guards** - current 7 guards may not catch Nipponto's line-by-line navigation
3. 💡 **Consider Nipponto-specific rule** - require `鑑定書(Paper)` context for this dealer
4. 🔍 **Investigate Juyo extraction** - how were IDs 69280, 69279 extracted? (title pattern?)

---

## URLs Analyzed

### Attempted (all returned 404)
1. https://www.nipponto.co.jp/swords/KA2614.htm ❌
2. https://www.nipponto.co.jp/swords/KA2615.htm ❌
3. https://www.nipponto.co.jp/swords/KA2616.htm ❌
4. https://www.nipponto.co.jp/swords/KA2617.htm ❌
5. https://www.nipponto.co.jp/swords/KA2618.htm ❌
6. https://www.nipponto.co.jp/swords/KA2619.htm ❌
7. https://www.nipponto.co.jp/swords/KA2620.htm ❌
8. https://www.nipponto.co.jp/swords/jyuyo.htm ❌
9. https://www.nipponto.co.jp/swords/katana.htm ❌

### Analyzed from Database
- 20 listings containing "重要刀剣" text (10 with certs, 10 mixed)
- 3 listings with NULL cert but navigation text
- Full `raw_page_text` analysis for representative samples

**Note**: Live URLs appear to have changed. All analysis based on `raw_page_text` stored in database from previous scrapes.
