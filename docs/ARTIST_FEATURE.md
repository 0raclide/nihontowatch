# Artist Feature — Comprehensive Documentation

**Last updated**: 2026-02-19
**Status**: Live at nihontowatch.com/artists

---

## Overview

The Artist feature is a two-tier system for discovering and exploring 13,572 artisans (12,453 swordsmiths + 1,119 tosogu makers) from the Yuhinkai database:

1. **Artist Directory** (`/artists`) — Browseable, filterable index of all artisans
2. **Artist Profile** (`/artists/[slug]`) — Rich individual profiles with biography, certifications, lineage, provenance, and live listings

Additionally, artisan codes appear as admin-only badges on listing cards throughout the browse experience, with an interactive tooltip for QA verification.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARTIST FEATURE                              │
│                                                                 │
│  ┌──────────────┐       ┌──────────────┐       ┌────────────┐  │
│  │   /artists   │──────▶│/artists/slug │──────▶│  /browse    │  │
│  │  Directory   │       │   Profile    │       │  Listings   │  │
│  └──────┬───────┘       └──────┬───────┘       └──────┬─────┘  │
│         │                      │                      │         │
│         │ SSR + client fetch   │ SSR + client fetch   │         │
│         ▼                      ▼                      ▼         │
│  ┌──────────────┐       ┌──────────────┐       ┌────────────┐  │
│  │ /api/artists │       │/api/artisan/ │       │/api/browse │  │
│  │  /directory  │       │   [code]     │       │?artisan=X  │  │
│  └──────┬───────┘       └──────┬───────┘       └──────┬─────┘  │
│         │                      │                      │         │
│         ▼                      ▼                      ▼         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Yuhinkai Database (Supabase)                │   │
│  │  artisan_makers │ artisan_schools │ gold_values │        │   │
│  │  artisan_school_members │ artisan_teacher_links │        │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            NihontoWatch Main Database                    │   │
│  │  listings (artisan_id, artisan_confidence)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Hybrid SSR + Client Fetch Pattern:**
- Initial page load is server-rendered (SEO-friendly, fast LCP)
- Filter/pagination changes use client-side `fetch()` to API endpoints
- URL updated via `window.history.replaceState()` (shareable URLs, no SSR round-trip)
- `AbortController` cancels in-flight requests on rapid filter changes

---

## File Map

### Pages

| File | Purpose |
|------|---------|
| `src/app/artists/page.tsx` | SSR directory page — metadata, JSON-LD, initial data fetch |
| `src/app/artists/ArtistsPageClient.tsx` | Client directory — filters, search, pagination, artist cards |
| `src/app/artists/[slug]/page.tsx` | SSR profile page — slug resolution, redirects, full data assembly |
| `src/app/artists/[slug]/ArtistPageClient.tsx` | Client profile — hero, biography, certifications, lineage, listings |

