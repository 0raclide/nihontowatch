# Certification Extraction Bugs

**Living document** tracking false positive and false negative certification extraction issues across the scraping pipeline.

**Status:** Active — append new issues as they're discovered.

---

## How Cert Extraction Works

Certification is extracted via a layered pipeline in `Oshi-scrapper/utils/llm_extractor.py`:

```
classify_cert_conservative(title, body)
  │
  ├─ Step 1: Title extraction (extract_cert_from_title)
  │    Most reliable — cert in title is almost always accurate
  │    Exclusions: "candidate", "equivalent", comparison contexts
  │
  └─ Step 2: Body extraction (extract_cert_from_body_conservative)
       Structured patterns only, checked in priority order:
       1. 鑑定書: [cert_type]           — structured field
       2. 第XX回 [cert_type]            — session number
       3. 日本美術刀剣保存協会 [cert]    — organization prefix
       4. [cert][NBTHK]                 — English NBTHK reference
       5. Designated Juyo Token...       — English designation
       6. Juyo Token Zufu               — documentation reference
       7. [cert_type]鑑定書              — cert BEFORE 鑑定書 (broadened, no suffix required)
       8. Standalone 刀剣/刀装具 certs   — with multi-guard system (nav, pipe, product-number)
       9. 重要美術品 + positive marker    — requires structural evidence (証書, 文部省, 白鞘, 指定)
```

**Two extraction paths exist per dealer:**
- **LLM path** (`use_llm=True`, default): LLM extracts cert → conservative extractor **overrides** it (lines 737-756). Scraper's own `_extract_certification()` is NOT called.
- **Regex path** (`use_llm=False` or LLM failure): Scraper's own `_extract_certification()` runs.

**Key invariant:** The conservative extractor is the single source of truth when LLM is enabled. Dealer-specific `_extract_certification()` methods are only used as fallback.

---

## Bug Log

### BUG-008: Juyo false positives — biographical smith references + dead pages

**Date:** 2026-02-11
**Severity:** Low — 5 listings affected
**Dealers:** World Seiyudo (ID 34), Nihon Art (ID 80), Samurai Nippon (ID 3)
**Status:** Resolved
**Commits:** DB correction only (no code change needed — extractor is correct, these were legacy data)

**Symptoms:** 3 listings had `cert_type = 'Juyo'` from biographical/statistical references to other swords, not this item's cert. 2 additional listings were dead pages with no verifiable content.

**Affected listings:**

| ID | Dealer | Title | Issue |
|----|--------|-------|-------|
| 32766 | World Seiyudo | Tsuba Nakai Zensuke Tomotsune | `重要刀装具指定品もあります` — describes maker's body of work |
| 32258 | World Seiyudo | Wakizashi Yukinaga | `重要刀剣に化けている` — describes maker, item is NTHK |
| 49752 | Nihon Art | Shodai Soshu Masahiro | "28 Juyo and higher works of Hiromitsu" — counting a smith's designations |
| 1308 | Samurai Nippon | 無題ドキュメント | Dead page (404), original content lost |
| 1310 | Samurai Nippon | 無題ドキュメント | Dead page (404), original content lost |

**Fix:** Set `cert_type = NULL` for all 5 listings. No code change required — these were legacy values from before the conservative extractor was implemented.

**Discovery:** Found during full QA audit (see QA-001 below).

---

### BUG-007: 11 false positive Juyo Bijutsuhin from biographical/parenthetical text

**Date:** 2026-02-11
**Severity:** High — 11 of 19 Jubi listings were false (58% false positive rate)
**Dealers:** Choshuya (7), World Seiyudo (2), Samurai Nippon (1), Goushuya (1)
**Status:** Resolved (commit `d631353`)

**Symptoms:** 11 listings showed `cert_type = 'Juyo Bijutsuhin'` when `重要美術品` appeared only in biographical/reference context describing OTHER swords.

**Affected listings:**

| ID | Dealer | Pattern |
|----|--------|---------|
| 33363, 33443, 33540, 33576, 33612, 35669, 35980 | Choshuya | `Xの刀（重要美術品）` — parenthetical reference to a different sword |
| 4314 | Choshuya | `重要美術品の太刀よりも` — comparative reference |
| 31299 | World Seiyudo | `重要文化財や重要美術品などに` — general category listing |
| 2162 | Samurai Nippon | `重要美術品に指定された名物水神切りの写し` — item is a COPY of a Jubi sword |
| 42992 | Goushuya | Sidebar category navigation |

