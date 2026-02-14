# Artist Directory: Optimization Architecture

**Date:** 2026-02-14
**Status:** Proposal (based on codebase analysis)

## Problem Statement

The `/api/artists/directory` endpoint makes **50-350+ database queries** per page load across two databases (Yuhinkai + main NihontoWatch). Most of this work computes data that either rarely changes or can be derived in a single SQL expression.

The Yuhinkai catalog has 12,447 smiths and 1,119 tosogu makers. These tables are tiny by database standards. The cost isn't data volume — it's round-trip count.

## Current Cost Breakdown (per page of 50 artists)

| Work | Queries | Database | Changes when? |
|------|---------|----------|---------------|
| Artist rows (paginated) | 1 | Yuhinkai | Filter/page change |
| Facets (schools, provinces, eras, totals) | 5 | Yuhinkai | Type change only |
| Elite percentiles | 2 + N (N ≈ 40) | Yuhinkai | Catalog ingestion (~monthly) |
| School member counts | 0-5 | Yuhinkai | Catalog ingestion |
| School member listing aggregation | 2-10 | Both | Scraper runs (daily) |
| Listing data per artist | 1 | Main | Scraper runs (daily) |
| Hero images (uncached) | 5-25 per artist × 50 | Yuhinkai + HTTP | Catalog ingestion |
| Live stats | 2 | Main | Scraper runs (daily) |
| **Total** | **~50-350+** | | |

After today's parallelization and `skipMeta` changes, wall-clock time improved (concurrent instead of sequential), but total query count is unchanged.

## Root Causes

**1. No SQL-level computation on Yuhinkai.** Zero RPC functions exist on the Yuhinkai database. All aggregation, percentile calculation, and facet counting happens in JavaScript via individual Supabase client calls. The browse page solved this same problem for the main DB with `get_browse_facets` (migration 059) — one SQL RPC replacing 50-100+ JS round-trips.

**2. Percentiles computed via N+1 pattern.** `getBulkElitePercentiles` fires one `COUNT(*) WHERE elite_factor < X` query per unique elite_factor value. PostgreSQL can compute this with `PERCENT_RANK()` over 12K rows in under 5ms.

**3. Hero images resolved at request time.** Each uncached artist requires walking 5 collection priority tiers, querying `gold_values` → `catalog_records` → `linked_records` → HTTP HEAD. These are static catalog images that never change for a given artisan.

**4. Facets are global, not contextual.** `getArtistDirectoryFacets(type)` returns all schools/provinces/eras for the entity type, ignoring active filters. Users see options that yield 0 results.

**5. Cross-database join on every request.** Listing counts require querying the main DB for each page of artists. No summary exists.

## Proposed Architecture

### Phase 1: Yuhinkai RPC — `get_directory_enrichment`

**One SQL function replacing ~90 queries.** Follows the exact pattern of `get_browse_facets`.

```sql
CREATE OR REPLACE FUNCTION get_directory_enrichment(
  p_entity_type TEXT,           -- 'smith' or 'tosogu'
  p_codes       TEXT[],         -- artist codes on current page
  p_sort        TEXT DEFAULT 'elite_factor',
  p_school      TEXT DEFAULT NULL,
  p_province    TEXT DEFAULT NULL,
  p_era_years   INT[] DEFAULT NULL,  -- pre-resolved era years from eraPeriods.ts
  p_q           TEXT DEFAULT NULL,
  p_notable     BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  tbl TEXT;
  id_col TEXT;
  result jsonb;
BEGIN
  IF p_entity_type = 'tosogu' THEN
    tbl := 'tosogu_makers'; id_col := 'maker_id';
  ELSE
    tbl := 'smith_entities'; id_col := 'smith_id';
  END IF;

  -- All computation in one round-trip:

  -- A) Percentiles via PERCENT_RANK() window function
  --    Replaces: getBulkElitePercentiles (2 + N queries)
  --    Scans 12K rows once, returns percentile for requested codes only
  --
  --    WITH ranked AS (
  --      SELECT {id_col},
  --             ROUND(PERCENT_RANK() OVER (ORDER BY elite_factor) * 100)::int AS pct
  --      FROM {tbl}
  --      WHERE total_items > 0
  --    )
  --    SELECT {id_col}, pct FROM ranked WHERE {id_col} = ANY(p_codes)

  -- B) Contextual facets with cross-filter logic
  --    Replaces: getArtistDirectoryFacets (5 queries, global counts)
  --    Each facet dimension filtered by ALL OTHER active filters
  --
  --    Schools: filtered by province, era, q, notable (NOT school)
  --    Provinces: filtered by school, era, q, notable (NOT province)
  --    Eras: filtered by school, province, q, notable (NOT era)
  --    Totals: smith + tosogu counts with all filters applied

  -- C) School member counts
  --    Replaces: getSchoolMemberCounts (N queries)
  --    Single query: COUNT(*) GROUP BY school
  --    WHERE school IN (schools of NS-codes in p_codes)

  RETURN result;
END;
$$;
```

