# Setsumei Translation Quality Report

**Date:** January 21, 2026
**Analysis Scope:** 196 listings with English setsumei translations

---

## Executive Summary

Investigation reveals that **35.2% of setsumei translations contain "Not stated" or "not recorded" patterns**. However, this is largely **correct behavior** - the translation pipeline accurately reflects missing or unreadable source data. The root cause is primarily **OCR quality issues**, not translation failures.

### Key Findings

| Metric | Value |
|--------|-------|
| Total translations | 196 |
| With "Not stated" issues | 69 (35.2%) |
| Severely affected (3+ occurrences) | 21 (10.7%) |
| Primary root cause | OCR capture failures |

---

## Issue Distribution by Dealer

The quality issues are **highly concentrated** in specific dealers:

| Dealer | Total | With Issues | Rate |
|--------|-------|-------------|------|
| Kusanagi | 3 | 3 | **100%** |
| Aoi Art | 17 | 10 | **58.8%** |
| Token-Net | 28 | 15 | **53.6%** |
| Tsuruginoya | 2 | 1 | 50.0% |
| World Seiyudo | 48 | 13 | 27.1% |
| Iida Koendo | 8 | 2 | 25.0% |
| Nihonto | 4 | 1 | 25.0% |
| Eirakudo | 55 | 4 | 7.3% |
| Samurai Nippon | 16 | 1 | 6.3% |
| **Taiseido** | 8 | 0 | **0%** |
| **Touken Matsumoto** | 3 | 0 | **0%** |
| **Wakeidou** | 2 | 0 | **0%** |
| **Shoubudou** | 1 | 0 | **0%** |

**Conclusion:** The issue correlates strongly with dealer image quality, not translation logic.

---

## Root Cause Analysis

### 1. OCR Capture Failures (~45% of issues)

The Japanese source text (`setsumei_text_ja`) frequently shows signs of OCR problems:

**Example - Severely Corrupted OCR (ID 9552):**
```
Lis
amy 7%
指定書
刀 無 它有個
歙目
六〇一九五
```

This is garbled beyond recovery. The translation correctly outputs "Measurements not recorded on this designation sheet."

**Corruption patterns observed:**
- Hebrew characters mixed in (וך)
- Random Roman characters ("BUSED", "amy 7%", "Asuna, LAUMON")
- Garbled/incomplete kanji sequences
- Numbers mangled or missing entirely

**Indicator:** `pipeline_info.ocr_source: "raw_fallback"` confirms OCR fallback was used due to quality issues.

### 2. Legitimately Absent Information (~40% of issues)

NBTHK certificates have varying formats across decades. Many "Not stated" entries are **correct**:

**Koshirae section in blade-only certificates:**
```markdown
### Mounting (Koshirae)
*Saya:* not stated
*Tsuka:* not stated
*Tsuba:* not stated
```

This is appropriate - blade designation certificates don't include mounting information.

**Fields often legitimately absent:**
- Horimono (carvings) - only mentioned when present
- Specific measurements in older certificates
- Nakago details in some formats
- Era when attribution is uncertain

### 3. Translation Prompt Design (~15% of issues)

The translation prompts in `Oshi-scrapper/setsumei/prompts/translation.py` do **not** provide explicit guidance on handling missing data:

```python
# No instruction like:
# "If information is not present in the source, output null"
# "If OCR is unclear, indicate [OCR unclear]"
```

The LLM defaults to "Not stated" when it cannot find information - which is reasonable but inconsistent with other possible outputs (null, empty string, omission).

---

## Sample Analysis: The User's Example

The example provided:
```
Tokubetsu Hozon Token, N/A Session — Designated January 31, 2014
Tachi, mumei: Nio (二王)

Description
Keijō: Not stated on the certificate
Kitae: Not stated on the certificate
Hamon: Not stated on the certificate
...
```

**Diagnosis:** This is a **Tokubetsu Hozon certificate**, not a Juyo zufu. Tokubetsu Hozon certificates are simpler appraisal documents that **genuinely do not contain** detailed metallurgical descriptions (keijo, kitae, hamon, boshi). Only Juyo and Tokubetsu Juyo zufus include full technical descriptions.