### API Routes

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/artists/directory` | `src/app/api/artists/directory/route.ts` | Paginated artist list with facets |
| `GET /api/artisan/[code]` | `src/app/api/artisan/[code]/route.ts` | Artist details (legacy + rich modes) |
| `GET /api/artisan/[code]/listings` | `src/app/api/artisan/[code]/listings/route.ts` | Available listings for artisan |
| `GET /api/artisan/search` | `src/app/api/artisan/search/route.ts` | Admin search for artisan correction |
| `POST /api/listing/[id]/verify-artisan` | `src/app/api/listing/[id]/verify-artisan/route.ts` | Admin QA verification |
| `POST /api/listing/[id]/fix-artisan` | `src/app/api/listing/[id]/fix-artisan/route.ts` | Admin artisan correction |
| `GET/POST /api/admin/sync-elite-factor` | `src/app/api/admin/sync-elite-factor/route.ts` | Elite factor sync webhook |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| ArtisanTooltip | `src/components/artisan/ArtisanTooltip.tsx` | Interactive popup on listing card badges (admin) |
| ArtisanListings | `src/components/artisan/ArtisanListings.tsx` | Grid of available listings on profile page |
| PrestigePyramid | `src/components/artisan/PrestigePyramid.tsx` | Certification hierarchy visualization |
| EliteFactorDisplay | `src/components/artisan/EliteFactorDisplay.tsx` | Elite standing with grade + percentile |
| FormDistributionBar | `src/components/artisan/FormDistributionBar.tsx` | Blade form statistics (katana/wakizashi/etc.) |
| MeiDistributionBar | `src/components/artisan/MeiDistributionBar.tsx` | Signature type distribution |
| RelatedArtisans | `src/components/artisan/RelatedArtisans.tsx` | Same-school peers list |
| SectionJumpNav | `src/components/artisan/SectionJumpNav.tsx` | Sticky section navigation with IntersectionObserver |

### Library

| File | Purpose |
|------|---------|
| `src/lib/supabase/yuhinkai.ts` | Yuhinkai DB client — all artisan queries, types, `getArtisan()`, directory RPC |
| `src/lib/artisan/getArtistPageData.ts` | **Shared service** — `buildArtistPageData(code)` used by both SSR page + API route |
| `src/lib/artisan/slugs.ts` | URL slug generation + extraction (e.g., `masamune-MAS590`) |
| `src/lib/artisan/displayName.ts` | **Display name deduplication** — all artisan name rendering goes through here |
| `src/lib/artisan/schoolExpansion.ts` | `expandArtisanCodes()` — NS-* school code → member codes expansion |
| `src/lib/listing/attribution.ts` | `getAttributionName()` / `getAttributionSchool()` — dual-path field access |
| `src/types/artisan.ts` | `ArtisanPageResponse` type — shared between SSR page, API route, client |
| `src/lib/seo/jsonLd.ts` | JSON-LD generators including `generateArtistDirectoryJsonLd()` |

### CSS

| File | Variables |
|------|-----------|
| `src/app/globals.css` | `--artisan-high`, `--artisan-medium`, `--artisan-low` (badge colors) |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/048_artisan_matching.sql` | `artisan_id`, `artisan_confidence`, `artisan_method` columns |
| `supabase/migrations/049_artisan_verification.sql` | `artisan_verified`, `artisan_verified_at`, `artisan_verified_by` columns |
| `supabase/migrations/050_artisan_elite_factor.sql` | `artisan_elite_factor` denormalized column |

---

## Data Model

### Yuhinkai Database Tables (Unified — migrated 2026-02-19)

> **Migration complete**: All NihontoWatch code now reads from `artisan_makers` + `artisan_schools`.
> Legacy tables (`smith_entities`, `tosogu_makers`) still exist in oshi-v2 DB but are **not queried** by NihontoWatch.
> The `artist_profiles` table is deprecated/empty — AI bios are stored in `artisan_makers.ai_description`.

**`artisan_makers`** — 13,572 artisans (smiths + tosogu makers, unified)
```
maker_id (PK)           — Code like "MAS590", "OWA009", "GOT042"
name_kanji              — Japanese name (e.g., "正宗")
name_romaji             — Romanized name (e.g., "Masamune")
name_romaji_normalized  — Lowercased, macron-stripped (for search)
domain                  — 'sword' | 'tosogu' | 'both' (replaces table selection)
province, era, period, generation
legacy_school_text      — School name (mapped from old `school` column)
teacher_text            — Teacher name (mapped from old `teacher` column)
teacher_id              — FK to another artisan_makers row (structured link)
hawley                  — Hawley reference number (smiths)
fujishiro               — Fujishiro rating (smiths)
toko_taikan             — Tōkō Taikan score (smiths)
specialties             — Array of specialties (tosogu makers)
kokuho_count            — National Treasures
jubun_count             — Important Cultural Properties (Bunkazai)
jubi_count              — Important Art Objects (Bijutsuhin)
gyobutsu_count          — Imperial Collection
tokuju_count            — Tokubetsu Jūyō
juyo_count              — Jūyō
total_items             — Distinct physical works (best-collection priority, mutually exclusive)
elite_count             — Works with elite designations (Kokuho + JuBun + Jubi + Gyobutsu + Tokuju)
elite_factor            — 0.0-1.0 Bayesian ratio: (elite + 1) / (total + 10)
provenance_factor       — Denrai-based provenance score
provenance_count        — Total denrai entries
provenance_apex         — Highest single denrai count
ai_description          — AI-generated markdown biography (replaces artist_profiles table)
ai_description_generated_at — Timestamp of last AI generation
```

**`artisan_schools`** — 173 school entries (NS-* codes)
```
school_id (PK)          — Code like "NS-Osafune", "NS-Goto", "NS-Ko-Bizen"
name_romaji             — School name (e.g., "Osafune")
name_kanji              — Japanese school name
domain                  — 'sword' | 'tosogu' | 'both'
province, era, period
(same cert count columns as artisan_makers)
```

**`artisan_school_members`** — Junction table: school → member artisans
```
school_code (FK)        — References artisan_schools.school_id
member_code (FK)        — References artisan_makers.maker_id
```

