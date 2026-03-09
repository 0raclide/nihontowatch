# Session: "No Papers" Certification Filter (2026-03-02)

## Context

Feature request from collector **Jan Lapacek**: ability to filter for items WITHOUT any certification/papers in the browse filter system. The existing Designation filter only allowed selecting specific certifications (Juyo, Tokubetsu Hozon, etc.) — there was no way to find unpapered items.

## Implementation

### Architecture

The cert filter uses a special value `none` that flows through the full stack:

```
UI checkbox ("No Papers")
    ↓
URL: ?cert=none  (or ?cert=Juyo,none for combined)
    ↓
API: params.certifications = ['none']
    ↓
DB query: .is('cert_type', null)  — or .or() for combined
    ↓
Facets RPC: v_cert_includes_none boolean for cross-filtering
```

### Changes (5 files)

#### 1. SQL Migration (`supabase/migrations/095_no_papers_cert_filter.sql`)

Updated `get_browse_facets` RPC (replaces version from migration 084):

- **New variable**: `v_cert_includes_none BOOLEAN` — set to true when `'none'` is in `p_certifications`
- **Cert facet counting**: Split `cert_counts` into `cert_counts_named` (existing) + `cert_counts_none` (counts `cert_type IS NULL`), combined via `UNION ALL`
- **Cross-filtering**: All 4 non-cert facet CTEs (item_type, dealer, period, signature) updated to include `cert_type IS NULL` rows when `v_cert_includes_none` is true. Uses a 4-branch OR condition:
  - No cert filter → pass all
  - Variants + none → `cert_type = ANY(variants) OR cert_type IS NULL`
  - Variants only → `cert_type = ANY(variants)` (existing behavior)
  - None only → `cert_type IS NULL`

#### 2. Browse API (`src/app/api/browse/route.ts`)

```typescript
if (params.certifications?.length) {
  const hasNone = params.certifications.includes('none');
  const certFilters = params.certifications.filter(c => c !== 'none');
  const allVariants = certFilters.flatMap(c => CERT_VARIANTS[c] || [c]);

  if (hasNone && allVariants.length > 0) {
    query = query.or(`cert_type.in.(${allVariants.join(',')}),cert_type.is.null`);
  } else if (hasNone) {
    query = query.is('cert_type', null);
  } else {
    query = query.in('cert_type', allVariants);
  }
}
```

#### 3. Filter UI (`src/components/browse/FilterContent.tsx`)

- Added `none: 'No Papers'` to `CERT_LABELS`
- Added `'none'` at end of `CERT_ORDER` (appears last, after all cert types)
- No other changes needed — existing `sortedCertifications` filter logic (`CERT_LABELS[f.value]` check + `HIDDEN_CERTS` exclusion) naturally includes it

#### 4. i18n (`en.json` / `ja.json`)

- EN: `cert.none` changed from "None" → "No Papers"
- JA: `cert.none` changed from "なし" → "鑑定書なし"
- `cert.none` also used by collection form dropdown (empty cert option) — "No Papers" reads naturally there too

### Behavior

- **Standalone**: Check "No Papers" → shows only unpapered items
- **Combined**: Check "Hozon" + "No Papers" → shows items with Hozon OR no papers (union, not intersection)
- **Cross-filtering**: When "No Papers" is active, other facet dimensions (type, dealer, period, signature) correctly include unpapered items in their counts
- **Facet count**: The "No Papers" checkbox shows accurate count of NULL cert_type items, respecting all other active filters

### Deploy Status

- **DB migration**: Applied to production Supabase via `supabase db push --linked --include-all`
- **Code**: Pushed to `origin/main` (commit `664a15d`)
- **Vercel**: Service outage at time of push — will auto-deploy when Vercel recovers

### Test Results

All 4503 tests pass. 9 pre-existing failures (collection localStorage mock + user-preferences timeout) unrelated to this change.

## Key Files

| Component | Location |
|-----------|----------|
| SQL migration | `supabase/migrations/095_no_papers_cert_filter.sql` |
| Browse API cert filter | `src/app/api/browse/route.ts` (lines ~401-415) |
| Filter UI labels/order | `src/components/browse/FilterContent.tsx` (CERT_LABELS, CERT_ORDER) |
| EN i18n | `src/i18n/locales/en.json` (`cert.none`) |
| JA i18n | `src/i18n/locales/ja.json` (`cert.none`) |