**What this replaces in `yuhinkai.ts`:**

| Current function | Queries | After RPC |
|-----------------|---------|-----------|
| `getBulkElitePercentiles` | 2 + ~40 | 0 (included in RPC) |
| `getBulkProvenancePercentiles` | 2 + ~20 | 0 (included in RPC) |
| `getArtistDirectoryFacets` | 5 | 0 (included in RPC) |
| `getSchoolMemberCounts` | 0-5 | 0 (included in RPC) |
| **Total saved** | **~70-90 queries** | **1 RPC call** |

**Client-side change:** `fetchArtists` in `ArtistsPageClient.tsx` already conditionally applies facets via `if (data.facets)`. The API response shape stays the same — only the backend computation changes.

**Why this works for 12K rows:** `PERCENT_RANK()` over `smith_entities` (12,447 rows) executes in <10ms on any Postgres instance. The entire RPC should complete in 20-50ms. The current 90-query approach likely takes 500-2000ms of network round-trip time alone.

**Why contextual facets matter:** Currently, selecting school=Bizen then opening the era dropdown shows all 40+ eras — including eras with zero Bizen smiths. Contextual facets show only Kamakura, Nanbokucho, Muromachi (the eras where Bizen smiths worked), with accurate counts. This is what the browse page already does.

### Phase 2: Hero Image Materialization

**One lookup table replacing 250-750 queries + HTTP per page.**

The current `getArtisanHeroImage` function walks through up to 5 collection tiers per artist, querying `gold_values` → `catalog_records` → `linked_records`, then verifying the image exists via HTTP HEAD against storage.

These are static catalog images. MAS590's oshigata from the Juyo catalog will never change.

```sql
CREATE TABLE artisan_hero_images (
  artisan_code  TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,     -- 'smith' or 'tosogu'
  image_url     TEXT,              -- NULL if no image found
  collection    TEXT,              -- e.g., 'Juyo', 'Tokuju'
  image_type    TEXT,              -- 'oshigata' or 'setsumei'
  resolved_at   TIMESTAMPTZ DEFAULT now()
);
```

**Population:** A SQL function or maintenance script that runs the same collection-priority logic currently in `getArtisanHeroImage`, but writes results to this table instead of returning them. Run once on creation, then on-demand when catalog data changes.

**Query in directory API:**

```typescript
const { data: heroRows } = await yuhinkaiClient
  .from('artisan_hero_images')
  .select('artisan_code, image_url')
  .in('artisan_code', codes);
```

One query. No HTTP HEAD checks. No cold-start penalty.

**The in-memory cache (`heroImageCache`) becomes unnecessary** and can be removed.

### Phase 3: Listing Count Summary Table

**One main DB table replacing cross-database joins.**

Currently, every directory page load queries the main NihontoWatch DB for listing counts per artisan (`getListingDataForArtists`), plus a separate chain for school member listing aggregation. This is the only reason the directory API touches the main DB (besides live stats).

