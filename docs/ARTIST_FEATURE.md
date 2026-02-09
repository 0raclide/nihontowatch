# Artist Feature — Comprehensive Documentation

**Last updated**: 2026-02-09
**Status**: Live at nihontowatch.com/artists

---

## Overview

The Artist feature is a two-tier system for discovering and exploring 13,566 artisans (12,447 swordsmiths + 1,119 tosogu makers) from the Yuhinkai database:

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
│  │  smith_entities │ tosogu_makers │ artist_profiles │      │   │
│  │  gold_values    │               │                        │   │
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
| `src/lib/supabase/yuhinkai.ts` | Yuhinkai DB client — all artisan queries, types, directory functions |
| `src/lib/artisan/slugs.ts` | URL slug generation + extraction (e.g., `masamune-MAS590`) |
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

### Yuhinkai Database Tables

**`smith_entities`** — 12,447 swordsmiths
```
smith_id (PK)        — Code like "MAS590", "BIZ003"
name_kanji           — Japanese name (e.g., "正宗")
name_romaji          — Romanized name (e.g., "Masamune")
province, school, era, period, generation, teacher
hawley               — Hawley reference number
fujishiro            — Fujishiro rating (Saijō-saku, Jōjō-saku, etc.)
toko_taikan          — Tōkō Taikan score
kokuho_count         — National Treasures
jubun_count          — Important Cultural Properties (Bunkazai)
jubi_count           — Important Art Objects (Bijutsuhin)
gyobutsu_count       — Imperial Collection
tokuju_count         — Tokubetsu Jūyō
juyo_count           — Jūyō
total_items          — Total certified works
elite_count          — Works with elite designations
elite_factor         — 0.0-1.0 ratio of elite works
is_school_code       — TRUE for aggregate school entries (excluded from directory)
```

**`tosogu_makers`** — 1,119 fitting makers
```
maker_id (PK)        — Code like "OWA009", "GOT042"
name_kanji, name_romaji, province, school, era, generation, teacher
specialties          — Array of specialties (e.g., ["tsuba", "kozuka"])
alternative_names    — Array of alternate names
kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count
total_items, elite_count, elite_factor, is_school_code
```

**`artist_profiles`** — AI-generated biographies
```
artist_code (FK)     — Links to smith_id or maker_id
profile_md           — Full markdown biography
hook                 — One-line pull quote
setsumei_count       — Number of translated setsumei informing the profile
stats_snapshot       — JSON with mei_distribution, form_distribution
profile_depth        — 'full' | 'standard' | 'brief'
human_reviewed       — Boolean
```

**`gold_values`** — Yuhinkai catalog items (provenance, form/mei distributions)
```
gold_artisan         — Artisan name (matches name_romaji)
gold_smith_id        — FK to smith_entities (for distribution queries)
gold_maker_id        — FK to tosogu_makers (for distribution queries)
gold_form_type       — Blade/work type (katana, wakizashi, tanto, tachi, tsuba, etc.)
gold_mei_status      — Signature status (signed, mumei, attributed, den, kinzogan, etc.)
gold_denrai_owners   — Array of historical collection owners
```

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

## Feature Details

### 1. Artist Directory (`/artists`)

**Default view:** ~1,400 notable artisans (those with `total_items > 0`) sorted by elite factor descending.

**Filters:**
- **Type toggle**: All / Smiths / Tosogu
- **School dropdown**: Aggregated from both tables (e.g., Soshu, Bizen, Yamashiro)
- **Province dropdown**: Aggregated provinces
- **Era dropdown**: Aggregated eras
- **Search**: 300ms debounced, matches `name_romaji`, `name_kanji`, `smith_id`/`maker_id` via `ilike`
- **Sort**: Elite Factor (default), Juyo Count, Total Works, Name A-Z
- **Notable toggle**: When unchecked, shows all 13,566 artisans including those with zero certified works

**Pagination:** 50 per page (API supports up to 100). When `type=all`, both tables are queried and merged client-side with proper sorting.

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
   - MeiDistributionBar: signature types (signed, mumei, attributed, den, kinzōgan mei, etc.)
   - Data source: `gold_values.gold_mei_status` aggregated by artisan code (profile snapshot as fast-path)

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

### `ArtisanPageResponse` (artisan/[code]/route.ts)
```typescript
interface ArtisanPageResponse {
  entity: { code, name_romaji, name_kanji, school, province, era, period,
            generation, teacher, entity_type, is_school_code, slug,
            fujishiro, toko_taikan, specialties };
  certifications: { kokuho_count, jubun_count, jubi_count, gyobutsu_count,
                    tokuju_count, juyo_count, total_items, elite_count, elite_factor };
  rankings: { elite_percentile, elite_grade, toko_taikan_percentile };
  profile: { profile_md, hook, setsumei_count, generated_at } | null;
  stats: { mei_distribution, form_distribution } | null;
  lineage: { teacher: { code, name_romaji, slug } | null,
             students: Array<{ code, name_romaji, slug }> };
  related: Array<{ code, name_romaji, name_kanji, slug, school,
                   juyo_count, tokuju_count, elite_factor }>;
  denrai: Array<{ owner: string; count: number }>;
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
- Fetches from both `smith_entities` and `tosogu_makers` where `is_school_code = false AND total_items > 0`
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

1. **Merged "all" type pagination** — When `type=all`, both tables are queried and merged client-side. For very large offsets (page 100+) this could over-fetch. Single-type queries use proper DB-level pagination.

2. **Facets are static** — `getArtistDirectoryFacets()` always returns counts for notable artisans regardless of other active filters. Cross-filtering facets would require additional queries.

3. **Search is substring match** — Uses `ilike` which works but isn't fuzzy. Romanization variants (Massamune vs Masamune) won't match.

4. **No image/avatar on cards** — Cards are text-only. Could add if artist profile images become available.

5. **No tests for directory code** — The directory functions, API route, and page components don't have unit tests.

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
