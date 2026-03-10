# Mei × Form Breakdown — Handoff

**Goal:** When clicking a signature style row (e.g., "Signed (mei) — 166") on an artist page, expand to show blade type breakdown underneath: "29 tanto, 2 tachi, 135 katana".

**Scope:** NihontoWatch only. Zero oshi-v2 changes needed.

---

## Architecture

The data already exists. NihontoWatch queries `gold_values` from oshi-v2 and gets both `gold_mei_status` and `gold_form_type` per row. Today the code aggregates them into two independent `Record<string, number>` dictionaries. We just need a cross-tabulation and a UI expand.

### Data Flow (existing)

```
gold_values (oshi-v2 Supabase)
  → getArtisanDistributions()        [yuhinkai.ts:1628]
    → processGoldValuesRows()        [yuhinkai.ts:1556]
      → form_distribution: { katana: 135, tanto: 29, ... }
      → mei_distribution:  { signed: 166, mumei: 62, ... }
      → measurements_by_form: { katana: { nagasa: [...], ... }, ... }
  → stats on ArtisanPageResponse     [artisan.ts:89]
    → <MeiDistributionBar>           [MeiDistributionBar.tsx]
```

### Reference Pattern

`FormDistributionBar.tsx` already implements click-to-expand. Rows with measurement data become `<button>` elements with `▸`/`▾` toggles and a `useState<string | null>` for the expanded row. Mirror this exact pattern.

---

## Changes (3 files + types)

### 1. `src/lib/supabase/yuhinkai.ts` — Add cross-tabulation

In `processGoldValuesRows()` (~line 1556), add a new accumulator:

```typescript
const formByMei: Record<string, Record<string, number>> = {};
```

At the end of the per-row loop (after both `formKey` and `meiKey` are computed, ~line 1617), cross-tabulate:

```typescript
if (meiKey && formKey) {
  if (!formByMei[meiKey]) formByMei[meiKey] = {};
  formByMei[meiKey][formKey] = (formByMei[meiKey][formKey] || 0) + 1;
}
```

Add `form_by_mei` to the return object:

```typescript
return { form_distribution: form, mei_distribution: mei, measurements_by_form: measurements, form_by_mei: formByMei };
```

Update the return type signature (lines 1559-1562) and the `getArtisanDistributions()` return type (lines 1631-1634) to include `form_by_mei: Record<string, Record<string, number>>`.

### 2. `src/types/artisan.ts` — Update `ArtisanPageResponse.stats`

Add the new field to the `stats` shape (line 89-98):

```typescript
stats: {
  mei_distribution: Record<string, number>;
  form_distribution: Record<string, number>;
  measurements_by_form: Record<string, { ... }>;
  form_by_mei: Record<string, Record<string, number>>;  // ← NEW
} | null;
```

### 3. `src/components/artisan/MeiDistributionBar.tsx` — Add expand UI

**Props:** Add `formByMei?: Record<string, Record<string, number>>`.

**State:** Add `const [expandedMei, setExpandedMei] = useState<string | null>(null);`

**Render:** For each mei entry, check if `formByMei?.[type]` has data. If yes, render the row as a `<button>` (same pattern as `FormDistributionBar.tsx` lines 79-104):
- Click toggles `expandedMei`
- Show `▸`/`▾` indicator
- When expanded, show form entries as a compact sub-list

**Expanded content example:**

```
▾ Signed (mei)                          166    67%
    Katana                              135
    Tanto                                29
    Tachi                                 2
```

Style the sub-items with `pl-5 pr-2` and smaller/lighter text, exactly like `FormDistributionBar`'s expanded `MeasurementPanel` indentation. But instead of measurement ranges, just show simple `label — count` rows. Use the same `FORM_TRANSLATION_KEYS` map from `FormDistributionBar` (or import a shared constant) to translate form keys to localized labels.

### 4. `src/app/artists/[slug]/ArtistPageClient.tsx` — Thread the prop

Pass `formByMei` through (line 688):

```tsx
<MeiDistributionBar
  distribution={stats.mei_distribution}
  formByMei={stats.form_by_mei}
/>
```

---

## Key Details

- **No oshi-v2 migration needed.** The `gold_values` query already returns both `gold_form_type` and `gold_mei_status` per row. The cross-tab is pure client-side aggregation.
- **No new Supabase query.** The existing `getArtisanDistributions()` query fetches everything. Just aggregate differently in `processGoldValuesRows()`.
- **JE_Koto exclusion still applies.** The `form_by_mei` accumulation must be inside the existing loop, AFTER the JE_Koto skip guard (line 1573).
- **Form key reuse.** `formKey` is already computed per row and normalized to known forms (line 1578-1583). Reuse it — don't re-extract.
- **Translation keys.** `MeiDistributionBar` will need the `FORM_TRANSLATION_KEYS` map (currently in `FormDistributionBar.tsx`). Either import it or duplicate it. Importing is cleaner — consider extracting to a shared constant, or just inline the small map.
- **Sort sub-items by count desc** (same as main rows).
- **Tosogu artists work too.** For tosogu makers, form types will be tsuba/kozuka/etc. instead of katana/tanto. The existing `SWORD_FORMS` / `TOSOGU_FORMS` split in `processGoldValuesRows` already handles this, so `formByMei` will naturally contain the right keys.

## Testing

- Check a sword maker with diverse mei types (e.g., Masamune — has signed + mumei + kinzogan)
- Check a tosogu maker (e.g., Somin YOK001 — forms should be tsuba/kozuka/etc.)
- Check an artist where a mei type has only 1 form — should still expand correctly
- Verify the `form_by_mei` counts sum to the same total as `mei_distribution` counts