**Root cause:** The standalone `重要美術品` body match (pattern 8) fired on ANY mention in raw text with only 3 narrow exclusions (nav counts, counting context, `にも`). This was fundamentally too permissive for a pre-war designation that appears frequently in biographical commentary.

**Fix:** Replaced the loose "match anywhere, exclude a few" approach with **positive-marker-only** detection. Body `重要美術品` now requires one of 5 high-confidence structural markers:

```python
jubi_positive_markers = [
    r'証書\s*重要美術品',                       # Structured cert field (Shoubudou)
    r'文部省\s*重要美術品',                      # Government designation
    r'重要美術品\s*(?:白鞘|拵付|拵(?!え))',       # Metadata line (Hyozaemon)
    r'(?:認定|指定)\s*(?:の\s*)?重要美術品',     # Designation before Jubi
    r'重要美術品\s*(?:認定|指定)',               # Designation after Jubi
]
```

**Result:** 19 → 8 genuine Jubi listings. All 8 are caught: 6 via title, 2 via body markers. 14 new tests added (108 total).

**Durability:** Three-layer protection ensures re-scrapes cannot re-introduce false positives:
1. Conservative extractor returns `None` for biographical mentions
2. No `Certification` object created when cert_type is `None`
3. Supabase upsert omits `cert_type` from update dict, preserving DB `NULL`

---

### BUG-006: 1,779 missing certs — standalone cert names not detected

**Date:** 2026-02-11
**Severity:** High — 1,779 listings had no cert when they should have
**Dealers:** 25+ dealers (Choshuya 510, Tokka Biz 274, Eirakudo 178, Goushuya 132, ...)
**Status:** Resolved (commit `2e94236`)
**Trigger:** Listing 5268 (Hyozaemon, Yoshifusa wakizashi) — Tokubetsu Hozon cert not detected

**Symptoms:** Dealers using inline metadata format (e.g., `鎌倉中期　備前　特別保存刀剣　白鞘`) without structured markers had no cert extracted. The conservative extractor had no pattern for standalone cert names like `特別保存刀剣` outside of structured fields.

**Root cause:** All existing body patterns required a structural prefix (`鑑定書:`, `第XX回`, `日本美術刀剣保存協会`, `NBTHK`, `鑑定書付`). Plain cert names in metadata lines were invisible.

**Fix:** Added two new patterns:

1. **Broadened `鑑定書` pattern** (pattern 7): Removed `[付附]` suffix requirement. Now matches `保存刀剣鑑定書` (Nipponto) and `鑑定書附` (Tokka Biz formal kanji).

2. **Standalone cert name pattern** (pattern 8) with 7 guards:
   - Regex exclusions: `(?!等)`, `(?!一覧)`, nav counts, legend parens, brackets
   - Post-match guards: multi-type (≥3 cert groups = nav menu), pipe-list, product-number prefix

**Bulk fix:** 1,779 listings fixed, 0 errors. 41 Nipponto standalone-only items correctly skipped (indistinguishable nav links).

---

### BUG-005: Samurai Nippon biographical `重要美術品にも` false positive

**Date:** 2026-02-11
**Severity:** Medium — 2 listings affected
**Dealer:** Samurai Nippon (ID 3)
**Status:** Resolved

**Symptoms:** Listings 2151 (katana) and 2201 (kozuka) showed `cert_type = 'Juyo Bijutsuhin'` when actual cert was Tokubetsu Hozon.

**Affected listings:**

| ID | Title | Actual Cert | False Cert |
|----|-------|-------------|------------|
| 2151 | 刀 無銘(伝来国行) | TokuHozon (特別保存刀剣鑑定書付き) | Juyo Bijutsuhin |
| 2201 | 小柄:波に三疋鯱図 | TokuHozon (特別保存刀装具鑑定書付き) | Juyo Bijutsuhin |

**Root cause:** Two compounding issues:

