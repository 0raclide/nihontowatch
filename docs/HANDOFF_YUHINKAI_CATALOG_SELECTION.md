# Handoff: Yuhinkai Support for Dealer Catalog Selection

## What We're Building

NihontoWatch's dealer portal lets dealers create listings. For Juyo, Tokuju, and Jubi items, we want dealers to **select the exact item from the Yuhinkai catalog** so the form auto-fills with verified data. The flow:

1. Dealer selects artisan (e.g., MAS590 — Masamune) + cert level (e.g., Juyo)
2. Selection screen opens showing matching items as oshigata image cards
3. Dealer filters by session/volume, finds their specific item
4. Taps it → form auto-fills measurements, item type, mei, era, session number

**This document describes what NihontoWatch needs from Yuhinkai to make this work, and the open questions we need answered before building.**

---

## What NihontoWatch Can Already Do

NihontoWatch already has a working catalog search for the collection manager (`/api/collection/catalog-search/route.ts`, 190 lines). It queries three Yuhinkai tables via PostgREST:

1. **`gold_values`** — measurements (`gold_nagasa`, `gold_sori`, `gold_motohaba`, `gold_sakihaba`), artisan IDs (`gold_smith_id`, `gold_maker_id`), collections (`gold_collections`), form type, mei status
2. **`catalog_records`** — collection, volume, item_number (the catalog position)
3. **`artisan_makers`** — display names, school, province, era

The existing API searches by **text query** (smith name) + optional cert filter. For the dealer feature, we need to search by **exact artisan_id** + **exact collection**. This is a straightforward extension of what we already have — no new table access needed for the core query.

### URL construction for oshigata images is also already solved

NihontoWatch constructs oshigata URLs from catalog metadata using a convention-based pattern (`yuhinkai.ts:buildStoragePaths()`):

```
Volume-based collections (Juyo, Tokuju, Jubi):
  {IMAGE_STORAGE_BASE}/storage/v1/object/public/images/{collection}/{volume}_{item}_oshigata.jpg

Fallback (setsumei):
  {IMAGE_STORAGE_BASE}/storage/v1/object/public/images/{collection}/{volume}_{item}_setsumei.jpg
```

`IMAGE_STORAGE_BASE` defaults to `https://itbhfhyptogxcjbjfzwx.supabase.co`.

This is the same pattern used for artist hero images, which are already working in production.

---

## What We Don't Know (Open Questions)

These are **blockers** — we need answers before we can design the UX correctly.

### Question 1: How many oshigata files actually exist per collection?

**Why this matters:** The entire UX premise is a visual selection grid of oshigata cards. If only 10% of Juyo items have oshigata images, the grid will be mostly broken image placeholders and the feature feels bad. If 80%+ have images, the visual grid is the right call.

**What we know:**
- Jubi: **816 oshigata** across 8 volumes (from `JUBI_INTEGRATION.md`). But Jubi has ~5,863 catalog records. That's only ~14% coverage if all records are unique objects.
- Kokuho: 122 oshigata (100% — but not relevant to this feature)
- Juyo: **Unknown.** ~15,282 catalog records exist. How many have oshigata files in the `images` bucket?
- Tokuju: **Unknown.** 1,341 catalog records. How many have oshigata files?

**What we need:** Actual file counts from the Supabase Storage bucket. Something like:

```bash
# Count oshigata files per collection in the images bucket
ls images/Juyo/ | grep '_oshigata.jpg' | wc -l
ls images/Tokuju/ | grep '_oshigata.jpg' | wc -l
ls images/Jubi/ | grep '_oshigata.jpg' | wc -l
```

Or query `stored_images` if those rows exist:
```sql
SELECT
  substring(storage_path from '^([^/]+)/') AS collection,
  count(*)
FROM stored_images
WHERE image_type = 'oshigata' AND is_current = true
GROUP BY 1;
```

**Important caveat we discovered:** Migration 294 in oshi-v2 explicitly says: *"The stored_images table doesn't contain catalog oshigata/setsumei records, so we can't use it for verification."* This means the bulk catalog oshigata files may NOT have `stored_images` rows — they exist only as files in Supabase Storage following the naming convention. If that's the case, the only way to know coverage is to list the storage bucket.

**Impact on UX design:**
- **>70% coverage** → Image-first grid, text fallback for missing
- **30-70% coverage** → Hybrid grid, prominent text cards, images as enhancement
- **<30% coverage** → Text-first list with measurements, oshigata as bonus thumbnail

### Question 2: Are `stored_images` rows populated for bulk catalog oshigata, or only for user uploads?

**Why this matters:** This determines whether we can use a DB query to know if an oshigata exists, or whether we must try loading the URL and handle 404s client-side.

**What we suspect:** `stored_images` rows are created only via the image upload API routes (`/api/catalog/[uuid]/image` and `/api/records/images`). The bulk catalog oshigata that were ingested from NBTHK publications may have been placed directly into Supabase Storage without creating `stored_images` rows.

**What we need confirmed:**
- Are there `stored_images` rows for NBTHK publication scans (the bulk catalog images), or only for user-uploaded replacements?
- If no rows exist: is there any other way to determine image existence without a HEAD request?

