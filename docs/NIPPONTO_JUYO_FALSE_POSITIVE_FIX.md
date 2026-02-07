# Nipponto Juyo False Positive Fix

**Date:** 2026-02-07
**Issue:** Items from nipponto.co.jp incorrectly classified as "Juyo" certification
**Status:** Resolved

## Problem

Users reported that many items from dealer nipponto.co.jp were showing as "Juyo" certified when they were not. Investigation revealed 4 out of 12 "Juyo" items were false positives.

**Example false positives:**
- 保昌（末） Hosho - Actually Hozon certified
- 和州住則長 Washuju Norinaga - Actually Hozon certified
- 筑紫薙刀 Tsukushi Naginata - No certification at all

## Root Cause Analysis

The nipponto scraper's `_extract_certification()` method was matching "重要刀剣" from the **site navigation menu**, not actual certification data.

Nipponto's navigation menu structure:
```
紹介 日本刀・太刀 日本刀（拵え付） 脇差・槍・薙刀 短刀 重要刀剣 格安・激安刀剣...
```

Here, "重要刀剣" is a **category link** (Important Swords section), not a certification indicator. The old code searched the entire page body for cert patterns and matched this navigation text.

**Actual certification format** on Nipponto pages:
```
鑑定書(Paper) 保存刀剣鑑定書 (NBTHK Hozon Touken)
```

## Solution

### 1. Scraper Fix (Oshi-scrapper)

Modified `scrapers/nipponto.py` `_extract_certification()` to require **structured context** for page body matches:

**Before:**
```python
# Priority 2: Check page body if no cert found in title
if not found_any:
    text = soup.get_text()
    for jp, en in self.CERT_TYPES:
        if jp in text:  # Matches ANY occurrence, including nav menu
            cert.type = en
            ...
```

**After:**
```python
# Priority 2: Check page body for STRUCTURED certification info
if not found_any:
    text = soup.get_text()

    # Look for official NBTHK paper format: "[cert]鑑定書"
    for jp, en in self.CERT_TYPES:
        cert_paper_pattern = f'{jp}鑑定書'  # e.g., "保存刀剣鑑定書"
        if cert_paper_pattern in text:
            cert.type = en
            ...

    # Also check English NBTHK format
    if not found_any:
        nbthk_en_patterns = [
            ('NBTHK Hozon Token', 'Hozon'),
            ('NBTHK Hozon Touken', 'Hozon'),
            ...
        ]
```

**Key insight:** Real certifications appear as `[CERT]鑑定書` (e.g., `保存刀剣鑑定書`), not bare `重要刀剣` in navigation.

### 2. Regression Tests Added

Added `TestNippontoCertificationFalsePositives` class with 6 tests:

| Test | Purpose |
|------|---------|
| `test_nav_menu_juyo_not_false_positive` | Core regression - nav menu "重要刀剣" shouldn't trigger Juyo |
| `test_no_cert_with_nav_menu_returns_none` | Uncertified items with nav menu |
| `test_title_juyo_still_extracted` | Legitimate Juyo in title still works |
| `test_hozon_paper_format_extracted` | Hozon paper format detection |
| `test_tokubetsu_hozon_paper_format_extracted` | TokuHozon paper format detection |
| `test_juyo_paper_format_extracted` | Juyo paper format detection |

### 3. Database Corrections

Fixed 4 false positive items directly in production database:

| ID | Title | Before | After |
|----|-------|--------|-------|
| 4572 | 保昌（末） Hosho | Juyo | Hozon |
| 4575 | 和州住則長 Washuju Norinaga | Juyo | Hozon |
| 4685 | 無銘 和気 Wake | Juyo | Hozon |
| 4821 | 筑紫薙刀 Tsukushi Naginata | Juyo | NULL |

## Files Changed

### Oshi-scrapper Repository

| File | Change |
|------|--------|
| `scrapers/nipponto.py` | Fixed `_extract_certification()` to use structured context |
| `tests/scrapers/test_nipponto.py` | Added `TestNippontoCertificationFalsePositives` class (6 tests) |
| `tests/conftest.py` | Updated `nipponto_product_html` fixture to use proper cert format |

## Verification

```bash
# Before fix: 12 Juyo items
# After fix: 8 Juyo items (all legitimate with "重要刀剣" in title)

curl "https://nihontowatch.com/api/browse?tab=available&cert=Juyo&dealer=7"
```

All remaining Juyo items have "重要刀剣" in their titles, confirming they are legitimate.

## Prevention

The fix prevents future false positives by:
1. Title-based extraction remains primary (most reliable)
2. Page body extraction now requires official certificate format
3. Regression tests will catch any reintroduction of the bug

## Related

- Dealer ID: 7 (Nipponto / nipponto.co.jp)
- Similar pattern may exist in other dealers with navigation menus containing cert terms