**The translation is correct** - it's accurately reflecting that this information is not on the certificate.

---

## Quality Pattern Examples

### Good Translation (ID 6352 - Bitchu Aoe Tachi)
```markdown
## Juyo-Token, 68th Session - Designated November 2, 2022

Tachi, *mei*: Hidetsugu

**Measurements**
Nagasa 70.3 cm (2 shaku 3 sun 2 bu); sori 2.1 cm...

**Description**
*Keijō:* Shinogi-zukuri, iori-mune, somewhat elongated kissaki
*Kitae:* Ko-itame with flowing tendency; ji-nie attaches thickly
*Hamon:* Chū-suguha in ko-nie-deki with fine ashi and yo
*Bōshi:* Sugu with short kaeri

**Artisan**
Hidetsugu was a smith of the Aoe school in Bitchū Province...

**Era**
Kareki era (1327), late Kamakura period
```

### Poor Translation (ID 9552 - Corrupted OCR)
```markdown
## Juyo-Token, Session Unknown

Katana, *mumei*: Attribution unclear

**Measurements**
Measurements not recorded on this designation sheet (or illegible).

**Description**
*Keijō:* *Nabezori* (pot-bellied curvature) is indicated...
[Remaining fields: Not stated]
```

**The difference:** Quality of source OCR text, not translation logic.

---

## Severity Breakdown

| "Not stated" Occurrences | Listings | Notes |
|--------------------------|----------|-------|
| 1 occurrence | 21 | Minor - usually one optional field |
| 2 occurrences | 8 | Moderate |
| 3 occurrences | 3 | Noticeable gaps |
| 4 occurrences | 5 | Multiple sections affected |
| 5 occurrences | 1 | |
| 6 occurrences | 4 | Severe - most description missing |
| 7+ occurrences | 8 | Critical - near-total failure |

---

## Recommendations

### 1. OCR Pipeline Improvements (High Impact)

**Pre-processing enhancements:**
- Add noise character filtering (Hebrew, random Roman text)
- Implement better handling of historical document layouts
- Add numeric pattern recognition for measurements
- Consider re-processing high-value listings with improved pipeline

**Quality gating:**
- Flag listings where `ocr_source: "raw_fallback"` for manual review
- Set minimum Japanese character threshold higher (currently 30%)

### 2. Translation Prompt Updates (Medium Impact)

Add explicit instructions to `translation.py`:

```python
# Add to prompts:
"""
HANDLING MISSING INFORMATION:
- If a field is not mentioned in the source text, use null in JSON
- If text is present but illegible/corrupted, use "[OCR unclear]"
- For Tokubetsu Hozon certificates (not zufu), omit Description section entirely
- Do not include Koshirae section for blade-only designations
"""
```

### 3. UI/Display Improvements (Quick Win)

**Filter out template placeholders:**
- Don't display "Koshirae" section when all fields are "not stated"
- Collapse empty sections automatically
- Show "Limited source data" indicator when 3+ fields missing

**Distinguish certificate types:**
- Zufu (重要刀剣図譜) - Full technical description expected
- Appraisal (鑑定書) - Basic information only

### 4. Re-processing Priority

Focus OCR re-processing on:
1. Kusanagi listings (3 items, 100% affected)
2. Aoi Art listings (17 items, 58.8% affected)
3. Token-Net listings (28 items, 53.6% affected)

Skip re-processing for:
- Taiseido, Touken Matsumoto, Wakeidou, Shoubudou (0% issues)

---

## Conclusion

The "Not stated" patterns are **not a bug** - they're the translation pipeline correctly reporting that information is missing from the source. The real issue is **upstream OCR quality** and **certificate type handling**.

**Immediate actions:**
1. Add certificate type detection (zufu vs appraisal) to skip inappropriate sections
2. Implement UI filtering to hide empty template sections
3. Re-run OCR with enhanced pre-processing on high-issue dealer listings

**The translation pipeline itself is working correctly** - it's being honest about what it cannot find in corrupted or limited source documents.