**If stored_images IS populated:** We can LEFT JOIN in the query and return a `has_oshigata` boolean. Clean, fast.

**If stored_images is NOT populated for bulk images:** We have two options:
1. **Client-side fallback** — Optimistically render `<img>` with `onError` fallback to setsumei, then text card. Works but causes visual flicker on missing images.
2. **Pre-compute a lookup table** (ask below) — Better UX but requires Yuhinkai work.

### Question 3: Do we need an RPC, or are direct PostgREST queries sufficient?

**Why this matters:** NihontoWatch already queries `gold_values`, `catalog_records`, and `artisan_makers` via PostgREST. We could just add a new API route that does the same queries with `artisan_id` + `collection` filters. No RPC needed.

**But an RPC would help if:**
- The multi-table join is too slow as separate PostgREST roundtrips (gold_values → catalog_records → artisan_makers = 3 queries today)
- We need `has_oshigata` from stored_images (adds a 4th query or needs a join that PostgREST can't express)
- Large result sets need server-side pagination with `COUNT(*) OVER()` window function

**What we need:** Your recommendation. Given the data volumes (a single artisan + collection typically returns 1-100 items), are 3 sequential PostgREST queries fast enough? Or should we consolidate into one RPC?

### Question 4: Indexes on `gold_smith_id` and `gold_maker_id`?

**Why this matters:** The core query filters `gold_values` by `gold_smith_id = 'MAS590'` OR `gold_maker_id = 'MAS590'`. With 23,849 rows in gold_values, an unindexed scan is probably fine. But if there's no index, the OR condition could be slow.

**What we need:** Confirm indexes exist, or create them:
```sql
CREATE INDEX IF NOT EXISTS idx_gold_values_smith_id ON gold_values(gold_smith_id);
CREATE INDEX IF NOT EXISTS idx_gold_values_maker_id ON gold_values(gold_maker_id);
```

### Question 5: Jubi item numbering — sequential across volumes?

**Why this matters:** `JUBI_INTEGRATION.md` says item numbers are sequential across all volumes (Vol 2 doesn't restart at item 1). This means the storage path `Jubi/2_156_oshigata.jpg` is correct (not `Jubi/2_1_oshigata.jpg` for the first item of Vol 2).

**What we need confirmed:** Is this true? And does it also apply to Juyo and Tokuju, or do those restart numbering per volume?

### Question 6: Can a single object_uuid have multiple oshigata in stored_images?

**Why this matters:** If a sword was designated Juyo and later Tokuju, it has two `catalog_records` rows but one `physical_objects` row. If we LEFT JOIN `stored_images ON object_uuid`, could we get multiple oshigata rows (one per designation) and cause row multiplication?

**What we suspect:** Based on the schema, `stored_images.object_uuid` is NOT NULL but `catalog_record_uuid` IS nullable. Images seem to be per-physical-object, not per-designation. But we need confirmation.

**What we need:** Can `stored_images` have multiple `is_current = true` rows for the same `object_uuid` + `image_type = 'oshigata'`? If yes, we need `DISTINCT ON` in any join.

---

## What We'd Like Built (Conditional on Answers Above)

### If stored_images IS populated for catalog images → Build an RPC

If `stored_images` has rows for bulk catalog oshigata, an RPC is the cleanest approach because it can join everything server-side:

```sql
CREATE OR REPLACE FUNCTION get_dealer_catalog_candidates(
  p_artisan_id TEXT,
  p_collection TEXT,         -- 'Juyo', 'Tokuju', or 'Jubi'
  p_volume INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  object_uuid     UUID,
  collection      TEXT,
  volume          INTEGER,
  item_number     INTEGER,
  form_type       TEXT,
  nagasa_mm       FLOAT,
  sori_mm         FLOAT,
  motohaba_mm     FLOAT,
  sakihaba_mm     FLOAT,
  mei_status      TEXT,
  period          TEXT,
  tradition       TEXT,
  has_oshigata    BOOLEAN,
  has_setsumei    BOOLEAN,
  total_count     BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gv.object_uuid,
    cr.collection,
    cr.volume,
    cr.item_number,
    gv.gold_form_type,
    gv.gold_nagasa,
    gv.gold_sori,
    gv.gold_motohaba,
    gv.gold_sakihaba,
    gv.gold_mei_status,
    gv.gold_period,
    gv.gold_tradition,
    EXISTS(SELECT 1 FROM stored_images si
           WHERE si.object_uuid = gv.object_uuid
           AND si.image_type = 'oshigata' AND si.is_current = true),
    EXISTS(SELECT 1 FROM stored_images si
           WHERE si.object_uuid = gv.object_uuid
           AND si.image_type = 'setsumei' AND si.is_current = true),
    COUNT(*) OVER()
  FROM gold_values gv
  JOIN catalog_records cr
    ON cr.object_uuid = gv.object_uuid
    AND cr.collection = p_collection
  WHERE (gv.gold_smith_id = p_artisan_id OR gv.gold_maker_id = p_artisan_id)
    AND (p_volume IS NULL OR cr.volume = p_volume)
  ORDER BY cr.volume ASC, cr.item_number ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;
```

NihontoWatch constructs the image URL from `collection + volume + item_number` (convention-based), and uses `has_oshigata`/`has_setsumei` to decide whether to show an image card or text card.

### If stored_images is NOT populated → Two options

**Option A: Pre-compute a lookup table** (preferred for UX)

Create a materialized view or table that records which catalog items have oshigata/setsumei files in storage:

```sql
CREATE TABLE catalog_image_availability (
  object_uuid UUID PRIMARY KEY,
  has_oshigata BOOLEAN DEFAULT FALSE,
  has_setsumei BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);
```

Populate by scanning the storage bucket and matching file names to catalog_records. This lets NihontoWatch know upfront which items have images, avoiding 404 flicker in the grid.

**Option B: NihontoWatch handles it client-side** (no Yuhinkai work needed)

We optimistically render all items with oshigata URLs, use `onError` to fall back to setsumei, then to a text-only card. This works but produces visual flicker as images 404.

### Volume listing (needed regardless)

For the session filter dropdown, we need to know which volumes an artisan appears in:

```sql
CREATE OR REPLACE FUNCTION get_catalog_volumes(
  p_artisan_id TEXT,
  p_collection TEXT
)
RETURNS TABLE (volume INTEGER, item_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT cr.volume, COUNT(*)
  FROM catalog_records cr
  JOIN gold_values gv ON gv.object_uuid = cr.object_uuid
  WHERE cr.collection = p_collection
    AND (gv.gold_smith_id = p_artisan_id OR gv.gold_maker_id = p_artisan_id)
  GROUP BY cr.volume
  ORDER BY cr.volume ASC;
END;
$$ LANGUAGE plpgsql STABLE;
```

Output: `Session: [All (87)] [1 (3)] [2 (1)] [15 (2)] [42 (1)]`

---

## Fields NihontoWatch Will Auto-Fill

When the dealer selects an item, NihontoWatch maps:

| Yuhinkai Field | Dealer Form Field | Transform |
|----------------|-------------------|-----------|
| `form_type` | `itemType` | Lowercase, normalize via `FORM_TO_ITEM_TYPE` |
| `nagasa_mm` | `nagasaCm` | `÷ 10` |
| `sori_mm` | `soriCm` | `÷ 10` |
| `motohaba_mm` | `motohabaCm` | `÷ 10` |
| `sakihaba_mm` | `sakihabaCm` | `÷ 10` |
| `mei_status` | `meiType` | Map: Signed→zaimei, Unsigned→mumei |
| `volume` | cert session | Already part of title generation |
| `period` | `era` | Normalize to form's era enum |
| `collection` | `certType` | Already set by dealer |
| `object_uuid` | `catalogReference` | Stored as JSONB for audit trail + dedup |

Dealer still provides: price, their own photos, description, sayagaki, koshirae.

---

## Data Volumes

| Artisan | Collection | Expected Items |
|---------|-----------|---------------|
| Masamune (MAS590) | Juyo | ~87 |
| Masamune (MAS590) | Tokuju | ~5-10 |
| Osafune Kanemitsu | Juyo | ~40-60 |
| Goto Ichijo (GOT042) | Juyo | ~15-30 |
| Typical mid-tier smith | Juyo | 1-10 |
| Typical tosogu maker | Juyo | 1-5 |

Most queries return <50 items. The RPC limit/offset handles outliers.

---

## Jubi Image Coverage (Known)

From `JUBI_INTEGRATION.md`:

| Volume | Oshigata | Setsumei | Notes |
|--------|----------|----------|-------|
| 1 | 124 | 151 | |
| 2 | 95 | 113 | |
| 3 | 100 | 145 | Items 300-303 missing oshigata |
| 4 | 127 | 163 | |
| 5 | 114 | 150 | |
| 6 | 134 | 151 | |
| 7 | 117 | 123 | |
| 8 | 5 | 97 | Most items lack oshigata |
| **Total** | **816** | **1,093** | |

---

## Future: Duplicate Detection (Phase 2)

Once dealer listings link to `object_uuid`, NihontoWatch can detect when two dealers list the same physical sword — a powerful data quality signal. We'll add a `catalog_object_uuid` column to the NihontoWatch `listings` table. This also enables provenance tracking (collector's collection item + dealer listing → same physical object).

---

## Summary: What We Need from You

**Must-have answers (blockers):**
1. Oshigata file counts for Juyo and Tokuju in the storage bucket
2. Whether `stored_images` has rows for bulk catalog oshigata, or only user uploads
3. Whether Juyo/Tokuju item numbers restart per volume or are sequential across volumes

**Nice-to-have (if answers warrant it):**
4. `get_dealer_catalog_candidates` RPC (if stored_images is populated and we want `has_oshigata` flags)
5. `get_catalog_volumes` RPC (small, useful for session dropdown)
6. Indexes on `gold_smith_id` / `gold_maker_id` if they don't exist
7. `catalog_image_availability` lookup table (if stored_images is NOT populated for bulk images)