**`artisan_teacher_links`** — Junction table: teacher → student relationships
```
teacher_code (FK)       — References artisan_makers.maker_id
student_code (FK)       — References artisan_makers.maker_id
```

**`artisan_aliases_v2`** — 691+ name variants for search
```
maker_id (FK)           — References artisan_makers.maker_id
alias                   — Alternate name (e.g., "Go Yoshihiro" → YOS1434)
```

**`gold_values`** — Yuhinkai catalog items (provenance, form/mei distributions)
```
gold_artisan         — Artisan name (matches name_romaji)
gold_smith_id        — FK to artisan_makers (for smith distribution queries)
gold_maker_id        — FK to artisan_makers (for tosogu distribution queries)
gold_form_type       — Blade/work type (katana, wakizashi, tanto, tachi, tsuba, etc.)
gold_mei_status      — Signature status (signed, mumei, den, kinzogan-mei, shu-mei, etc.)
gold_denrai_owners   — Array of historical collection owners
```

### Unified Lookup Pattern

NihontoWatch uses a single function for all artisan lookups:

```typescript
// src/lib/supabase/yuhinkai.ts
getArtisan(code: string): Promise<ArtisanEntity | null>
// NS-* codes → queries artisan_schools
// All others → queries artisan_makers

// Domain filtering replaces table selection:
getDomainFilter('smith')  → domain IN ('sword', 'both')
getDomainFilter('tosogu') → domain IN ('tosogu', 'both')
```

The `ArtisanEntity` interface is the unified return type for both tables (see `src/lib/supabase/yuhinkai.ts`).
The `entity_type` field is derived: `sword|both` → `'smith'`, `tosogu` → `'tosogu'`.

### Designation Counting: Best-Collection Priority

Each physical object is assigned to its **single highest** designation, making counts mutually exclusive and safely summable. This prevents double-counting (e.g., a Tokuju sword that also has a Juyo record is counted only under Tokuju).

**Priority order** (highest wins):
```
Kokuho (1) > Tokuju (2) > JuBun (3) > Jubi (4) > Gyobutsu/IMP (5) > Juyo (6)
```

**SQL technique**: `DISTINCT ON (artisan_id, object_uuid)` ordered by priority CASE expression.

**Result**: `total_items = kokuho + jubun + jubi + gyobutsu + tokuju + juyo` (exact equality).

**Excluded**: `JE_Koto` (reference data) and `metadata_v2` collections.

**Computed by**: `compute_maker_statistics()` function (oshi-v2 migration `20260209010000_best_collection_maker_stats.sql`).

### Main Database Columns on `listings`

```
artisan_id           — Matched artisan code (e.g., "MAS590")
artisan_confidence   — 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
artisan_method       — How the match was made (exact_kanji, romaji_exact, school_fallback, etc.)
artisan_candidates   — JSON array of alternative matches
artisan_matched_at   — Timestamp of matching
artisan_verified     — Boolean (admin QA)
artisan_verified_at  — Timestamp
artisan_verified_by  — Admin user ID
artisan_elite_factor — Denormalized elite_factor from Yuhinkai (synced via webhook)
```

---

## Display Name Deduplication

**File:** `src/lib/artisan/displayName.ts`

The Yuhinkai database stores `school` and `name_romaji` as separate fields. Naively concatenating them produces duplicates like "Goto Gotō", "Shōami Shōami Denbei", or shows the wrong person entirely. All artisan name rendering goes through `getArtisanDisplayParts()`.

### How It Works

The function takes `(nameRomaji, school)` and returns `{ prefix, name }`. The prefix renders in lighter weight before the name. Rules are applied in order — first match wins:

| Rule | Condition | Result | Example |
|------|-----------|--------|---------|
| **1** | school = name (macron-normalised) | Just name, no prefix | school="Gotō", name="Gotō" → **Gotō** |
| **2** | Name starts with school (whole word) | Just name, no prefix | school="Shōami", name="Shōami Denbei" → **Shōami Denbei** |
| **2b** | School starts with name (whole word) | School as display | school="Oishi Sa", name="Oishi" → **Oishi Sa** |
| **3** | School ends with name (space or hyphen) | School as display | school="Sue-Naminohira", name="Naminohira" → **Sue-Naminohira** |
| **3b** | Name is a token in school (handles `/`) | School as display | school="Natsuo / Tokyo Fine Arts", name="Natsuo" → **Natsuo / Tokyo Fine Arts** |
| **4** | Lineage: last school word shares 4-char root with name | School prefix + real name | school="Horikawa Kunihiro", name="Kunitomo" → **Horikawa Kunitomo** |
| **5** | First word is geographic (province/city) | Strip geo + name | school="Osaka Gassan", name="Sadakazu" → **Gassan Sadakazu** |
| **6** | Default | School as prefix + name | school="Osafune", name="Kanemitsu" → **Osafune Kanemitsu** |

