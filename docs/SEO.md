# SEO Architecture

This document covers the full SEO implementation for NihontoWatch — how metadata is generated, what structured data exists, where the code lives, and what remains to be done.

**Last updated:** 2026-02-15

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Page-Level SEO Coverage](#page-level-seo-coverage)
3. [Listing Detail Metadata (the structured title system)](#listing-detail-metadata)
4. [Category Landing Pages](#category-landing-pages)
5. [Structured Data (JSON-LD)](#structured-data-json-ld)
6. [Technical SEO](#technical-seo)
7. [Brand Name](#brand-name)
8. [Key Files](#key-files)
9. [Field Population Reality](#field-population-reality)
10. [High-Priority Remaining Work](#high-priority-remaining-work)
11. [Testing & Validation](#testing--validation)

---

## How It Works

SEO metadata is generated at three levels:

1. **Root layout** (`src/app/layout.tsx`) — Default title/description inherited by all pages. Also renders site-wide Organization and WebSite JSON-LD.

2. **Page-level `generateMetadata()`** — Next.js server functions that override the root defaults with page-specific titles and descriptions. These run server-side before the page renders, so crawlers see the final metadata in the initial HTML.

3. **Server-rendered listing content** — The listing detail page (`/listing/[id]`) uses a shared `getListingDetail()` function to fetch and enrich data server-side. The enriched listing is passed as `initialData` to the client component, so the full content (h1, price, specs, dealer info, images) appears in the initial HTML that Googlebot receives. See [Listing Detail SSR Architecture](#listing-detail-ssr-architecture).

4. **Category definitions** (`src/lib/seo/categories.ts`) — Static data objects that define keyword-optimized titles, descriptions, and intro copy for each category landing page (`/swords/*`, `/fittings/*`, `/certified/*`).

The listing detail page (`/listing/[id]`) uses a **structured title builder** (`src/lib/seo/metaTitle.ts`) that assembles titles from database fields following collector search patterns:

```
{Cert} {Artisan} {Type} — {Qualifier} | NihontoWatch
```

This matches how collectors actually search Google ("Juyo Masamune Katana", "Tokubetsu Hozon Tsuba Shakudo").

---

## Page-Level SEO Coverage

### Pages with full structured metadata

| Page | Title Pattern | JSON-LD | Notes |
|------|---------------|---------|-------|
| `/` (home) | Static: "NihontoWatch \| Japanese Sword & Tosogu Marketplace" | Organization, WebSite | Does NOT adapt to query params — see [remaining work](#high-priority-remaining-work) |
| `/listing/[id]` | Structured: `{Cert} {Artisan} {Type} — {Qualifier} \| NihontoWatch` | Product, Breadcrumb | Full artisan resolution, 60-char guard |
| `/swords/[type]` | "Katana for Sale — Japanese Long Swords \| NihontoWatch" | ItemList, Breadcrumb | 6 pages (katana, wakizashi, tanto, tachi, naginata, yari) |
| `/fittings/[type]` | "Tsuba for Sale — Japanese Sword Guards \| NihontoWatch" | ItemList, Breadcrumb | 4 pages (tsuba, fuchi-kashira, kozuka, menuki) |
| `/certified/[cert]` | "Juyo Token Swords for Sale — NBTHK \| NihontoWatch" | ItemList, Breadcrumb | 4 pages (juyo, tokubetsu-juyo, hozon, tokubetsu-hozon) |
| `/artists` | Dynamic: adapts to school/province/era/type filters | Breadcrumb | Server-rendered initial load, client fetch on filter change |
| `/artists/[slug]` | "{Name} — {School} {Type} \| NihontoWatch" | Breadcrumb | Individual artisan profiles |
| `/dealers` | "Japanese Sword Dealers \| NihontoWatch" | LocalBusiness per dealer | Static metadata |
| `/dealers/[slug]` | "{Dealer Name} \| Japanese Sword Dealer \| NihontoWatch" | Breadcrumb | Dynamic metadata with listing count |
| `/glossary` | "Japanese Sword & Fittings Glossary \| NihontoWatch" | — | Static |
| `/glossary/[term]` | "{Term} — Japanese Sword Glossary \| NihontoWatch" | — | Dynamic per term |

### Pages with noindex

| Page | Reason |
|------|--------|
| `/admin/*` | Admin-only |
| `/saved` | User-specific |
| `/profile` | User-specific |
| `/collection` | User-specific |
| `/s/[id]` | Share proxy — canonical points to `/listing/[id]` |
| Sold listings | `robots: { index: false, follow: true }` |

---

## Listing Detail Metadata

### The Structured Title System

**File:** `src/lib/seo/metaTitle.ts`

The title builder assembles keyword-rich titles from database fields instead of echoing raw dealer titles (which are often Japanese-only).

**Pattern:**
```
{Cert} {Artisan} {Type} — {Qualifier} | NihontoWatch
```

**Examples:**
```
Juyo Masamune Katana — Soshu, Kamakura | NihontoWatch
Tokubetsu Hozon Masatsune Tsuba — Shakudo | NihontoWatch
Hozon Ichimonji Wakizashi — Bizen, Kamakura | NihontoWatch
Katana — Bizen, Muromachi | NihontoWatch
Juyo Katana | NihontoWatch
```

### Artisan Name Resolution (fallback chain)

`resolveArtisanNameForSeo()` follows this chain:

1. **`smith` / `tosogu_maker`** — use directly if already romanized (no Japanese characters)
2. **Extract from `title_en`** — strip item type prefix, apply school pattern to extract individual name (e.g., "Katana: Soshu Yukimitsu" → "Yukimitsu")
3. **`school` / `tosogu_school`** — if no individual name, use school (matches queries like "Juyo Ichimonji")
4. **Omit** — artisan segment left out entirely

### Qualifier (after em-dash)

- **Swords:** `{Province}, {Era}` (e.g., "Bizen, Kamakura")
- **Tosogu:** `{tosogu_material}` or `{school}` (e.g., "Shakudo")
- Omitted if nothing to add or if it would push title over 60 chars

### Length guard

Google truncates titles at ~60 characters. The builder tries progressively shorter variants:
1. Full title with qualifier
2. Core without qualifier
3. Truncated core with ellipsis

### Description Template

```
Available: "{Cert} {Artisan} {Type} for sale. {Price}. Nagasa {N}cm. {Era} period, {Province} province. Available from {Dealer} on NihontoWatch."
Sold:      "{Cert} {Artisan} {Type} — sold. Was {Price}. Nagasa {N}cm. Previously listed by {Dealer} on NihontoWatch."
```

Key signals: "for sale" (transactional intent), price (attracts clicks), nagasa (spec collectors search), dealer name (brand recognition). Descriptions over 160 chars drop context/specs segments to stay within Google's display limit.

### Dual-Path Field Access (sword vs tosogu)

The database stores sword and tosogu attributes in different columns:

| Attribute | Sword column | Tosogu column |
|-----------|-------------|---------------|
| Artisan | `smith` | `tosogu_maker` |
| School | `school` | `tosogu_school` |
| Era | `era` | `tosogu_era` |
| Material | — | `tosogu_material` |

The SEO builder checks both paths for every field. The metadata query in `page.tsx` fetches all six columns.

### OG / Twitter metadata

- `og:title` and `twitter:title` use the structured title without the ` | NihontoWatch` suffix
- `og:description` and `twitter:description` use the full structured description
- `og:image` uses pre-generated OG image if available (`og_image_url`), falls back to dynamic `/api/og?id={id}`
- `og:siteName` is "NihontoWatch"

---

## Listing Detail SSR Architecture

**Deployed:** 2026-02-15 (commit `1145920`)

### Problem

Google Search Console showed **2,423 listing pages as "Crawled - currently not indexed"**. Root cause: `ListingDetailClient` was a `'use client'` component that fetched all data via `useEffect` on mount. The server-rendered HTML had good metadata (`<title>`, `<meta>`, JSON-LD) but an **empty body** — no h1, no title text, no price, no specs. Google treated this as thin content and refused to index.

### Solution

Extracted the API route's data-fetching + enrichment logic into a shared function (`getListingDetail`), called it from `page.tsx`, and passed the result as `initialData` to the client component. Since Next.js SSRs `'use client'` components when they receive data as props, the full listing content now appears in the initial HTML.

### Data flow

```
page.tsx (server component)
  │
  ├─ generateMetadata() ──► getListingDetail() ──► Supabase
  │                                                  │
  │                                                  ▼
  │                                           EnrichedListingDetail
  │                                                  │
  │                                                  ▼
  │                                        <title>, <meta>, og:*
  │
  └─ ListingPage() ────────► getListingDetail() ──► Supabase
                                                     │
                                                     ▼
                                              EnrichedListingDetail
                                                     │
                                    ┌────────────────┼──────────────┐
                                    ▼                ▼              ▼
                              JSON-LD scripts   <ListingDetail    <RelatedListings
                                                 Client            Server />
                                                 initialData=
                                                 {listing} />
```

### What Googlebot now sees

| Element | Before | After |
|---------|--------|-------|
| `<h1>` | Missing | Listing title |
| Price | Missing | Formatted price or "Price on request" |
| Certification badge | Missing | Juyo/Hozon/etc. badge text |
| Artisan/school | Missing | Smith + school attribution |
| Specs | Missing | Nagasa, sori, motohaba, sakihaba |
| Dealer info | Missing | Dealer name + domain |
| Images | Missing | `<img>` tags with alt text |
| Action buttons | Missing | "View on {Dealer}", "Inquire", "Set Alert" |
| Loading spinner | Present | Gone |

### Key files

| File | Purpose |
|------|---------|
| `src/lib/listing/getListingDetail.ts` | Shared function: Supabase query + all enrichments (dealer baseline, Yuhinkai, artisan name/tier, price history) |
| `src/app/api/listing/[id]/route.ts` | API route: calls `getListingDetail()`, adds cache headers |
| `src/app/listing/[id]/page.tsx` | Server component: calls `getListingDetail()` for metadata + `initialData` prop |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Client component: accepts `initialData`, skips fetch when provided |

### How admin re-fetch works

When an admin uses `AdminSetsumeiWidget` to update a Yuhinkai connection, `onConnectionChanged` fires a client-side `fetch('/api/listing/{id}?nocache=1')` and calls `setListing()` with the fresh data. This bypasses `initialData` and works unchanged.

### Monitoring

- **Google Search Console → Coverage:** Watch "Crawled - currently not indexed" count (was 2,423) decline over 2-4 weeks
- **URL Inspection tool:** Test individual listing URLs to verify Googlebot sees full content
- **Indexed page count:** Should trend upward as Google recrawls

---

## Category Landing Pages

### Architecture

Three sets of static landing pages target head terms:

```
/swords/katana    → "Katana for Sale — Japanese Long Swords | NihontoWatch"
/swords/wakizashi → "Wakizashi for Sale — Japanese Short Swords | NihontoWatch"
/certified/juyo   → "Juyo Token Swords for Sale — NBTHK Important Swords | NihontoWatch"
/fittings/tsuba   → "Tsuba for Sale — Japanese Sword Guards | NihontoWatch"
```

All defined in `src/lib/seo/categories.ts` with:
- Keyword-rich title and description
- H1 heading and intro paragraph
- Filter values that map to browse API params
- Static generation via `generateStaticParams()`

Each page renders a preview grid of listings (fetched server-side via `src/lib/seo/fetchCategoryPreview.ts`) and includes ItemList + Breadcrumb JSON-LD.

### Pages

**Swords (6):** katana, wakizashi, tanto, tachi, naginata, yari
**Fittings (4):** tsuba, fuchi-kashira, kozuka, menuki
**Certifications (4):** juyo, tokubetsu-juyo, hozon, tokubetsu-hozon

---

## Structured Data (JSON-LD)

**File:** `src/lib/seo/jsonLd.ts`

### Site-wide (root layout)

| Schema | Purpose |
|--------|---------|
| `Organization` | Site identity, logo, name — authority signal |
| `WebSite` + `SearchAction` | Enables sitelinks search box in Google |

### Listing detail pages

| Schema | Purpose |
|--------|---------|
| `Product` | Price, availability, seller, certification — rich snippet eligibility |
| `BreadcrumbList` | Navigation path: Home → {Type} → {Title} |

### Category landing pages

| Schema | Purpose |
|--------|---------|
| `ItemList` | List of products with position, name, URL |
| `BreadcrumbList` | Navigation path: Home → {Category} |

### Dealer pages

| Schema | Purpose |
|--------|---------|
| `LocalBusiness` | Per-dealer structured data on directory page |
| `BreadcrumbList` | On individual dealer pages |

---

## Technical SEO

### robots.txt

**File:** `src/app/robots.ts`

Allows all public content, blocks `/admin/`, `/api/`, `/saved`, `/profile`, `/auth/`, `/favorites`. References sitemap.

### sitemap.xml

**File:** `src/app/sitemap.ts`

Dynamic sitemap with ISR (1-hour revalidation). Includes:
- Core pages (home, dealers directory)
- All dealer pages (`/dealers/[slug]`)
- All available listings (`/listing/[id]`) — sold items excluded
- Category landing pages (`/swords/*`, `/fittings/*`, `/certified/*`)
- Artist pages (`/artists/[slug]`) — all 13,566 artisans from Yuhinkai

Batch-fetches in groups of 1000 to handle Supabase row limits.

### Canonical URLs

All pages set `alternates.canonical`. The share proxy (`/s/[id]`) canonicalizes to `/listing/[id]` to prevent duplicate indexing.

### Sold items

- `robots: { index: false, follow: true }` — tells Google to deindex
- Description changes from "for sale" to "sold" / "Previously listed by"
- Excluded from sitemap

### Share proxy (`/s/[id]`)

Solves Discord's OG image caching problem. URLs include a version parameter derived from `og_image_url` timestamp. `noindex` prevents duplicate content. Human visitors are immediately redirected to `/listing/[id]`.

---

## Brand Name

The canonical brand name is **NihontoWatch** (capital W). This is used consistently across:
- All page titles (` | NihontoWatch` suffix)
- OpenGraph `siteName`
- JSON-LD Organization and WebSite `name`
- Email sender name
- Share text
- Legal page metadata

The only exceptions are legal page body prose (terms of service, privacy policy document text) and internal API headers (`X-Title` to OpenRouter), which are not user/SEO facing.

---

## Key Files

### Metadata generation

| File | Purpose |
|------|---------|
| `src/lib/seo/metaTitle.ts` | `buildSeoTitle()`, `buildSeoDescription()`, `resolveArtisanNameForSeo()` — structured metadata builders for listing pages |
| `src/lib/seo/jsonLd.ts` | All JSON-LD schema generators + `jsonLdScriptProps()` render helper |
| `src/lib/seo/categories.ts` | Category definitions (titles, descriptions, filter mappings) for /swords, /fittings, /certified |
| `src/lib/seo/fetchCategoryPreview.ts` | Server-side listing preview fetcher for category pages |
| `src/lib/listing/getListingDetail.ts` | Shared listing data-fetching + enrichment for SSR (used by page.tsx and API route) |

### Pages with `generateMetadata()`

| File | Pattern |
|------|---------|
| `src/app/layout.tsx` | Root default metadata + site-wide JSON-LD |
| `src/app/listing/[id]/page.tsx` | Structured title/description via `buildSeoTitle()` |
| `src/app/dealers/page.tsx` | Static dealer directory metadata |
| `src/app/dealers/[slug]/page.tsx` | Dynamic per-dealer metadata with listing count |
| `src/app/artists/page.tsx` | Dynamic, adapts to filter params |
| `src/app/artists/[slug]/page.tsx` | Dynamic per-artisan metadata |
| `src/app/glossary/page.tsx` | Static with dynamic term count |
| `src/app/glossary/[term]/page.tsx` | Dynamic per-term |
| `src/app/swords/[type]/page.tsx` | From category definitions |
| `src/app/fittings/[type]/page.tsx` | From category definitions |
| `src/app/certified/[cert]/page.tsx` | From category definitions |
| `src/app/s/[id]/page.tsx` | Share proxy (noindex) |

### Technical SEO

| File | Purpose |
|------|---------|
| `src/app/robots.ts` | robots.txt generation |
| `src/app/sitemap.ts` | Dynamic sitemap (listings, dealers, artists, categories) |

---

## Field Population Reality

Measured 2026-02-14 against 6,069 available listings:

| Field | Count | Coverage | Notes |
|-------|------:|--------:|-------|
| `item_type` | 5,910 | **97.4%** | Nearly universal |
| `title_en` | 5,889 | **97.0%** | Populated by LLM extraction during scraping — key artisan name extraction source |
| `era` | 5,476 | **90.2%** | Almost all romanized (5,474) |
| `province` | 3,659 | 60.3% | 3,579 romanized |
| `smith` | 3,406 | 56.1% | 1,305 romanized / 2,101 Japanese-only |
| `cert_type` | 3,075 | **50.7%** | Half of inventory is certified |
| `school` | 2,246 | 37.0% | 1,856 romanized (83% of those with school) |
| `nagasa_cm` | 2,262 | 37.3% | Used in meta descriptions |
| `tosogu_maker` | 526 | 8.7% | 176 romanized / 350 Japanese-only |
| `tosogu_school` | 264 | 4.3% | 191 romanized |
| `tosogu_material` | — | — | Not yet measured |
| `tosogu_era` | — | — | Not yet measured |

### Title quality tiers

| Tier | Count | % | Description |
|------|------:|--:|-------------|
| **Excellent** | 2,959 | 48.8% | cert_type + artisan name + item_type |
| **Good** | 1,899 | 31.3% | item_type + at least one of cert/smith/school |
| Minimal | 1,052 | 17.3% | item_type only (no cert or artisan) |
| Fallback | 159 | 2.6% | No item_type — raw title used |

**80.1% of listings produce a Good or Excellent structured title.** The `title_en` field (97% coverage) is the critical enabler — when `smith` is in Japanese (2,101 listings), `extractArtisanFromTitleEn()` can usually recover a romanized artisan name from the LLM-generated English title.

### Remaining gaps

- **159 listings** missing `item_type` entirely — the only true fallbacks
- **2,101 listings** with Japanese-only `smith` rely on `title_en` extraction (covered by 97% `title_en` population)
- **Tosogu fields are sparse** (`tosogu_maker` 8.7%, `tosogu_school` 4.3%) — tsuba/fittings are more likely to produce Minimal-tier titles

---

## High-Priority Remaining Work

### 1. Home page metadata adaptation to query params

**Impact: HIGH** — The home page (`/`) handles all browse functionality via query params (`?type=katana`, `?cert=juyo`). The title stays generic regardless of filters. When users share filtered URLs or Google crawls them, the metadata doesn't reflect the content.

**Gap:** `/?type=katana` shows "NihontoWatch | Japanese Sword & Tosogu Marketplace" instead of "Katana for Sale | NihontoWatch".

**Mitigation:** The static category landing pages (`/swords/katana`) already cover the most important head terms with excellent metadata. The gap is specifically for direct browse URLs with query params. A `generateMetadata()` function that reads `searchParams` would close this.

### ~~2. Server-render listing content for Googlebot~~ ✅ DONE (2026-02-15)

**Deployed:** commit `1145920`. See [Listing Detail SSR Architecture](#listing-detail-ssr-architecture) for full details.

Extracted `getListingDetail()` shared function, passed enriched listing as `initialData` prop to client component. Googlebot now sees h1, price, specs, dealer info, and images in the initial HTML. Monitoring via Search Console for "Crawled - currently not indexed" count to decline from 2,423 over 2-4 weeks.

### 3. `tosogu_era` and `tosogu_material` exposure in browse API

**Impact: LOW-MEDIUM** — The browse API (`/api/browse/route.ts`) doesn't return `tosogu_material` or `tosogu_era`. These fields are available in the DB and now used by listing detail metadata, but browse-level features (e.g., faceted filtering by material) can't access them.

### 4. Internal linking from listing pages

**Impact: MEDIUM** — Listing detail pages link to related listings (by artisan and dealer) via `<RelatedListingsServer>`, which is good. Additional internal links could be added:
- Link cert type to `/certified/{cert}` page
- Link item type to `/swords/{type}` or `/fittings/{type}` page
- Link artisan to `/artists/{slug}` page

These links would distribute PageRank to category pages and help Google discover them faster.

---

## Testing & Validation

### Automated tests

`tests/app/listing-page-seo.test.ts` — 8 tests covering:
- HTTP 404 for missing/invalid listings
- `noindex` for sold/unavailable items
- `index: true` for available items
- Description accuracy (sold vs available)
- Share proxy noindex

### Manual validation

1. **Google Rich Results Test:** https://search.google.com/test/rich-results
   - Test `/listing/{id}` for Product + Breadcrumb
   - Test `/swords/katana` for ItemList
   - Test `/dealers` for LocalBusiness

2. **Schema.org Validator:** https://validator.schema.org/

3. **Title length check:** Verify representative titles stay under 60 chars:
   ```
   "Juyo Masamune Katana — Soshu, Kamakura | NihontoWatch"  → 55 chars ✓
   "Tokubetsu Hozon Wakizashi — Bizen | NihontoWatch"       → 50 chars ✓
   "Katana | NihontoWatch"                                    → 21 chars ✓
   ```

### Google Search Console

Monitor:
- **Pages → Indexing:** Watch soft 404s (should be ~0 after Jan 2026 fix)
- **Enhancements → Product:** Rich result eligibility from Product JSON-LD
- **Core Web Vitals:** LCP target <3s
- **Sitemaps:** Verify all URLs are discovered

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-15 | **Server-render listing detail content for SEO.** Created `getListingDetail()` shared function, passed enriched listing as `initialData` to client component. Googlebot now sees full listing content (h1, price, specs, dealer, images) in initial HTML. Addresses 2,423 "Crawled - currently not indexed" pages in Search Console. |
| 2026-02-14 | Structured title system for listing pages (`metaTitle.ts`), brand unification to "NihontoWatch", tosogu dual-path field fix. Field coverage measured against live DB — corrected `title_en` from "~5-10%" to **97%** (populated by LLM extraction, not on-demand) |
| 2026-01-25 | Soft 404 fix (proper `notFound()`), noindex for sold items, noindex for share proxy |
| 2026-01-xx | Category landing pages (`/swords/*`, `/fittings/*`, `/certified/*`) with ItemList JSON-LD |
| 2025-xx-xx | Initial SEO implementation: robots.txt, sitemap, JSON-LD, OG images |