```sql
-- On the main NihontoWatch database
CREATE TABLE artisan_listing_summary (
  artisan_code    TEXT PRIMARY KEY,
  available_count INT NOT NULL DEFAULT 0,
  first_listing_id INT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Maintained by trigger on listings table
CREATE OR REPLACE FUNCTION refresh_artisan_listing_summary()
RETURNS trigger AS $$
BEGIN
  -- Recompute counts for the affected artisan_id(s)
  INSERT INTO artisan_listing_summary (artisan_code, available_count, first_listing_id)
  SELECT artisan_id,
         COUNT(*),
         MIN(id) FILTER (WHERE is_available)
  FROM listings
  WHERE artisan_id IN (NEW.artisan_id, OLD.artisan_id)
    AND is_available = true AND admin_hidden = false
  GROUP BY artisan_id
  ON CONFLICT (artisan_code) DO UPDATE SET
    available_count = EXCLUDED.available_count,
    first_listing_id = EXCLUDED.first_listing_id,
    updated_at = now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**What this eliminates:**
- `getListingDataForArtists` calls from directory API
- `getAllAvailableListingCounts` (the `for_sale` sort path that fetches ALL listings)
- `getSchoolMemberCodes` + member listing aggregation chain

The `for_sale` sort becomes a simple Yuhinkai query that joins with this summary table via the artisan code — no need to fetch all listings into JS memory.

## Resulting Architecture

### Before (current)

```
Filter click → API request
  ├── getArtistsForDirectory          (1 query, Yuhinkai)
  ├── getListingDataForArtists        (1 query, Main DB)
  ├── getSchoolMemberCodes            (0-5 queries, Yuhinkai)
  │   └── getListingDataForArtists    (1 query, Main DB)
  ├── getArtistDirectoryFacets        (5 queries, Yuhinkai) — global, not contextual
  ├── getBulkElitePercentiles         (42 queries, Yuhinkai)
  ├── getSchoolMemberCounts           (0-5 queries, Yuhinkai)
  ├── getBulkArtisanHeroImages        (250-750 queries + HTTP, Yuhinkai) — on cold start
  └── live stats                      (2 queries, Main DB)
  ≈ 300+ queries across 2 databases
```

### After (all 3 phases)

```
Filter click → API request
  ├── getArtistsForDirectory          (1 query, Yuhinkai)
  ├── get_directory_enrichment RPC    (1 RPC, Yuhinkai) — percentiles + contextual facets + member counts
  ├── artisan_hero_images             (1 query, Yuhinkai)
  ├── artisan_listing_summary         (1 query, Main DB)
  └── live stats                      (2 queries, Main DB) — skipped on scroll appends
  = 6 queries across 2 databases, all in parallel
```

**50x reduction in query count.** Wall-clock time dominated by the slowest single query (~20-50ms) instead of cumulative round-trips (~500-2000ms).

## Implementation Order

| Phase | Scope | Risk | Impact | Dependencies |
|-------|-------|------|--------|-------------|
| **1: RPC** | Yuhinkai DB + `yuhinkai.ts` + directory API | Low — additive, old functions kept as fallback | **~90 queries → 1** | Yuhinkai DB access (oshi-v2 project) |
| **2: Hero images** | Yuhinkai DB + `yuhinkai.ts` + directory API | Low — lookup table is append-only | **250-750 queries → 1** | Yuhinkai DB access, one-time population script |
| **3: Listing summary** | Main DB migration + trigger + directory API | Medium — trigger on hot `listings` table | **Cross-DB join eliminated** | Migration deploy, scraper awareness |

Phase 1 is the highest leverage single change and can be deployed independently. Phase 2 eliminates the largest absolute query count. Phase 3 is the architectural fix but requires the most coordination.

## What We Already Shipped (2026-02-14)

These changes are live and address the client-side symptoms:

| Commit | Change | Effect |
|--------|--------|--------|
| `5ab2c07` | Infinite scroll (replaced pagination) | Smooth UX, no page reloads |
| `f1a8fd7` | `skipMeta` on scroll appends | -7 queries per scroll load |
| `f1a8fd7` | Parallelize all post-artist enrichment | Wall-clock time ≈ slowest branch, not sum |
| `f1a8fd7` | Stale-while-revalidate UI (dim grid, not skeletons) | Filters feel instant |
| `f1a8fd7` | Sidebar controls stay enabled during fetches | No more locked UI |

These are band-aids on a fundamentally chatty architecture. The phases above fix the root cause.

## Key Files

| Component | Location |
|-----------|----------|
| Directory API | `src/app/api/artists/directory/route.ts` |
| Yuhinkai client (all functions) | `src/lib/supabase/yuhinkai.ts` |
| Client component | `src/app/artists/ArtistsPageClient.tsx` |
| Browse facets RPC (pattern) | `supabase/migrations/059_browse_facets_rpc.sql` |
| Artisan display names | `src/lib/artisan/displayName.ts` |
| Era period mapping | `src/lib/artisan/eraPeriods.ts` |
| Artisan matching columns | `supabase/migrations/048_artisan_matching.sql` |
| Elite factor denorm | `supabase/migrations/050_elite_factor_denorm.sql` |
