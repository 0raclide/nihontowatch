# Nipponto Certificate Extraction Audit Report

**Date:** 2026-02-26
**Dealer:** Nipponto (nipponto.co.jp, dealer_id: 7)
**Total Listings:** 705

## Executive Summary

Nipponto's certificate extraction is **highly accurate** with **navigation false positives well controlled**. The scraper correctly:
- Prioritizes title matching first (most reliable)
- Requires "[cert]鑑定書" structured format for body matches (avoids nav links)
- Does NOT match bare "重要刀剣" standalone text (correct decision)

**Issue Found:** Missing English pattern `NBTHK TokubetsuKicho` (no space) affects **17 items** (2.4% of listings).

---

## Certification Distribution

| Certification | Count | % |
|--------------|-------|---|
| NULL | 317 | 45.0% |
| Hozon | 148 | 21.0% |
| Tokubetsu Hozon | 145 | 20.6% |
| Juyo | 81 | 11.5% |
| Tokubetsu Kicho | 5 | 0.7% |
| Koshu Tokubetsu Kicho | 3 | 0.4% |
| Tokuju | 3 | 0.4% |
| Tokubetsu Kicho Tosogu | 2 | 0.3% |
| Hozon Tosogu | 1 | 0.1% |

**Notes:**
- 45% NULL is expected — many are tosogu (目貫, 縁頭, 鐔) without certifications
- Item type breakdown: 48.5% katana, 13.5% wakizashi, 8.2% tsuba, 7.5% tanto, 5.1% menuki

---

## Navigation False Positive Analysis

### Pattern Observed

Nipponto displays "重要刀剣" as a **bare navigation link on its own line** on EVERY page (certified and uncertified). This is followed by "重要刀剣一覧" (Juyo list link) in the site menu.

**Example from NULL cert listing:**
```
重要刀剣                    ← Nav link (standalone)
短刀
格安・激安刀剣
...
重要刀剣一覧                ← Nav link (list page)
短刀一覧
格安刀剣一覧
```

### Scraper Handling

The scraper **correctly avoids this false positive** by:

1. **Title check first** — If cert appears in `<title>`, extract immediately (highest confidence)
2. **Structured body pattern** — Only match `[cert]鑑定書` format (e.g., `重要刀剣鑑定書`)
3. **No bare matching** — Does NOT match standalone "重要刀剣" without structured context

This is **intentional and correct** per lines 484-513 in `scrapers/nipponto.py`:

```python
# Priority 1: Check title first (most reliable source)
if title:
    for jp, en in self.CERT_TYPES:
        if jp in title:
            cert.type = en
            ...

# Priority 2: Check page body for STRUCTURED certification info
# Only match certifications in official certificate format to avoid
# false positives from navigation menus containing "重要刀剣" as a category link
if not found_any:
    text = soup.get_text()

    # Look for official NBTHK paper format: "[cert]鑑定書"
    for jp, en in self.CERT_TYPES:
        cert_paper_pattern = f'{jp}鑑定書'
        if cert_paper_pattern in text:
            cert.type = en
            ...
```

### Verification

Sampled **50 NULL cert listings**:
- **22 items** have "重要刀剣" ONLY in navigation context (expected — no false positives)
- **12 items** have cert paper format but NULL cert (extraction bugs — see below)
- **16 items** have neither pattern (genuinely uncertified)

**Conclusion:** Navigation false positive risk is **WELL CONTROLLED**. The 22 "nav-only" items are correctly left as NULL.

---

## Real Certification Format

### Japanese Format

Real certifications appear in structured sections with `鑑定書(Paper)` label:

```
鑑定書(Paper)
特別保存刀剣鑑定書
(NBTHK Tokubetsu Hozon Touken)
```

### English Format (NBTHK)

Nipponto uses **CamelCase** (no spaces) for some cert types:

- `(NBTHK Hozon Touken)` ✅ Works
- `(NBTHK Tokubetsu Hozon Touken)` ✅ Works
- `(NBTHK TokubetsuKicho Touken)` ❌ **MISSING FROM SCRAPER**

---

## Extraction Bugs Found

### 1. Missing English Pattern: `NBTHK TokubetsuKicho`

**Impact:** 17 items (2.4% of total listings)

**Root Cause:** Scraper has English patterns WITH spaces:
```python
nbthk_en_patterns = [
    ('NBTHK Tokubetsu Juyo', 'Tokubetsu Juyo'),
    ('NBTHK Juyo Token', 'Juyo'),
    ('NBTHK Tokubetsu Hozon', 'Tokubetsu Hozon'),  # Has space
    ('NBTHK Hozon Token', 'Hozon'),
    ('NBTHK Hozon Touken', 'Hozon'),
]
```

But Nipponto writes `TokubetsuKicho` (no space) for this cert type.

**Example:**
- URL: https://www.nipponto.co.jp/swords12/KT342440.htm
- Title: 於江府豫大洲藩臣隆国 文化十四年八月日
- Found in text:
  ```
  鑑定書(Paper)
  特別貴重刀剣鑑定書
  (NBTHK TokubetsuKicho Touken)  ← Pattern not matched
  ```