1. **Primary:** The standalone `重要美術品` check (pattern 8) matched biographical text about the smith's historical significance, not the item's cert:
   - 2201: `宗民の作は文化財、重要美術品にも数多く指定され` ("Somin's works have been designated as cultural properties, also as Juyo Bijutsuhin in large numbers")
   - 2151: `重要美術品十一口を数える名工` ("master counting 11 Juyo Bijutsuhin pieces")

2. **Secondary:** These listings were originally scraped **before** the `[cert]鑑定書付き` pattern (pattern 7) was added in commit `3de20c2` (Feb 9). With pattern 7 in place, `特別保存刀装具鑑定書付き` matches first and correctly returns TokuHozon, preventing the false positive at pattern 8.

3. **Tertiary:** The `にも` biographical context wasn't covered by existing exclusions (which only caught nav counts and `[kanji-number]+[counter]` patterns).

**Fix:**

| Change | File | Detail |
|--------|------|--------|
| DB correction | Production DB | Set `cert_type = 'TokuHozon'` for listings 2151, 2201 |
| New exclusion | `utils/llm_extractor.py:263` | Added `重要美術品にも` biographical exclusion (third pattern) |
| Tests | `tests/test_title_first_cert.py` | 3 new tests: `test_jubi_biographical_nimo_not_matched`, `test_jubi_biographical_nimo_variant`, `test_listing_2201_kozuka_somin` |

**Prevention:** Three exclusion patterns now guard the standalone `重要美術品` check:
1. `重要美術品\s*[（(]\d+[）)]` — navigation counts
2. `重要美術品[kanji-numbers]+[口点品振]` — counting contexts
3. `重要美術品にも` — biographical "also as Jubi" context

---

### BUG-004: `[cert]鑑定書付き` pattern missing from conservative extractor

**Date:** 2026-02-09
**Severity:** Medium — unknown number of listings affected
**Status:** Resolved (commit `3de20c2`)

**Symptoms:** Items with `特別保存刀剣鑑定書付き` or `重要美術品鑑定書付き` in body text were not having their certs extracted from the `鑑定書付き` format.

**Root cause:** The conservative body extractor only matched structured fields (`鑑定書:` prefix), session numbers (`第XX回`), and org prefixes (`日本美術刀剣保存協会`). The very common `[cert_type]鑑定書付き` format ("with [cert] certificate") was not a recognized pattern.

**Fix:** Added pattern 7 to `extract_cert_from_body_conservative()` — matches cert type immediately before `鑑定書付`:

```python
match = re.search(r'(特別重要刀剣|...|保存刀装具)鑑定書付', raw_text)
```

**Key insight:** This pattern is checked BEFORE the standalone `重要美術品` check, which means false positives from biographical text are now prevented as long as the item has a `鑑定書付き` reference for its actual cert.

---

### BUG-003: Choshuya `第XX回重要刀剣` reference false positives

**Date:** 2026-02-07
**Severity:** Low — items from Choshuya senrigan pages
**Status:** Resolved (commit `b6bb302`)

**Symptoms:** Choshuya senrigan (expert appraisal) pages reference OTHER famous works in their descriptions using patterns like `（第25回重要刀剣）`. The session-number pattern matched these parenthesized references.

**Root cause:** Pattern 2 (`第XX回 [cert_type]`) didn't exclude matches inside parentheses. Parenthesized references are citations to other works, not this item's cert.

**Fix:** Added negative lookbehind `(?<!（)` to pattern 2:

```python
match = re.search(r'(?<!（)第[一二三四五六七八九十〇\d]+回\s*(cert_types)', raw_text)
```

---

### BUG-002: Nipponto navigation menu `重要刀剣` false positives

**Date:** 2026-02-07
**Severity:** Medium — 4 listings affected
**Dealer:** Nipponto (ID 7)
**Status:** Resolved
**Full writeup:** [NIPPONTO_JUYO_FALSE_POSITIVE_FIX.md](./NIPPONTO_JUYO_FALSE_POSITIVE_FIX.md)

**Symptoms:** 4 items incorrectly classified as "Juyo" — the text `重要刀剣` in the site navigation menu was matched as a certification indicator.

**Affected listings:**