### Macron Normalisation

All comparisons use `norm()` which lowercases and strips macrons: "Gotō" → "goto", "Shōami" → "shoami". This ensures "Goto" and "Gotō" compare equal.

### Geographic Prefixes (`GEO_PREFIXES` set)

~70 Japanese provinces + major cities. When the first word of a multi-word school matches, it gets stripped (e.g., "Osaka" from "Osaka Gassan"). **Exception:** if stripping leaves only a generic word like "Province", "School", "Group", the prefix is dropped entirely and just the name is shown.

### Rule 5 Safe Words (`GENERIC_WORDS` set)

Words that should never stand alone as a display prefix: `province`, `school`, `group`, `branch`, `style`. This prevents "Nagato Province" → "Province Tomochika" (391 tosogu makers had this bug).

### Consumers

All three files import from `displayName.ts` — never inline the logic:

| File | Usage | Function |
|------|-------|----------|
| `src/app/artists/ArtistsPageClient.tsx` | Directory card name | `getArtisanDisplayParts()` |
| `src/app/artists/[slug]/ArtistPageClient.tsx` | Profile hero name | `getArtisanDisplayParts()` |
| `src/app/artists/[slug]/page.tsx` | Metadata `<title>` | `getArtisanDisplayParts()` |
| `src/app/api/browse/route.ts` | Badge text on listing cards | `getArtisanDisplayName()` |

### How to Fix a Display Name Bug

1. **If the name renders wrong for a specific artisan:** Check the `legacy_school_text` and `name_romaji` values in the Yuhinkai DB (`artisan_makers` table). If the school value is wrong, fix it there (use oshi-v2 service key). See "Database Corrections" below.

2. **If an entire class of names renders wrong:** Add/modify a rule in `getArtisanDisplayParts()`. Rules are ordered — be careful about rule precedence. Test with `npx tsx -e` using the pattern in `docs/SESSION_20260209_DISPLAY_NAME_AUDIT.md`.

3. **If a province/city is missing from geo-stripping:** Add it to the `GEO_PREFIXES` set. Include alternate romanisations (e.g., both "tamba" and "tanba").

4. **If a new generic word causes "Province"-style bugs:** Add it to `GENERIC_WORDS`.

### Database Corrections

The Yuhinkai database is in a **separate Supabase project** from NihontoWatch:

- **URL:** `YUHINKAI_SUPABASE_URL` (in oshi-v2 `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`)
- **Service key:** `SUPABASE_SERVICE_ROLE_KEY` (in oshi-v2 `.env.local`)
- **Table:** `artisan_makers` (PK: `maker_id`) — unified for both smiths and tosogu makers
- **Schools:** `artisan_schools` (PK: `school_id`) — for NS-* school codes

Common corrections:
- Fix a wrong school value: `PATCH /rest/v1/artisan_makers?maker_id=eq.XXX` with `{"legacy_school_text": "Correct Value"}`
- Fix a wrong teacher: `PATCH /rest/v1/artisan_makers?maker_id=eq.XXX` with `{"teacher_text": "Correct Value"}`
- Create a missing school: `POST /rest/v1/artisan_schools` with `school_id: "NS-SchoolName"`, `name_romaji` = school name, `domain` = `'sword'|'tosogu'`
- NS- code naming: `NS-` + CamelCase school name (e.g., `NS-SueNaminohira`, `NS-KoMihara`)
- Add a school member: `POST /rest/v1/artisan_school_members` with `school_code: "NS-XXX"`, `member_code: "XXX999"`

### Audit History

Full audit of 13,605 records completed 2026-02-09. See `docs/SESSION_20260209_DISPLAY_NAME_AUDIT.md` for:
- All bug categories found and fixed
- Record counts per bug type
- Test case patterns for verifying fixes

### Known Edge Cases (Low Priority)

- "Waki-Goto Branches and Students" (22 records): Very long school name (31 chars). Data quality issue — could be shortened in DB.
- "Miike" school + "Mike" name: Single-char difference not caught by any rule. Displays "Miike Mike".

---

## Feature Details

### 1. Artist Directory (`/artists`)

**Default view:** ~1,400 notable artisans (those with `total_items > 0`) sorted by elite factor descending.

