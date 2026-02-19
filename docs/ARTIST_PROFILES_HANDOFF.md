# Artist Profiles — Handoff Document

> Single source of truth for artisan biographies across NihontoWatch and Oshi-v2.

## Current State (2026-02-17)

### What Exists

**Database**: `artist_profiles` table in Yuhinkai Supabase (`hjhrnhtvmtbecyjzqpyr`)

| Column | Type | Purpose |
|--------|------|---------|
| `artist_code` | TEXT UNIQUE | Links to `smith_entities.smith_id` / `tosogu_makers.maker_id` |
| `artist_type` | TEXT | `'smith'` or `'tosogu_maker'` |
| `profile_md` | TEXT NOT NULL | Full markdown biography (sections delimited by `## `) |
| `hook` | TEXT | One-line pull quote / epigraph |
| `setsumei_count` | INTEGER | Number of translated setsumei used in generation |
| `extraction_json` | JSONB | Stage 1 extraction patterns (intermediate LLM output) |
| `stats_snapshot` | JSONB | Cert stats at generation time (for staleness detection) |
| `profile_depth` | TEXT | `'full'` / `'standard'` / `'brief'` |
| `human_reviewed` | BOOLEAN | Admin QA flag (default FALSE) |
| `quality_flags` | TEXT[] | Issues detected (e.g., `['too_long']`) |
| `model_version` | TEXT | LLM used (e.g., `'anthropic/claude-opus-4'`) |
| `pipeline_version` | TEXT | Generation code version (e.g., `'0.1.0'`) |
| `generated_at` | TIMESTAMPTZ | When profile was generated |

**Migration**: `oshi-v2/supabase/migrations/20260206160000_create_artist_profiles.sql`

**Data**: Only 2 profiles exist:

| Code | Smith | Setsumei | Model | Depth | Flags |
|------|-------|----------|-------|-------|-------|
| MAS590 | Masamune | 111 | claude-opus-4 | full | `too_long` |
| CHO10 | Chogi | 50 | deepseek-chat | full | `too_long` |

### What's Connected

**NihontoWatch** (`/artists/[slug]` page):
- `getArtistProfile(code)` in `src/lib/supabase/yuhinkai.ts:102` fetches from `artist_profiles`
- `profile.hook` renders as italic epigraph at `ArtistPageClient.tsx:577-580`
- `profile.profile_md` is passed through but **never rendered** — the `Biography` component (lines 143-220) is defined but never instantiated in JSX
- API route: `src/app/api/artisan/[code]/route.ts` returns `{ profile_md, hook, setsumei_count, generated_at }`

**Oshi-v2** (`/makers` page):
- **Not connected at all.** `MakerDetailView` shows Identity, Period, Ratings, Schools, Aliases, Lineage, Notes — no biography section
- `ArtisanDetailResponse` type doesn't include profile data
- `/api/artisans/[makerId]` API doesn't query `artist_profiles`

### What's Missing

1. **No generation pipeline** — No code in either repo that generates profiles. The 2 existing profiles were created via ad-hoc LLM calls.
2. **No `profile_md` rendering in NihontoWatch** — `Biography` component is dead code.
3. **No profile data in Oshi-v2** — The makers detail panel has no description section.

---

## Architecture: How to Hook It Up

### Data Flow

```
artist_profiles (Yuhinkai DB)
     │
     ├──→ NihontoWatch /artists/[slug]     (public biography)
     │    via getArtistProfile()
     │
     └──→ Oshi-v2 /makers detail panel     (internal reference)
          via /api/artisans/[makerId]
```

Both apps read from the **same table**. Profiles are written once, consumed in two places.

### Step 1: Wire Oshi-v2 Makers Page to Artist Profiles

**Goal**: When a maker is selected in `/makers`, show the profile biography in the detail panel.

Files to modify:

1. **`oshi-v2/src/components/makers/types.ts`** — Add profile to `ArtisanDetailResponse`:
   ```typescript
   export interface ArtisanDetailResponse {
     maker: MakerEntity;
     schools: SchoolMembership[];
     aliases: ArtisanAlias[];
     teachers: TeacherLink[];
     students: { maker_id: string; name_romaji: string | null; name_kanji: string }[];
     profile: {                    // NEW
       profile_md: string;
       hook: string | null;
       profile_depth: string;
       setsumei_count: number;
       generated_at: string;
     } | null;
   }
   ```

2. **`oshi-v2/src/app/api/artisans/[makerId]/route.ts`** — Query `artist_profiles` alongside existing data:
   ```typescript
   // In the GET handler, after fetching maker/schools/aliases/etc:
   const { data: profile } = await supabase
     .from('artist_profiles')
     .select('profile_md, hook, profile_depth, setsumei_count, generated_at')
     .eq('artist_code', makerId)
     .single();

   return { ...existingResponse, profile: profile || null };
   ```

   **Note**: This query goes to the **Yuhinkai** Supabase client, not the main one. The API route needs access to the Yuhinkai client. Check how NihontoWatch does it: `yuhinkaiClient` in `src/lib/supabase/yuhinkai.ts`.

3. **`oshi-v2/src/components/makers/MakerDetailView.tsx`** — Add a Biography section:
   ```typescript
   // After the Identity section, before Period:
   {detailData.profile && (
     <DetailSection title="Biography">
       <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
         {detailData.profile.profile_md}
       </div>
       <div className="mt-2 text-[10px] text-[var(--text-muted)]">
         Generated {new Date(detailData.profile.generated_at).toLocaleDateString()}
         · {detailData.profile.setsumei_count} setsumei · {detailData.profile.profile_depth}
       </div>
     </DetailSection>
   )}
   ```