| ID | Title | Actual Cert | False Cert |
|----|-------|-------------|------------|
| 4572 | 保昌（末） Hosho | Hozon | Juyo |
| 4575 | 和州住則長 Washuju Norinaga | Hozon | Juyo |
| 4685 | 無銘 和気 Wake | Hozon | Juyo |
| 4821 | 筑紫薙刀 Tsukushi Naginata | None | Juyo |

**Root cause:** Nipponto's `_extract_certification()` body search matched nav menu text `重要刀剣` (a category link for "Important Swords"), not actual cert data.

**Fix:** Modified `scrapers/nipponto.py` to require structured `[cert]鑑定書` format for body matches. Added 6 regression tests.

---

### BUG-001: Generic LLM cert hallucination

**Date:** 2026-01-17
**Severity:** High — systemic across all LLM-extracted dealers
**Status:** Resolved (commit `af42999`)

**Symptoms:** LLM (Gemini Flash) would extract cert types from contextual mentions, navigation menus, legends, and category labels across many dealers.

**Root cause:** LLMs treat any mention of a cert type as the item's certification. No regex validation existed to verify LLM cert claims.

**Fix:** Created the entire conservative cert extraction pipeline (`classify_cert_conservative`). The LLM cert is now ALWAYS overridden by the conservative regex result (lines 737-756 of `llm_extractor.py`). If the conservative extractor returns None, the cert is cleared entirely.

---

## Known Risks

### Standalone `重要美術品` — RESOLVED (2026-02-11)

Previously the most dangerous pattern. Now uses **positive-marker-only** detection (BUG-007). The loose "match anywhere" approach has been fully replaced. Only matches with structural evidence like `証書`, `文部省`, `白鞘` metadata lines, or `指定/認定` language.

### Standalone `重要刀剣/刀装具` — low risk

The standalone cert name pattern (pattern 8) has 7 guards (regex exclusions + post-match guards for multi-type nav, pipe-lists, and product-number prefixes). Full QA audit (QA-001) found only 3 false positives out of 423 Juyo listings (99.3% accuracy), and those were legacy data from before the conservative extractor existed.

**Remaining edge case:** Nipponto standalone `重要刀剣` nav links are indistinguishable from genuine cert mentions when no other signal exists. Currently handled by the multi-type guard (Nipponto pages list ≥3 cert categories in nav). All 14 actual Nipponto Juyo listings have `重要刀剣` in their titles, so the title pattern catches them first.

### Stale refresh doesn't re-extract certs

The stale refresh pipeline (`refresh_stale.py`) runs `scraper.scrape(url)` which includes full LLM extraction with the conservative override. However, there's a `extract_from_raw.py --limit 100` step that only processes 100 items. If the LLM call fails or the limit is hit, items may keep stale cert values.

**Action if cert bugs are found on recently-scraped items:** Run the conservative extractor manually against `raw_page_text` to verify the code is correct, then update the DB directly.

---

## Diagnostic Queries

### Find all listings with a specific cert type
```sql
SELECT id, url, title, cert_type, dealer_id, last_scraped_at
FROM listings
WHERE cert_type = 'Juyo Bijutsuhin'
  AND is_available = true
ORDER BY dealer_id, id;
```

### Test conservative extractor on a listing
```python
cd Oshi-scrapper
python3 -c "
import os, sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()
from supabase import create_client
from utils.llm_extractor import classify_cert_conservative

client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
r = client.table('listings').select('title, raw_page_text').eq('id', LISTING_ID).single().execute()
result = classify_cert_conservative(r.data['title'] or '', r.data['raw_page_text'] or '')
print(f'Conservative cert: {result}')
"
```

### Find potential false positives (biographical 重要美術品)
```sql
SELECT id, title, cert_type, dealer_id
FROM listings
WHERE cert_type = 'Juyo Bijutsuhin'
  AND raw_page_text LIKE '%重要美術品にも%'
  AND raw_page_text LIKE '%特別保存%';
```

### Spot-check a dealer's cert accuracy
```sql
SELECT cert_type, COUNT(*) as count
FROM listings
WHERE dealer_id = DEALER_ID
  AND is_available = true
  AND cert_type IS NOT NULL
GROUP BY cert_type
ORDER BY count DESC;
```

---

## Key Files