**Filters:**
- **Type toggle**: All / Smiths / Tosogu
- **School dropdown**: Aggregated from both tables (e.g., Soshu, Bizen, Yamashiro)
- **Province dropdown**: Aggregated provinces
- **Era dropdown**: Aggregated eras
- **Search**: 300ms debounced, matches `name_romaji`, `name_kanji`, `maker_id` via `ilike`. Also searches `artisan_aliases_v2` for variant names (e.g., "Go Yoshihiro" → YOS1434).
- **Sort**: Elite Factor (default), Juyo Count, Total Works, Name A-Z
- **Notable toggle**: When unchecked, shows all 13,572 artisans including those with zero certified works

**Pagination:** 50 per page (API supports up to 100). Uses `get_directory_enrichment()` RPC (migration 386) which queries the unified `artisan_makers` table with domain filtering.

**Artist Cards display:**
- Name (romaji + kanji)
- Entity type badge (Smith / Tosogu)
- School / Era / Province
- **All 6 designation counts** (if > 0): Kokuho (red), Jubun (amber), Jubi (amber/80), Gyobutsu (purple), Tokuju (gold), Juyo (ink)
- Total certified works count
- **"N for sale" link** — clickable, navigates to `/browse?artisan=CODE&listing=ID` opening QuickView. Uses `stopPropagation` so clicking the card body navigates to the profile.
- Elite factor progress bar (0-100%)

**SEO:**
- SSR with dynamic `<title>` and `<meta description>` based on active filters
- JSON-LD: BreadcrumbList + CollectionPage with top 10 artists as ItemList
- Canonical: `/artists`

**Caching:** API response cached 1 hour (`s-maxage=3600, stale-while-revalidate=86400`).

### 2. Artist Profile (`/artists/[slug]`)

**URL format:** `/artists/masamune-MAS590` (name-code slug). Bare codes like `/artists/MAS590` are 301-redirected to the full slug.

**Sections:**

1. **Overview** (always shown)
   - Kanji watermark (80-110px, 5% opacity)
   - Gold accent line
   - Name (romaji, 4-5xl serif) + kanji subtitle
   - Grade badge (S/A circle, hanko motif) — only for S and A grades
   - Hook quote (pull-quote with gold left border)
   - **Stats bar** with all 6 designation counts: Kokuhō, Jūyō Bunkazai, Jūyō Bijutsuhin, Gyobutsu, Tokubetsu Jūyō, Jūyō + Fujishiro stars + Available Now count
   - Vitals grid: Province, Era, Period, School, Generation, Teacher (linked), Fujishiro, Tōkō Taikan (with percentile), Specialties, Provenance (denrai owners), Type, Code

2. **Certifications** (if `total_items > 0`)
   - PrestigePyramid: visual hierarchy of all 6 designation types
   - EliteFactorDisplay: percentile-based elite standing bar

3. **Provenance** (if denrai data exists)
   - Historical collection owners table from gold_values

4. **Blade Forms** (if form data exists in gold_values)
   - Heading: "Blade Forms" for smiths, "Work Types" for tosogu makers
   - FormDistributionBar: blade forms (katana, wakizashi, tantō, etc.)
   - Data source: `gold_values.gold_form_type` aggregated by artisan code (profile snapshot as fast-path)

5. **Signatures** (if mei data exists in gold_values)
   - MeiDistributionBar: signature types (signed, mumei, den, kinzōgan mei, shū mei, kinpun mei, ginzōgan mei, kiritsuke mei, shūsho mei, etc.)
   - Data source: `gold_values.gold_mei_status` aggregated by artisan code (profile snapshot as fast-path)
   - Migration 267 resolved generic 'attributed' → specific types via `mei.attribution_type`

6. **Currently Available** (if listings exist)
   - Grid of listing cards fetched client-side from `/api/artisan/[code]/listings`
   - Links to individual listing detail pages

7. **Lineage** (if teacher or students found)
   - Vertical timeline with connection line
   - Teacher → Current artisan → Students
   - All names are links to their profile pages

8. **Related Artisans** (if same-school peers exist)
   - Up to 12 peers from the same school, sorted by elite_factor
   - Shows name, kanji, tokuju/juyo counts

**Navigation:** Sticky section jump nav (SectionJumpNav) uses IntersectionObserver to highlight the active section as the user scrolls.

**SEO:**
- Dynamic metadata with name, school, province, juyo/tokuju counts
- JSON-LD: Person schema + BreadcrumbList
- Canonical: `/artists/[slug]`

### 3. Artisan Badges on Listing Cards (Admin Only)