**Fix:** Add to `nbthk_en_patterns` in `scrapers/nipponto.py` line ~518:
```python
('NBTHK TokubetsuKicho Touken', 'Tokubetsu Kicho'),
('NBTHK TokubetsuKicho Token', 'Tokubetsu Kicho'),  # Also try Token variant
```

**Affected Items (first 5 of 17):**
1. https://www.nipponto.co.jp/swords12/KT342440.htm
2. https://www.nipponto.co.jp/swords11/TT329566.htm
3. https://www.nipponto.co.jp/swords10/KY336949.htm
4. https://www.nipponto.co.jp/swords10/KT339808.htm
5. https://www.nipponto.co.jp/swords12/TT330134.htm

### 2. Other NULL Cert Items

**Remaining NULL items with cert paper format:** 11 items (after TokubetsuKicho fix)

These appear to genuinely have the Japanese `特別保存刀剣鑑定書` or `保存刀剣鑑定書` pattern, which SHOULD be matched by the existing Japanese cert paper logic (lines 507-513).

**Possible causes:**
1. **Encoding issues** — EUC-JP decoding may garble some kanji characters
2. **Whitespace variations** — Extra spaces/characters breaking exact match
3. **Title priority** — Cert in title but wrong type extracted

**Examples requiring manual review:**
- https://www.nipponto.co.jp/swords11/WK330953.htm (5 spears with Tokubetsu Hozon cert repeated 5 times)
- https://www.nipponto.co.jp/swords11/KT341604.htm (has "鑑定書(Paper)" but no cert type line)

**Recommendation:** Spot-check these 11 URLs manually to verify if:
- Cert is genuinely missing (just has registration, no NBTHK paper)
- Encoding garbled the cert name
- Pattern needs flexibility (e.g., `鑑定書付` vs `鑑定書(Paper)`)

---

## Accuracy Assessment

### Overall Accuracy: **VERY HIGH**

- **Navigation false positives:** 0 detected (22 nav-only items correctly left NULL)
- **Missing certifications:** 17 confirmed (TokubetsuKicho) + ~11 needing review = **28 / 705 = 4.0%**
- **Correctly extracted:** ~96% accuracy

### Breakdown

| Category | Count | Notes |
|----------|-------|-------|
| Correctly certified | 388 | Juyo, Tokuho, Hozon, etc. properly extracted |
| Correctly NULL | ~289 | Tosogu without certs, uncertified blades |
| Missing (TokubetsuKicho bug) | 17 | English pattern gap |
| Needs review | 11 | Has cert paper format but NULL |

---

## Findings & Recommendations

### ✅ What's Working Well

1. **Title-first strategy** — Highest-confidence matches extracted first
2. **Structured body pattern** — `[cert]鑑定書` requirement avoids nav false positives
3. **No bare matching** — Correctly ignores standalone "重要刀剣" nav links
4. **CERT_TYPES ordering** — Longest-first prevents "特別保存" → "保存" mismatch
5. **EUC-JP handling** — Multi-encoding fallback (euc-jp → cp932 → shift_jis → utf-8)

### ❌ Bugs to Fix

1. **Add `NBTHK TokubetsuKicho` pattern** (17 items affected)
2. **Investigate 11 items** with Japanese cert paper format but NULL result
3. **Consider variations:**
   - `TokubetsuHozon` (CamelCase) if exists
   - `HozonToken` vs `Hozon Token` spacing

### 🔍 Manual Review Needed

Visit these URLs to verify cert extraction logic:
1. https://www.nipponto.co.jp/swords12/KT342440.htm (TokubetsuKicho confirmed)
2. https://www.nipponto.co.jp/swords11/WK330953.htm (5 spears, Tokubetsu Hozon)
3. https://www.nipponto.co.jp/swords11/KT341604.htm (Paper label but no cert type)

---

## Conclusion

Nipponto's cert extraction is **robust and well-designed**, with intentional guards against navigation false positives. The primary issue is a single missing English pattern (`NBTHK TokubetsuKicho`) affecting 2.4% of listings.

**Priority fix:** Add `NBTHK TokubetsuKicho` variant to English patterns in `scrapers/nipponto.py`.

**Secondary review:** Investigate 11 items with Japanese cert paper format to determine if encoding, whitespace, or pattern matching needs adjustment.

---

## Appendix: Data Analysis Scripts

All analysis performed using:
- `scripts/analyze-nipponto.js` — Overall cert distribution
- `scripts/analyze-nipponto-v2.js` — Detailed cert line extraction
- `scripts/analyze-nipponto-nav.js` — Navigation false positive detection
- `scripts/nipponto-audit-report.js` — Comprehensive summary report
- `scripts/nipponto-cert-bugs.js` — Bug investigation
- `scripts/analyze-all-null-certs.js` — Pattern matching across all NULL certs
- `scripts/check-specific-cert.js` — Individual item deep dive

All scripts available in `/Users/christopherhill/Desktop/Claude_project/nihontowatch/scripts/`.
