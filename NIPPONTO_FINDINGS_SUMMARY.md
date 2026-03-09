# Nipponto Certification - Quick Reference

## Format: RELIABLE ✅

### How Nipponto Shows Certifications

**Metadata Field Format:**
```
鑑定書(Paper)
保存刀剣鑑定書
(NBTHK Hozon Touken)
```

**This pattern appears in:**
- Item specifications section
- Always uses `鑑定書(Paper)` label
- Always includes full cert name with `鑑定書` suffix

---

## Navigation Menu: FALSE POSITIVE SOURCE ⚠️

**Every Nipponto page includes this navigation:**

```
日本刀・太刀
日本刀（拵え付）
脇差・槍・薙刀
短刀
重要刀剣        ← This appears on EVERY page
格安・激安刀剣
```

The "重要刀剣" is a **category link**, NOT a certification indicator for the specific item.

---

## Extraction Patterns

### ✅ SAFE: `[cert]鑑定書` Pattern

These patterns work correctly for Nipponto:
- `保存刀剣鑑定書` → Hozon
- `特別保存刀剣鑑定書` → Tokubetsu Hozon
- `重要刀剣鑑定書` → Juyo Token
- `特別重要刀剣鑑定書` → Tokubetsu Juyo Token

**Why it works:**
- Appears in structured metadata field
- Not present in navigation
- Consistent across all listings

### ⚠️ RISKY: Standalone `重要刀剣`

Bare cert names (without `鑑定書` suffix) are **unreliable** for Nipponto:
- `重要刀剣` appears in nav on **every page**
- `特別重要刀剣` might also appear in nav
- Standalone patterns need **strong context guards**

---

## Evidence from Database

**20 listings containing "重要刀剣" text:**

| Cert Type | Count | Notes |
|-----------|-------|-------|
| Hozon | 6 | ✓ Correctly extracted |
| Tokubetsu Hozon | 5 | ✓ Correctly extracted |
| Juyo | 5 | ✓ Correctly extracted |
| NULL | 4 | ⚠️ Nav menu only - no cert |

**Conclusion:** The `[cert]鑑定書` pattern discriminates correctly. Standalone patterns hit false positives.

---

## Current Status

### What's Working ✅
- Existing `[cert]鑑定書` pattern extracts correctly
- 10/10 sampled certified items have correct cert_type
- No false positives detected from `鑑定書` pattern

### What's Risky ⚠️
- Standalone cert name patterns (documented in CLAUDE.md)
- Navigation menu contains bare cert terms
- 7 existing guards may not catch line-by-line navigation

---

## Recommendations

### Short Term
1. **No changes needed** for `[cert]鑑定書` pattern - it works
2. **Review standalone patterns** - ensure nav guards are sufficient
3. **Test** the 4 NULL-cert listings to confirm no regression

### Long Term (if needed)
**Option A: Dealer-specific context rule**
```python
# For Nipponto, require 鑑定書(Paper) proximity
if dealer.domain == 'nipponto.co.jp':
    if '鑑定書(Paper)' in text:
        # Apply patterns only in next N chars after this marker
```

**Option B: Navigation exclusion**
```python
# Exclude known navigation sections from all dealers
nav_patterns = [
    '日本刀・太刀.*?明倫産業会社概要',  # Nipponto nav
    # Add other dealers' nav patterns
]
```

---

## Test URLs (for validation)

**When testing scraper changes:**

1. **Has Hozon cert:**
   - DB ID: 69285
   - URL: https://www.nipponto.co.jp/swords12/WK331745.htm
   - Expected: `cert_type='Hozon'`

2. **Has Tokubetsu Hozon:**
   - DB ID: 69283
   - URL: https://www.nipponto.co.jp/swords5/WK328280.htm
   - Expected: `cert_type='Tokubetsu Hozon'`

3. **No cert (nav only):**
   - DB ID: 69284
   - URL: https://www.nipponto.co.jp/swords11/WK331074.htm
   - Expected: `cert_type=NULL`

---

## Key Insight

> **Nipponto uses `鑑定書(Paper)` as a structured metadata field, making the `[cert]鑑定書` pattern highly reliable. The issue is NOT with this pattern — it's with standalone cert name patterns that match navigation boilerplate.**

The existing extraction appears to be working correctly. The risk is if/when standalone patterns are used without sufficient context guards.
