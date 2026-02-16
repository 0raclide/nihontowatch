# SEO Architecture

This document covers the full SEO implementation for NihontoWatch — how metadata is generated, what structured data exists, where the code lives, and what remains to be done.

**Last updated:** 2026-02-16

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Page-Level SEO Coverage](#page-level-seo-coverage)
3. [Listing Detail Metadata (the structured title system)](#listing-detail-metadata)
4. [Category Landing Pages](#category-landing-pages)
5. [Internal Linking Mesh](#internal-linking-mesh)
6. [Sold Archive](#sold-archive)
7. [Canonical Redirects](#canonical-redirects)
8. [Structured Data (JSON-LD)](#structured-data-json-ld)
9. [Technical SEO](#technical-seo)
10. [Brand Name](#brand-name)
11. [Key Files](#key-files)
12. [Field Population Reality](#field-population-reality)
13. [High-Priority Remaining Work](#high-priority-remaining-work)
14. [Testing & Validation](#testing--validation)

---

## How It Works

SEO metadata is generated at three levels:

1. **Root layout** (`src/app/layout.tsx`) — Default title/description inherited by all pages. Also renders site-wide Organization and WebSite JSON-LD.

2. **Page-level `generateMetadata()`** — Next.js server functions that override the root defaults with page-specific titles and descriptions. These run server-side before the page renders, so crawlers see the final metadata in the initial HTML.

3. **Server-rendered listing content** — The listing detail page (`/listing/[id]`) uses a shared `getListingDetail()` function to fetch and enrich data server-side. The enriched listing is passed as `initialData` to the client component, so the full content (h1, price, specs, dealer info, images) appears in the initial HTML that Googlebot receives. See [Listing Detail SSR Architecture](#listing-detail-ssr-architecture).

4. **Category definitions** (`src/lib/seo/categories.ts`) — Dimension-based generation system that produces 34 category landing pages from type dimensions × secondary dimensions (cert, era, school). See [Category Landing Pages](#category-landing-pages).

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
| `/swords/[type]` | "Katana for Sale — Japanese Long Swords \| NihontoWatch" | ItemList, Breadcrumb | 24 pages: 6 base types + 18 combinations (juyo-katana, koto-katana, bizen-katana, etc.) |
| `/fittings/[type]` | "Tsuba for Sale — Japanese Sword Guards \| NihontoWatch" | ItemList, Breadcrumb | 6 pages: 4 base types + 2 combinations (juyo-tsuba, hozon-tsuba) |
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

### Architecture: Dimension-Based Generation

**34 static landing pages** are generated from a dimension system in `src/lib/seo/categories.ts`. Instead of hand-crafting each `CategoryDef` record, the system defines **type dimensions** and **secondary dimensions**, then generates pages from their combinations.

```
TYPE_DIMS (10):  katana, wakizashi, tanto, tachi, naginata, yari, tsuba, fuchi-kashira, kozuka, menuki
  × SECONDARY_DIMS (12): juyo, tokubetsu-juyo, hozon, tokubetsu-hozon, koto, shinto, shinshinto, bizen, soshu, yamashiro, mino, yamato
  → COMBO_SPECS selects which combinations to generate (20 pages)
  + 10 base type pages + 4 cert pages = 34 total
```

### How it works

1. **`TYPE_DIMS`** — Each entry defines: label, DB values (for Supabase `.in()` query), route prefix (`swords` or `fittings`), and a title subtitle.

2. **`SECONDARY_DIMS`** — Each defines: label, DB values, filter param (`cert`, `era`, or `school`), and a title suffix for combination pages.

3. **`COMBO_SPECS`** — A compact array that declares which `{dim} × {type}` combinations to create:
   ```typescript
   { dim: 'juyo', types: ['katana', 'wakizashi', 'tanto', 'tsuba'] },
   { dim: 'bizen', types: ['katana', 'wakizashi', 'tanto'] },
   // ...12 entries total → 20 combination pages
   ```

4. **Content registries** — `TYPE_CONTENT`, `CERT_CONTENT`, `COMBO_CONTENT` hold only the hand-written `metaDescription` and `intro` text, keyed by slug. Titles and h1s are auto-generated from dimension labels (cert pages get custom overrides).

5. **Generator functions** — `generateBaseTypes()`, `generateCertPages()`, `generateCombos()` produce `CategoryDef[]` arrays from dimensions + content.

6. **`computeRelatedLinks()`** — Walks the category graph to auto-produce 3-6 related page links per page (parent type, parent cert, same-dim siblings, same-type siblings). No manual curation needed.

7. **`PARAM_TO_COLUMN`** mapping — `{ type: 'item_type', cert: 'cert_type', era: 'era', school: 'school' }`. Used by `fetchCategoryPreview.ts` to apply filters in a single loop instead of if/else chains. Adding a new filter dimension = adding one entry here.

### CategoryDef interface

```typescript
export interface CategoryDef {
  slug: string;
  route: string;              // e.g., '/swords/juyo-katana'
  routePrefix: string;        // 'swords' | 'fittings' | 'certified'
  filters: Record<string, string[]>;  // { type: ['katana'], cert: ['juyo', 'Juyo'] }
  parentSlug?: string;        // For breadcrumbs on combination pages
  relatedLinks: Array<{ label: string; url: string }>;
  title: string;
  h1: string;
  metaDescription: string;
  intro: string;
}
```

The unified `filters` field replaces the old `filterParam`/`filterValues`/`extraFilters` triple. Each key is a URL param name, each value array contains all DB values to match (handling casing variants like `['juyo', 'Juyo']`).

### Shared route handler helper

`src/lib/seo/categoryPage.ts` provides `buildCategoryMetadata()`, `buildBrowseUrl()`, and `buildBreadcrumbs()`, used by all three route handlers (`swords/[type]`, `fittings/[type]`, `certified/[cert]`). Each handler is ~45 lines.

### Lookup API

```typescript
getCategoryByRoute('swords', 'juyo-katana')  // → CategoryDef
getAllSlugsByRoute('swords')                  // → all sword slugs (base + combo)
```

Backward-compatible wrappers (`getSwordCategory`, `getAllSwordSlugs`, etc.) are preserved.

### Entity URL helpers

`getItemTypeUrl()`, `getCertUrl()`, and `getDealerUrl()` are exported from `categories.ts` (not a separate file). They build reverse lookups from the generated registry — item type values → `/swords/{slug}`, cert values → `/certified/{slug}`.

### Pages (34 total)

**Base types (10):** katana, wakizashi, tanto, tachi, naginata, yari, tsuba, fuchi-kashira, kozuka, menuki
**Certifications (4):** juyo, tokubetsu-juyo, hozon, tokubetsu-hozon
**Cert × type (8):** juyo-katana, juyo-wakizashi, juyo-tanto, juyo-tsuba, hozon-katana, hozon-tsuba, tokubetsu-hozon-katana, tokubetsu-juyo-katana
**Era × type (5):** koto-katana, koto-wakizashi, koto-tanto, shinto-katana, shinshinto-katana
**School × type (7):** bizen-katana, bizen-wakizashi, bizen-tanto, soshu-katana, yamashiro-katana, mino-katana, yamato-katana

### Adding a new combination page

1. Add content to `COMBO_CONTENT` in `categories.ts` (metaDescription + intro)
2. Add the type key to the relevant dim's `types` array in `COMBO_SPECS`
3. That's it — title, h1, filters, route, related links, sitemap entry, and static params are all auto-generated

---

## Internal Linking Mesh

**Deployed:** 2026-02-16

Every entity mention on listing detail pages is now a contextual link to its canonical page, distributing PageRank across the site and helping Google discover category pages.

### Linked entities on `/listing/[id]`

| Entity | Links to | Source |
|--------|----------|--------|
| Certification badge | `/certified/{cert}` | `getCertUrl(listing.cert_type)` |
| Item type | `/swords/{type}` or `/fittings/{type}` | `getItemTypeUrl(listing.item_type)` |
| Artisan name | `/artists/{slug}` | `generateArtisanSlug()` when `artisan_id` exists |
| School | `/artists?school={school}` | Direct URL construction |
| Dealer name | `/dealers/{slug}` | `getDealerUrl(listing.dealers.name)` |

### Linked entities in related listings headings

`RelatedListingsServer` section headings ("More by {artisan}", "More from {dealer}") now link artisan/dealer names to their respective pages.

### Breadcrumb links

Listing detail breadcrumbs link item type to its canonical category page instead of `/?type={type}`:
```
Home → Katana for Sale → {Listing Title}
         ↓ links to /swords/katana
```

### Category page cross-links

Each category landing page includes a "Related Categories" section with 3-6 auto-computed links to related pages (parent types, sibling combos, related certs).

### Key files

| File | Purpose |
|------|---------|
| `src/lib/seo/categories.ts` | `getItemTypeUrl()`, `getCertUrl()`, `getDealerUrl()` |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Entity links in cert badge, type, artisan, school, dealer |
| `src/app/listing/[id]/page.tsx` | Breadcrumb JSON-LD with category page URLs |
| `src/components/listing/RelatedListingsServer.tsx` | Linked headings |
| `src/components/seo/CategoryLandingPage.tsx` | Related Categories section |

---

## Sold Archive

**Deployed:** 2026-02-16

Sold listings are now indexed instead of noindexed, preserving accumulated SEO equity on one-of-a-kind collectible pages.

### What changed

| Aspect | Before | After |
|--------|--------|-------|
| robots | `index: false, follow: true` | `index: true, follow: true` |
| Sitemap | Excluded | Included (priority 0.4, monthly) |
| Product JSON-LD | Already `SoldOut` availability | Unchanged |
| Meta description | Already says "sold" | Unchanged |
| Price display | Shown normally | "Sold price" label above price, muted styling |
| Primary CTA | "View on {Dealer}" | "View Similar Items" → filtered browse |
| Dealer link | Primary button | Secondary text link with `rel="nofollow"` |

### "View Similar Items" CTA logic

```
cert_type + item_type → /?type={item_type}&cert={cert_type}
item_type only        → /?type={item_type}
fallback              → /
```

### Sitemap treatment

Sold items appear in `sitemap.xml` with:
- `priority: 0.4` (vs 0.7 for available items)
- `changeFrequency: 'monthly'` (vs weekly for available)
- Fetched via `getAllSoldListings()` which queries `is_available = false AND status IN ('sold', 'presumed_sold')`

---

## Canonical Redirects

**Files:** `src/middleware.ts`, `src/lib/seo/categories.ts` (`findCategoryRedirect`)

301 permanent redirects consolidate browse query-param URLs to their canonical category pages, preventing ranking signal dilution between duplicate URLs.

### How it works

The middleware intercepts requests to `/` with query params and checks if they match a category page:

| Browse URL | Redirects to | Status |
|------------|-------------|--------|
| `/?type=katana` | `/swords/katana` | 301 |
| `/?cert=juyo` | `/certified/juyo` | 301 |
| `/?type=katana&cert=juyo` | `/swords/juyo-katana` | 301 |
| `/?type=katana&school=bizen` | `/swords/bizen-katana` | 301 |
| `/?type=katana&era=koto` | `/swords/koto-katana` | 301 |
| `/?type=katana&period=koto` | `/swords/koto-katana` | 301 (`period` aliased to `era`) |
| `/?cert=tokubetsu_hozon` | `/certified/tokubetsu-hozon` | 301 |
| `/?type=tsuba` | `/fittings/tsuba` | 301 |

### When redirects do NOT fire

The redirect only fires when the URL contains **exclusively** category-filter params (`type`, `cert`, `school`, `era`/`period`). Any browse-UI param causes the redirect to be skipped:

- **`tab` present** (e.g., `/?tab=available&type=katana`) — user is in the browse UI
- **`sort`, `dealer`, `q`, `artisan`** — browse-specific filters
- **`priceMin`, `priceMax`, `cat`** — additional browse state
- **CSV multi-values** (e.g., `/?type=katana,wakizashi`) — not a single category

The `buildBrowseUrl()` in `categoryPage.ts` includes `tab=available` so "Browse all" CTAs on category landing pages correctly bypass the redirect and open the full browse UI.

### Lookup mechanism

A static `_redirectMap` is built at module load from all 34 `CategoryDef` entries. Keys are sorted, lowercased `param=value` pairs (e.g., `cert=juyo&type=katana`). The cartesian product of all DB value variants for each filter is registered, so alternative spellings (`tokubetsu_hozon`, `TokuHozon`) all redirect correctly.

### Tests

`tests/lib/seo/categoryRedirect.test.ts` — 21 tests covering all redirect scenarios and non-redirect edge cases.

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
- Core pages (home, dealers directory, artists directory)
- All dealer pages (`/dealers/[slug]`)
- All available listings (`/listing/[id]`) — priority 0.7, weekly
- All sold listings (`/listing/[id]`) — priority 0.4, monthly (sold archive)
- Category landing pages (34 total: `/swords/*`, `/fittings/*`, `/certified/*`) — priority 0.8
- Glossary pages (`/glossary/[term]`)
- Artist pages (`/artists/[slug]`) — all 13,566 artisans from Yuhinkai

Batch-fetches in groups of 1000 to handle Supabase row limits.

### Canonical URLs

All pages set `alternates.canonical`. The share proxy (`/s/[id]`) canonicalizes to `/listing/[id]` to prevent duplicate indexing. Browse query-param URLs (`/?type=katana`) are 301-redirected to their canonical category pages (`/swords/katana`) via middleware. See [Canonical Redirects](#canonical-redirects).

### Sold items (archived)

- `robots: { index: true, follow: true }` — preserved for SEO equity (changed 2026-02-16)
- Product JSON-LD sets `availability: SoldOut`
- Description says "sold" / "Previously listed by"
- Included in sitemap (priority 0.4, monthly)
- See [Sold Archive](#sold-archive) for full details

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
| `src/lib/seo/categories.ts` | Dimension-based category generation: `CategoryDef`, `PARAM_TO_COLUMN`, entity URL helpers (`getItemTypeUrl`, `getCertUrl`, `getDealerUrl`), all lookup functions |
| `src/lib/seo/categoryPage.ts` | Shared route handler helpers: `buildCategoryMetadata()`, `buildBrowseUrl()`, `buildBreadcrumbs()` |
| `src/lib/seo/fetchCategoryPreview.ts` | Server-side listing preview fetcher, uses `PARAM_TO_COLUMN` for filter application |
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
| `src/middleware.ts` | Canonical 301 redirects from browse query-param URLs to category pages |
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

### ~~1. Home page metadata adaptation to query params~~ ✅ SUPERSEDED (2026-02-16)

**Resolved by:** Canonical 301 redirects. Browse query-param URLs (`/?type=katana`) now redirect to their canonical category pages (`/swords/katana`) which have full metadata. No need for dynamic metadata on the home page — the redirect consolidates ranking signals to the purpose-built category pages with excellent titles, descriptions, JSON-LD, and intro content. See [Canonical Redirects](#canonical-redirects).

### ~~2. Server-render listing content for Googlebot~~ ✅ DONE (2026-02-15)

**Deployed:** commit `1145920`. See [Listing Detail SSR Architecture](#listing-detail-ssr-architecture) for full details.

Extracted `getListingDetail()` shared function, passed enriched listing as `initialData` prop to client component. Googlebot now sees h1, price, specs, dealer info, and images in the initial HTML. Monitoring via Search Console for "Crawled - currently not indexed" count to decline from 2,423 over 2-4 weeks.

### 3. `tosogu_era` and `tosogu_material` exposure in browse API

**Impact: LOW-MEDIUM** — The browse API (`/api/browse/route.ts`) doesn't return `tosogu_material` or `tosogu_era`. These fields are available in the DB and now used by listing detail metadata, but browse-level features (e.g., faceted filtering by material) can't access them.

### ~~4. Internal linking from listing pages~~ ✅ DONE (2026-02-16)

**Deployed:** Full internal linking mesh. Every entity mention on listing detail pages (cert badge, item type, artisan, school, dealer) is now a link to its canonical page. Related listings headings link artisan/dealer names. Breadcrumbs use category page URLs. Category landing pages have auto-computed "Related Categories" cross-links. See [Internal Linking Mesh](#internal-linking-mesh).

---

## Testing & Validation

### Automated tests

`tests/app/listing-page-seo.test.ts` — 8 tests covering:
- HTTP 404 for missing/invalid listings
- `index: true` for all listings (available and sold — sold archive)
- Description accuracy (sold vs available)
- Share proxy noindex

`tests/lib/seo/categoryRedirect.test.ts` — 21 tests covering:
- Single-filter redirects (type, cert)
- Combination redirects (type+cert, type+school, type+era)
- Case insensitivity and period→era aliasing
- Non-redirect edge cases (tab, sort, dealer, q, CSV values, unknown types)

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
| 2026-02-16 | **Canonical 301 redirects.** Browse query-param URLs (`/?type=katana`, `/?cert=juyo`, `/?type=katana&cert=juyo`) now 301 redirect to their canonical category pages (`/swords/katana`, `/certified/juyo`, `/swords/juyo-katana`). Implemented in middleware via `findCategoryRedirect()`. Supports all 34 category pages, `period`→`era` aliasing, case-insensitive matching, and DB value variants. Browse-UI params (`tab`, `sort`, `dealer`, etc.) bypass the redirect. `buildBrowseUrl()` includes `tab=available` to prevent "Browse all" CTA redirect loops. Supersedes the "home page metadata adaptation" work item. |
| 2026-02-16 | **Refactor: Dimension-based category generation.** Rewrote `categories.ts` from 686 lines of hand-crafted records to dimension-based generation. Unified `filters: Record<string, string[]>` replaces `filterParam`/`filterValues`/`extraFilters`. `PARAM_TO_COLUMN` mapping replaces if/else chains. New `categoryPage.ts` shared helper deduplicates three route handlers (~100 lines → ~45 lines each). `computeRelatedLinks()` auto-generates cross-links. Entity URL helpers (`getItemTypeUrl`, `getCertUrl`, `getDealerUrl`) absorbed from deleted `entityLinks.ts`. |
| 2026-02-16 | **SEO 80/20: Sold archive + 20 combination pages + internal linking mesh.** (1) Sold items now indexed with `SoldOut` JSON-LD, "Sold price" label, "View Similar Items" CTA, included in sitemap at 0.4 priority. (2) 20 combination category pages (cert×type, era×type, school×type) targeting queries like "juyo katana for sale", "koto katana", "bizen katana". (3) Full internal linking: cert badges, item types, artisans, schools, and dealers on listing detail pages link to canonical category/directory pages. Category pages have auto-computed Related Categories sections. |
| 2026-02-15 | **Server-render listing detail content for SEO.** Created `getListingDetail()` shared function, passed enriched listing as `initialData` to client component. Googlebot now sees full listing content (h1, price, specs, dealer, images) in initial HTML. Addresses 2,423 "Crawled - currently not indexed" pages in Search Console. |
| 2026-02-14 | Structured title system for listing pages (`metaTitle.ts`), brand unification to "NihontoWatch", tosogu dual-path field fix. Field coverage measured against live DB — corrected `title_en` from "~5-10%" to **97%** (populated by LLM extraction, not on-demand) |
| 2026-01-25 | Soft 404 fix (proper `notFound()`), noindex for sold items, noindex for share proxy |
| 2026-01-xx | Category landing pages (`/swords/*`, `/fittings/*`, `/certified/*`) with ItemList JSON-LD |
| 2025-xx-xx | Initial SEO implementation: robots.txt, sitemap, JSON-LD, OG images |