- Badge appears on **right side** of certification row in ListingCard
- Color-coded by `artisan_confidence`:
  - **GREEN** (HIGH): exact kanji match or LLM consensus
  - **YELLOW** (MEDIUM): romaji match or school fallback
  - **GRAY** (LOW): LLM disagreement
- Only visible to admin users
- Clicking opens ArtisanTooltip with:
  - Full artisan details (name, school, era, cert counts)
  - Match method and alternative candidates
  - **Verification buttons**: Correct / Incorrect (saved to DB)
  - **Correction mode**: Search-based artisan reassignment

### 4. Browse Integration

- URL param `?artisan=MAS590` filters listings by artisan_id (substring match)
- URL param `&listing=ID` auto-opens QuickView for that listing
- Search box auto-detects artisan code patterns (uppercase 2-4 letters + 2-4 digits)
- "For sale" links on directory cards combine both params for seamless flow

---

## Key Types

### `ArtistDirectoryEntry` (yuhinkai.ts)
```typescript
interface ArtistDirectoryEntry {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  entity_type: 'smith' | 'tosogu';
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_factor: number;
  denrai_owners?: Array<{ owner: string; count: number }>;
  available_count?: number;
  first_listing_id?: number;
}
```

### `ArtisanPageResponse` (src/types/artisan.ts)

Shared between SSR page and API route via `buildArtistPageData()` in `src/lib/artisan/getArtistPageData.ts`.

```typescript
interface ArtisanPageResponse {
  entity: { code, name_romaji, name_kanji, school, province, era, period,
            generation, teacher, entity_type, is_school_code, slug,
            fujishiro, toko_taikan, specialties };
  certifications: { kokuho_count, jubun_count, jubi_count, gyobutsu_count,
                    tokuju_count, juyo_count, total_items, elite_count, elite_factor };
  rankings: { elite_percentile, toko_taikan_percentile, provenance_percentile };
  provenance: { factor, count, apex };
  profile: { profile_md, hook, setsumei_count, generated_at } | null;
  stats: { mei_distribution, form_distribution, measurements_by_form } | null;
  lineage: { teacher: { code, name_romaji, slug } | null,
             students: Array<{ code, name_romaji, slug, available_count? }> };
  related: Array<{ code, name_romaji, name_kanji, slug, school,
                   juyo_count, tokuju_count, elite_factor, available_count? }>;
  denrai: Array<{ owner: string; count: number }>;
  denraiGrouped: Array<{ parent, totalCount, children, isGroup }>;
  heroImage: { imageUrl, collection, volume, itemNumber, formType, imageType } | null;
  catalogueEntries?: CatalogueEntry[];
}
```

### Elite Grading Scale
```
S: percentile >= 95  — Exceptional
A: percentile >= 80  — Distinguished
B: percentile >= 60  — Notable
C: percentile >= 40  — Moderate
D: percentile <  40  — Standard
```

---

## Slug System

**Generation** (`generateArtisanSlug`):
- Input: `("Masamune", "MAS590")` → Output: `"masamune-MAS590"`
- Unicode normalization: ō→o, ū→u
- Strips non-alphanumeric chars
- NS-* codes: no prefix (e.g., `NS-Goto`)

**Extraction** (`extractCodeFromSlug`):
- Pattern: `[A-Z]{2,4}\d{2,4}` or `NS-[A-Za-z]+`
- Input: `"goto-ichijo-GOT042"` → Output: `"GOT042"`

**Bare code redirect** (`isBareCode`):
- `/artists/MAS590` → 301 redirect → `/artists/masamune-MAS590`

---

## Sitemap Integration

In `src/app/sitemap.ts`:
- `/artists` — priority 0.8, weekly
- All notable artisan profiles (~8K URLs) — priority 0.6, monthly
- Fetches from `artisan_makers` where `total_items > 0`, using domain filtering for entity_type derivation
- Uses `generateArtisanSlug()` for each URL

---

## Caching Strategy

| Endpoint | Cache | Stale-while-revalidate |
|----------|-------|----------------------|
| `/api/artists/directory` | 1 hour | 24 hours |
| `/api/artisan/[code]` | 1 hour | 24 hours |
| `/api/artisan/[code]/listings` | 5 minutes | 10 minutes |

---

## Data Flow: Listing → Artisan Match

```
Oshi-scrapper (Python)
  → artisan_matcher/ module
  → Matches listing title/smith/school to Yuhinkai entries
  → Stores artisan_id, artisan_confidence, artisan_method in listings table
  → Webhook → /api/admin/sync-elite-factor → syncs elite_factor to listings

NihontoWatch (Next.js)
  → Reads artisan_id from listings
  → Shows badge on ListingCard (admin)
  → Counts available listings per artisan for directory cards
  → Links "for sale" to /browse?artisan=CODE&listing=ID
```

