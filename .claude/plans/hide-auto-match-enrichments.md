# Plan: Hide Auto-Matched Yuhinkai Enrichments

## Problem Statement

The SOTA auto-matcher in oshi-v2 produces false positives (e.g., matching a Tokuju listing to a Juyo catalog record). These incorrect matches are displayed to users as "Catalog Data" or "Official Catalog Translation", damaging data quality and user trust.

**Example:** Listing 6758 (Tokuju) was incorrectly matched to Juyo vol.59 #21, displaying wrong artisan/school info.

## Current State

### Display Logic
```typescript
// src/types/index.ts
function hasVerifiedEnrichment(listing: ListingWithEnrichment): boolean {
  return (
    enrichment.match_confidence === 'DEFINITIVE' &&
    ['auto', 'confirmed'].includes(enrichment.verification_status)
  );
}
```

This allows BOTH auto and manual connections to display.

### Data Sources
| Source | `connection_source` | `verification_status` | Quality |
|--------|--------------------|-----------------------|---------|
| SOTA Matcher | `'auto'` or `null` | `'auto'` | ❌ Has false positives |
| Admin Manual | `'manual'` | `'confirmed'` | ✅ Human verified |

### Missing Field
The listing API (`/api/listing/[id]/route.ts`) does NOT include `connection_source` in its query, so the frontend can't distinguish auto vs manual.

---

## Solution: Only Show Manual Connections

### Approach
1. Add `connection_source` to the API response
2. Update `hasVerifiedEnrichment` to only accept manual connections
3. Add a feature flag for future when auto-matcher is production-ready

### Why This Approach
- **Minimal changes** - Only modify display logic, not data
- **Preserves data** - Auto-match records stay in DB for future use
- **Easy to revert** - Feature flag allows quick enable when ready
- **Safe** - Users only see human-verified data

---

## Implementation Steps

### Step 1: Add `connection_source` to Listing API

**File:** `src/app/api/listing/[id]/route.ts`

Add `connection_source` to the Supabase select query:

```typescript
listing_yuhinkai_enrichment (
  enrichment_id,
  listing_id,
  // ... existing fields ...
  verification_status,
  connection_source,    // ← ADD THIS
  enriched_at,
  updated_at
)
```

Also update the TypeScript interface in the same file:
```typescript
interface YuhinkaiEnrichment {
  // ... existing fields ...
  verification_status: string;
  connection_source: string | null;  // ← ADD THIS
  enriched_at: string;
  updated_at: string;
}
```

### Step 2: Create Feature Flag Constant

**File:** `src/lib/constants.ts`

Add a feature flag to control auto-match display:

```typescript
// =============================================================================
// YUHINKAI ENRICHMENT
// =============================================================================

/**
 * Whether to show auto-matched Yuhinkai enrichments.
 *
 * Set to FALSE while the SOTA matcher is producing false positives.
 * Set to TRUE when the matcher is production-ready.
 */
export const SHOW_AUTO_MATCHED_ENRICHMENTS = false;
```

### Step 3: Update `hasVerifiedEnrichment` Function

**File:** `src/types/index.ts`

Modify to check `connection_source`:

```typescript
import { SHOW_AUTO_MATCHED_ENRICHMENTS } from '@/lib/constants';

export function hasVerifiedEnrichment(listing: ListingWithEnrichment): boolean {
  const enrichment = listing.yuhinkai_enrichment;
  if (!enrichment) return false;

  // Must have DEFINITIVE confidence
  if (enrichment.match_confidence !== 'DEFINITIVE') return false;

  // Check connection source
  const isManual = enrichment.connection_source === 'manual';
  const isAuto = !enrichment.connection_source || enrichment.connection_source === 'auto';

  // Only show manual connections (or auto if feature flag enabled)
  if (isAuto && !SHOW_AUTO_MATCHED_ENRICHMENTS) {
    return false;
  }

  // Manual connections must be 'confirmed', auto must be in allowed statuses
  if (isManual) {
    return enrichment.verification_status === 'confirmed';
  }

  return ['auto', 'confirmed'].includes(enrichment.verification_status);
}
```

### Step 4: Update YuhinkaiEnrichment Type

**File:** `src/types/index.ts`

Ensure `connection_source` is properly typed:

```typescript
export interface YuhinkaiEnrichment {
  // ... existing fields ...

  // Connection source (auto = SOTA matcher, manual = admin URL paste)
  connection_source?: 'auto' | 'manual' | null;

  // ... existing fields ...
}
```

### Step 5: Update Documentation

**File:** `docs/YUHINKAI_SETSUMEI_CONNECTION.md`

Add section about the feature flag and why auto-matches are hidden.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/listing/[id]/route.ts` | Add `connection_source` to query and interface |
| `src/lib/constants.ts` | Add `SHOW_AUTO_MATCHED_ENRICHMENTS` flag |
| `src/types/index.ts` | Update `hasVerifiedEnrichment` logic |
| `docs/YUHINKAI_SETSUMEI_CONNECTION.md` | Document feature flag |

---

## Testing Plan

### Manual Testing
1. **Listing 6758** (auto-matched) - Should NOT show "Catalog Data" anymore
2. **Listing 7057** (manually connected) - Should still show "Official Catalog Translation"
3. **Listing 5671** (manually connected) - Should still show setsumei

### Automated Testing
Update or add tests to verify:
- `hasVerifiedEnrichment` returns `false` for auto-matches
- `hasVerifiedEnrichment` returns `true` for manual connections
- `YuhinkaiEnrichmentSection` doesn't render for auto-matches

---

## Rollback Plan

To re-enable auto-matches when the SOTA matcher improves:

```typescript
// src/lib/constants.ts
export const SHOW_AUTO_MATCHED_ENRICHMENTS = true;
```

No other changes needed.

---

## Future Considerations

1. **Admin visibility** - Consider showing auto-matches to admins only with a warning badge
2. **Match quality score** - Use `match_score` threshold in addition to connection_source
3. **Cert type validation** - Auto-reject matches where cert_type doesn't match
4. **Gradual rollout** - Enable auto-matches per-collection (e.g., Juyo only) as confidence improves

---

## Estimated Scope

- **Changes:** 4 files
- **Risk:** Low (display logic only, no data changes)
- **Reversibility:** High (feature flag toggle)