### Step 2: Activate Biography in NihontoWatch

The `Biography` component already exists at `ArtistPageClient.tsx:143-220`. It needs to be instantiated in the JSX.

**Where to add it**: After the hook epigraph (line 581) and before the StatsBar (line 584), or as a dedicated section lower on the page (after certifications).

```tsx
{/* Biography — full profile markdown */}
{profile?.profile_md && (
  <section>
    <SectionHeader id="biography" title="Biography" className="mb-7" />
    <Biography markdown={profile.profile_md} hook={profile.hook} />
  </section>
)}
```

### Step 3: Build the Generation Pipeline

**Inputs needed per artisan:**
- Setsumei translations (from `gold_values` table — `setsumei_en` field)
- Cert statistics (from `smith_entities` / `tosogu_makers` — counts, elite_factor)
- School/lineage data (from `artisan_school_memberships`, `artisan_teacher_links`)
- Form/mei distributions (from `gold_values` aggregation)

**Pipeline stages:**
1. **Extract** — Gather setsumei for an artisan code, aggregate stats
2. **Synthesize** — LLM generates markdown biography with `## ` section headers + hook
3. **QA** — Detect quality flags (`too_long`, `hallucination_risk`, `low_setsumei`)
4. **Store** — Upsert into `artist_profiles`

**Profile depth heuristic:**
- `full`: >= 20 setsumei (rich source material)
- `standard`: 5-19 setsumei
- `brief`: < 5 setsumei (minimal data, shorter output)

**Where to build it**: `Oshi-scrapper/scripts/` (Python, like other batch scripts). Needs access to both Yuhinkai Supabase (read setsumei + write profiles) and optionally OpenRouter for LLM calls.

**Suggested file**: `Oshi-scrapper/scripts/generate_artist_profiles.py`

**Priority order**: Generate for artisans with the most setsumei first (highest quality). The ~100 artisans with 20+ setsumei are the best candidates.

---

## Key Design Decisions

### Profile Markdown Format

Sections use `## ` headers. The `Biography` component in NihontoWatch already parses this:

```markdown
## THE SMITH

Opening paragraph about the artisan...

Second paragraph with more detail...

## STYLISTIC DNA

Analysis of typical blade characteristics...

## COLLECTOR SIGNIFICANCE

What this artisan means for the market...
```

### Hook vs First Paragraph

The `hook` is a standalone one-liner for previews/epigraphs. It should NOT be the same as the opening paragraph of `profile_md`. The NihontoWatch `Biography` component has deduplication logic (lines 154-165) that strips the first paragraph if it matches the hook — but cleaner to just keep them separate from generation.

### What Goes Where

| Content | `hook` | `profile_md` |
|---------|--------|-------------|
| Poetic one-liner for previews | Yes | No |
| Historical biography | No | Yes |
| Stylistic analysis | No | Yes |
| Collector significance | No | Yes |
| Statistics/numbers | No | No (live data, not snapshot) |

### Stats Are Always Live

`profile_md` should reference cert statistics narratively ("nearly half of authenticated works hold elite designations") but never cite specific numbers. The `stats_snapshot` column exists for staleness detection — if live stats diverge significantly from snapshot, flag for regeneration.

Form/mei distributions on the NihontoWatch artist page are computed live from `gold_values` (not from `stats_snapshot`). This was an intentional fix after the CHO10/MAS590 bug where snapshot data was stale.

---

## Database Access

Both apps need the Yuhinkai Supabase client to read `artist_profiles`:

| App | Env Vars | Client Location |
|-----|----------|-----------------|
| NihontoWatch | `YUHINKAI_SUPABASE_URL`, `YUHINKAI_SUPABASE_KEY` | `src/lib/supabase/yuhinkai.ts` |
| Oshi-v2 | Same vars (check `.env.local`) | Needs new client or reuse existing |
| Oshi-scrapper | Same vars (in GitHub Actions secrets) | `get_yuhinkai_client()` |

The `artist_profiles` table has public read RLS and service-role full access. Reads work with anon key; writes need service role.

---

## File Reference

### NihontoWatch
| File | What |
|------|------|
| `src/lib/supabase/yuhinkai.ts:27-42` | `ArtistProfile` type definition |
| `src/lib/supabase/yuhinkai.ts:102-115` | `getArtistProfile()` fetch function |
| `src/app/artists/[slug]/page.tsx:57` | Server-side profile fetch call |
| `src/app/artists/[slug]/page.tsx:142-148` | Profile data passed to client |
| `src/app/artists/[slug]/ArtistPageClient.tsx:143-220` | `Biography` component (DEAD CODE — not rendered) |
| `src/app/artists/[slug]/ArtistPageClient.tsx:577-580` | `profile.hook` rendered as epigraph |
| `src/app/api/artisan/[code]/route.ts:251,313-318` | API: profile fetch + response shape |

### Oshi-v2
| File | What |
|------|------|
| `supabase/migrations/20260206160000_create_artist_profiles.sql` | Table schema |
| `src/app/makers/page.tsx` | Makers page (parent) |
| `src/components/makers/MakerDetailPanel.tsx` | Detail panel wrapper (edit mode, history) |
| `src/components/makers/MakerDetailView.tsx` | Detail view (Identity, Period, Ratings, etc.) — **add biography here** |
| `src/components/makers/types.ts:80-88` | `ArtisanDetailResponse` — **add profile field** |
| `src/app/api/artisans/[makerId]/route.ts` | API — **add artist_profiles query** |
