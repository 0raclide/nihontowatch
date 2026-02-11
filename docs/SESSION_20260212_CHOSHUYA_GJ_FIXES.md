# Session: Choshuya GJ Discovery, Spec Hallucination, Banner & Cert Fixes

**Date:** 2026-02-12
**Repo:** Oshi-scrapper (5 commits pushed to main)

---

## Problem Statement

A Juyo Rai Kunizane katana at 8.5M yen (`r8/002/02_kunizane.php`) was missing from the database. Investigation revealed systemic issues with the Choshuya GJ (Ginza Journal) scraping pipeline.

## Four Issues Found & Fixed

### 1. Missing GJ Issues — Discovery Gap (feat: `14249ef`)

**Problem:** 5 entire GJ issues (67 items) were never discovered because the crawler only followed links from catalog/preview pages, which don't always reference every issue.

**Missing issues:** r7/003 (13 items), r7/008 (12), r7/009 (14), r8/002 (15), r8/003 (13)

**Fix:** Added `_probe_gj_issues()` to `scrapers/discovery/choshuya.py` — sequentially probes `/sale/gj/rN/NNN/` directories from Reiwa 3 through current year. Uses `allow_redirects=False` to detect 302 redirects (non-existent issues). Stops after 3 consecutive misses per year. Parses Apache directory listings and rich index pages to extract item URLs.

**Files changed:**
- `scrapers/discovery/choshuya.py` — Added `_probe_gj_issues()`, `_extract_gj_directory()`, `_current_reiwa_year()`
- `tests/scrapers/test_choshuya_discovery.py` — 16 new tests (directory extraction, gap handling, error resilience)
- `data/missing_gj_urls.txt` — 67 URLs scraped and loaded into database

**Result:** All 67 items scraped successfully (47 available, 20 sold). Future runs will automatically discover new GJ issues.

---

### 2. LLM Spec Hallucination — Fabricated Measurements (fix: `8af96b8`)

**Problem:** 68+ Choshuya listings had identical fabricated measurements (nagasa=70.5, sori=1.8, motohaba=3.0, sakihaba=2.0, kasane=0.7). Two compounding bugs:

1. **Prompt examples had concrete numbers** — All 16 prompt templates showed values like `"nagasa_cm": 70.5` in their JSON examples. The LLM copied these when it couldn't find real measurements.

2. **BaseScraper stripped JavaScript containing real data** — Choshuya stores measurements in a JavaScript `combinedValues` object. The Choshuya scraper correctly extracted this into `listing.raw_page_text`, but `BaseScraper._extract_with_llm()` ignored it, re-parsed the HTML, stripped all `<script>` tags, and sent the LLM text without any measurements. Bug #1 masked Bug #2 by always producing plausible numbers.

**Fix (two layers):**

*Layer 1 — Prompt examples (16 files):*
Changed all measurement fields from concrete numbers to `null`. Added extraction rule: "ONLY use values EXPLICITLY stated on the page. NEVER estimate, guess, or infer measurements."

Files: `utils/llm_extractor.py`, `prompts/base_extraction.md`, and 13 dealer-specific prompts (`aoi_art_v2.py`, `choshuya_v2.py`, `e_sword_v2.py`, `hyozaemon_v2.py`, `iida_koendo_v2.py`, `katana_ando_v2.py`, `kusanagi_v2.py`, `nipponto_v2.py`, `samurai_nippon_v2.py`, `sanmei_v2.py`, `shoubudou_v2.py`, `touken_komachi_v2.py`, `touken_matsumoto_v2.py`, `wakeidou.py`)

*Layer 2 — BaseScraper raw_page_text passthrough (`scrapers/base.py`):*
`_extract_with_llm()` now checks if `listing.raw_page_text` is already set and uses it directly, instead of re-parsing HTML and stripping scripts.

**Approach rejected:** A sentinel value filter was implemented, tested, and removed — it created false positives since real measurements (kasane=0.7) can match old prompt examples.

**Verification (10 sample items scraped 3 times):**

| Test run | Real specs | Accuracy |
|----------|-----------|----------|
| Before fix | 0% (all hallucinated) | N/A |
| Prompt fix only | 0% (all null — Bug #2 exposed) | N/A |
| Prompt + raw_page_text fix | **92%** (46/50 real, 4 legit nulls) | **100%** |

**Full postmortem:** `docs/POSTMORTEM_LLM_SPEC_HALLUCINATION.md`

---

### 3. Banner Images in GJ Featured Items (fix: `142c515`)

**Problem:** 6 GJ featured items (`00_*.htm` pages) had issue banner images (e.g., `banner357.jpg`, `gallary_banner350.jpg`) as their first image, displayed prominently on nihontowatch.com.

**Affected listings:** IDs 53216, 53229, 53240, 53253, 53268, 32591

**Root cause:** `.htm` featured pages don't use the `img.img-thumbnail` CSS class that the Choshuya image extractor targets, so the generic base class `_extract_images()` captured everything including banners. No filter existed for "banner" filenames.

**Fix:**
- Added `'banner'` to `_is_placeholder_image()` patterns in `scrapers/base.py`
- Cleaned up all 6 database records (removed banner, product images preserved)

---

### 4. Missing Certifications — Conservative Extractor Gap (fix: `316f99e`)

**Problem:** 89/142 GJ listings (63%) had no certification in the database. Investigation revealed the conservative cert extractor (`classify_cert_conservative()`) rejected real certs because Choshuya GJ pages use non-standard formats:
- Japanese: `特別保存 (則重）` — no `刀剣` suffix (extractor required it)
- English: `Tokubetsu-Hozon (Norishige)` — hyphenated form (not matched by any pattern)

**Root cause:** The conservative extractor was designed for HTML pages with navigation noise. Its patterns require full cert names like `特別保存刀剣` or structured markers like `鑑定書:`. Choshuya GJ pages use abbreviated Japanese forms and English hyphenated names.

**Fix:**
- Added English hyphenated patterns: `Tokubetsu-Hozon`, `Tokubetsu-Juyo`
- Added English cert+price patterns: `Juyo ¥X`, `Hozon ¥X`
- Added Japanese cert without suffix + contextual markers (parenthetical/price/dash)
- Fixed `CERT_PATTERNS` to allow hyphens in title extraction (`tokubetsu[\s-]*hozon`)
- Placed new patterns AFTER structured patterns to prevent priority conflicts with Choshuya catalog pages that have translation errors (e.g., `保存刀装具鑑定書` + `Tokubetsu-hozon` mismatch)
- 19 new tests + 3 false-positive guard tests
- Updated 62 GJ listings + 1 miscategorized listing (32609: Juyo→TokuHozon)

**Result:**
| Metric | Before | After |
|--------|--------|-------|
| No-cert GJ listings | 89/142 (63%) | 27/142 (19%) |
| Fixable items corrected | 0 | 62 |
| Remaining no-cert | — | 27 (13 koshirae + 14 uncertified) |

---

## Outstanding Action Items

- [ ] Re-scrape all 68 Choshuya listings with bogus specs to correct database values
- [ ] Audit other dealers for JavaScript-only measurement data (same BaseScraper bug)
- [ ] Add statistical QA check: flag batches where >30% share identical spec values