---

## Environment Variables

```bash
# Yuhinkai database (separate Supabase project)
YUHINKAI_SUPABASE_URL=https://xxx.supabase.co       # or OSHI_V2_SUPABASE_URL
YUHINKAI_SUPABASE_KEY=xxx                             # or OSHI_V2_SUPABASE_KEY

# Used by sync-elite-factor webhook
CRON_SECRET=xxx
```

---

## URL Examples

```
# Directory
/artists                                    — All notable, sorted by elite factor
/artists?type=smith                         — Smiths only
/artists?type=tosogu                        — Tosogu makers only
/artists?province=Bizen                     — Bizen province filter
/artists?school=Soshu                       — Soshu school filter
/artists?q=Masamune                         — Search by name
/artists?sort=juyo_count&page=3             — Sort + paginate
/artists?notable=false                      — Include all 13K artisans

# Profiles
/artists/masamune-MAS590                    — Individual profile
/artists/goto-ichijo-GOT042                 — Tosogu maker profile
/artists/MAS590                             — Bare code → 301 redirect

# Browse integration
/browse?artisan=MAS590                      — All listings by Masamune
/browse?artisan=MAS590&listing=12345        — Opens QuickView for listing 12345
```

---

## Known Limitations

1. **Facets are static** — `getArtistDirectoryFacets()` always returns counts for notable artisans regardless of other active filters. Cross-filtering facets would require additional queries.

2. **Search is substring + alias match** — Uses `ilike` and `artisan_aliases_v2` for variant names. Not fuzzy — romanization typos (Massamune vs Masamune) won't match unless an alias exists.

3. **No image/avatar on cards** — Cards are text-only. Could add if artist profile images become available.

4. **No tests for directory code** — The directory functions, API route, and page components don't have unit tests.

---

## Related Documentation

| Doc | Purpose |
|-----|---------|
| `docs/ARTISAN_TOOLTIP_VERIFICATION.md` | Admin QA tooltip feature |
| `docs/ARTISAN_QA_REPORT.md` | Matching accuracy audit (100% on Choshuya sample) |
| `docs/SYNC_ELITE_FACTOR_API.md` | Elite factor webhook sync |
| `docs/YUHINKAI_ENRICHMENT.md` | English translations from Yuhinkai catalog |
| `docs/YUHINKAI_REGISTRY_VISION.md` | Strategic vision for canonical nihonto registry |
| `docs/SESSION_20260208_ARTIST_DIRECTORY.md` | Original directory implementation session |
| `docs/SESSION_20260209_BLADE_FORMS_SIGNATURES.md` | Blade Forms/Signatures split + gold_values query |

---

## Changelog

### 2026-02-19 — Unified tables migration + code refactors

**Database migration (complete):**
- All NihontoWatch code migrated from `smith_entities`/`tosogu_makers` → `artisan_makers` + `artisan_schools`
- `getArtisan(code)` is the single lookup: NS-* → `artisan_schools`, else → `artisan_makers`
- `ArtisanEntity` unified interface replaces deleted `SmithEntity` + `TosoguMaker`
- Column mappings: `school` → `legacy_school_text`, `teacher` → `teacher_text`
- School members via `artisan_school_members` junction table (replaces `WHERE school = X`)
- Students via `artisan_teacher_links` junction table + `teacher_text` fallback
- Directory RPC `get_directory_enrichment()` rewritten (migration 386) to query unified tables
- Legacy tables still exist in oshi-v2 DB but are **not queried** by NihontoWatch

**Refactor 1 — Shared `buildArtistPageData()`:**
- Extracted 150-line `getArtistData()` from `page.tsx` and 120-line rich response block from `api/artisan/[code]/route.ts` into shared `src/lib/artisan/getArtistPageData.ts`
- `ArtisanPageResponse` type moved to `src/types/artisan.ts` (re-exported from API route for backward compat)
- Fixed data gap: API route now includes student/related listing counts (previously only in SSR path)

**Refactor 2 — Attribution utility:**
- Created `src/lib/listing/attribution.ts` with `getAttributionName()` and `getAttributionSchool()`
- Replaced 14 inline `listing.smith || listing.tosogu_maker` patterns across 12 files
- Works with any object shape (full Listing, raw Supabase row, SeoFields, etc.)