| File | Purpose |
|------|---------|
| `Oshi-scrapper/utils/llm_extractor.py` | Conservative cert extraction pipeline (`extract_cert_from_body_conservative`, `classify_cert_conservative`) |
| `Oshi-scrapper/tests/test_title_first_cert.py` | 108 tests for cert extraction (golden tests, regression tests, guard tests) |
| `Oshi-scrapper/scrapers/base.py:737-756` | LLM cert override logic (conservative always wins) |
| `Oshi-scrapper/scrapers/<dealer>.py` | Dealer-specific `_extract_certification()` (regex fallback path) |

---

## QA Audit Log

### QA-001: Full cert_type designation audit (2026-02-11)

**Scope:** All `Juyo Bijutsuhin` (19) and `Juyo` (423) cert_type listings — 442 total across 34 dealers.

**Method:** 5 parallel sub-agents, each auditing a dealer group. Every listing inspected: title checked for cert mention, body checked for structured patterns (鑑定書 field, session number, NBTHK org, designated-en, zufu reference), standalone matches analyzed for false positive signals (parenthetical, biographical, nav, counting, pipe-list).

**Results:**

| Cert Type | Total | Genuine | False Positive | Dead Page | Accuracy |
|-----------|-------|---------|----------------|-----------|----------|
| Juyo Bijutsuhin | 19 | 8 | 11 | 0 | 42% → 100% after fix |
| Juyo | 423 | 418 | 3 | 2 | 99.3% |
| **Combined** | **442** | **426** | **14** | **2** | **96.8% → 100% after fix** |

**False positive patterns found:**

| Pattern | Count | Dealers | Example |
|---------|-------|---------|---------|
| Biographical parenthetical `（重要美術品）` | 7 | Choshuya | `Xの刀（重要美術品）` — other sword |
| General reference `重要美術品などに` | 2 | World Seiyudo, Samurai Nippon | Historical commentary |
| Biographical maker `重要刀装具指定品もあります` | 2 | World Seiyudo | Maker's body of work |
| Copy reference `写し` | 1 | Samurai Nippon | Copy of a Jubi sword |
| Sidebar navigation | 1 | Goushuya | Category listing |
| English smith stats "28 Juyo works" | 1 | Nihon Art | Counting another smith |

**Actions taken:**
1. BUG-007: Rewrote `重要美術品` detection to positive-marker-only (commit `d631353`). 11 DB corrections.
2. BUG-008: Nullified 3 Juyo false positives + 2 dead pages. No code change needed.

**Dealer-level findings (no systematic errors):**

| Dealer | Juyo | Result |
|--------|------|--------|
| Eirakudo (63) | All strong-signal | Clean |
| World Seiyudo (62) | 2 biographical FPs | Fixed |
| Token-Net (34) | All strong-signal | Clean |
| Nihon Art (31) | 1 English stats FP | Fixed |
| Samurai Nippon (29) | 2 dead pages | Fixed |
| Aoi Art (23) | All strong-signal | Clean |
| Iida Koendo (23) | All strong-signal | Clean |
| Goushuya (20) | All strong-signal | Clean |
| Shoubudou (17) | All structured (証書/Paper fields) | Clean |
| Nipponto (14) | All title-matched (nav links exist but harmless) | Clean |
| Choshuya (12) | All strong-signal | Clean |
| All others (72) | All genuine | Clean |

**Post-audit cert_type distribution:**

| cert_type | Count |
|-----------|-------|
| TokuHozon | 3,007 |
| Hozon | 2,238 |
| Juyo | 418 |
| Registration | 233 |
| TokuKicho | 71 |
| Tokuju | 18 |
| Hozon Tosogu | 12 |
| Juyo Bijutsuhin | 8 |
| Tokubetsu Hozon Tosogu | 7 |
| Koshu Tokubetsu Kicho | 3 |
| Tokubetsu Kicho Tosogu | 2 |
| nthk | 2 |

---

## Adding a New Bug Entry

When documenting a new cert bug:

1. Assign the next BUG-NNN number
2. Include: date, severity, dealer, affected listing IDs
3. Show the text that caused the false positive/negative
4. Explain which pattern matched (or should have matched)
5. Document the fix (code change + DB correction + tests)
6. Update the "Known Risks" section if the bug reveals a systemic weakness