**Refactor 3 — School expansion utility:**
- Created `src/lib/artisan/schoolExpansion.ts` with `expandArtisanCodes()`
- Replaced 2 copy-pasted ~20-line blocks in browse API and artisan listings API
- NS-* → [code, ...memberCodes], others → [code], silent fallback on error

**Files changed:** 4 new files, 16 modified, net -423 lines (58 added, 481 removed)

### 2026-02-09 — Normalize 'attributed' mei status (Migration 267)

**Problem:** Oshi-Jussi import stored `mei.status = 'attributed'` with the specific sub-type in `mei.attribution_type` (e.g., `kinzogan`, `shumei`). But `synthesize_object()` only read `mei.status`, ignoring `attribution_type` — so `gold_mei_status` ended up as the meaningless `'attributed'` for 692 objects.

**Fix (oshi-v2 migration 267):**
- Updated `synthesize_object()` to resolve `'attributed'` using `mei.attribution_type`:
  - `kinzogan` → `kinzogan-mei`, `shumei` → `shu-mei`, `ginzogan` → `ginzogan-mei`
  - `kinpun` → `kinpun-mei`, `kiritsuke` → `kiritsuke-mei`, `shusho` → `shusho-mei`
- Re-synthesized 692 affected objects in ~6 seconds
- Result: **0 `attributed` remaining**. Resolved to: 568 kinzogan-mei, 131 shu-mei, 90 kinpun-mei, 55 shusho-mei, 35 kiritsuke-mei, 1 ginzogan-mei

**Nihontowatch display changes:**
- `MeiDistributionBar.tsx`: Added 4 new labels (Kinpun Mei, Ginzōgan Mei, Kiritsuke Mei, Shūsho Mei)
- `yuhinkai.ts` (`getArtisanDistributions()`): Added hyphen→underscore normalization for 4 new types from gold_values

**Files changed:** `oshi-v2/supabase/migrations/267_normalize_attributed_mei.sql`, `MeiDistributionBar.tsx`, `yuhinkai.ts`

### 2026-02-09 — Blade Forms & Signatures as standalone sections

**Section restructure:**
- Split combined "Analysis" section into two standalone sections: **Blade Forms** and **Signatures**
- Moved after Provenance (before Available listings) for more prominence
- Heading adapts: "Blade Forms" for smiths, "Work Types" for tosogu makers
- Removed Biography section from profile pages

**Direct gold_values query** (`getArtisanDistributions()`):
- Form/mei distributions no longer depend on `artist_profiles.stats_snapshot`
- Queries `gold_values` directly by `gold_smith_id` / `gold_maker_id`
- Profile snapshot used as fast-path when available, live query as fallback
- Enables these sections for **all 13,566 artisans** instead of just profiled ones

**Files changed:** `ArtistPageClient.tsx`, `page.tsx`, `yuhinkai.ts`
**Session doc:** `docs/SESSION_20260209_BLADE_FORMS_SIGNATURES.md`

### 2026-02-08 (Session 2 — Enhancement)

**"For sale" links to QuickView:**
- Directory API now returns `first_listing_id` alongside `available_count`
- "N for sale" badge on artist cards is a separate `<Link>` to `/browse?artisan=CODE&listing=ID`
- Card body navigates to artist profile; "for sale" link navigates to browse with QuickView
- Uses `stopPropagation` to prevent conflicting navigations

**All 6 designation types on directory cards:**
- Added `kokuho_count`, `jubun_count`, `jubi_count`, `gyobutsu_count` to `ArtistDirectoryEntry`
- Both `.select()` calls in `getArtistsForDirectory` updated to fetch all 6 columns
- Cards now display: Kokuho (red), Jubun (amber), Jubi (amber/80), Gyobutsu (purple), Tokuju (gold), Juyo (ink)

**All 6 designation types on profile StatsBar:**
- StatsBar now shows: Kokuhō → Jūyō Bunkazai → Jūyō Bijutsuhin → Gyobutsu → Tokubetsu Jūyō → Jūyō
- Removed condition that hid Jūyō when Kokuhō existed

**Provenance section:**
- Denrai (historical collection owners) moved from vitals grid to dedicated section with jump-nav entry

**Files changed:** `yuhinkai.ts`, `directory/route.ts`, `artists/page.tsx`, `ArtistsPageClient.tsx`, `ArtistPageClient.tsx`

### 2026-02-08 (Session 1 — Initial Build)

- Built `/artists` directory page from scratch
- Hybrid SSR + client fetch architecture
- Filters, search, pagination, skeleton loaders
- Artist cards with elite factor bars
- Sitemap integration (~8K URLs)
- JSON-LD schema
- Navigation links in header + mobile drawer
