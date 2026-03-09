# Showcase QuickView — Museum-Grade Listing Experience

> **Status**: Brainstorm / Design Phase
> **Date**: 2026-03-08
> **Related**: QuickView.tsx, DisplayItem, Dealer Portal, AI Artist Descriptions

---

## Problem Statement

The current QuickView is one-size-fits-all. A scraped listing with 3 blurry photos and a title gets the same visual treatment as a dealer-curated listing with 15+ professional photos, provenance chain, sayagaki by Tanobe-sensei, koshirae component attributions, kiwame records, and full NBTHK setsumei documentation.

Dealer-exclusive listings carry dramatically richer data, but the QuickView presents it as a long vertical scroll of collapsed sections — it feels like metadata dumping, not curation. The data richness should dictate the presentation richness.

## Vision

When a listing crosses a richness threshold, it upgrades from the standard split-pane QuickView into a **full-viewport immersive experience** — a museum exhibit for a single sword. Dark, atmospheric, scholarly. Each data section is a "chapter" in the sword's story, with generous whitespace, interleaved images, and narrative flow.

The centerpiece is an **AI-generated Curator's Note** — a scholarly synthesis that weaves together setsumei, sayagaki, artist biography, provenance, and designation statistics into contextual narrative that doesn't exist anywhere else.

---

## Structural Thesis — "Same Book, Different Subject"

### Relationship to the Artist Page

The artist page (`/artists/[slug]`) is the design precedent. It reads like a scholarly exhibition catalog — each section is a chapter that unfolds with a consistent typographic rhythm: gold rule divider → small-caps section title → generous prose measure (~780px) → `space-y-16` breathing between chapters. It never feels like a web page. It feels like a book.

**The Showcase is the same book — but for a single sword instead of a single smith.** The artist page tells the story of a career. The Showcase tells the story of an object.

### Always-Dark Atmosphere

The critical structural departure: the artist page sits on warm cream/ivory (light mode). The Showcase is **always-dark** — forced dark background regardless of system preference. The same typographic DNA (gold dividers, small-caps headers, serif display type, metadata grids) but on charcoal/near-black. This signals "you've entered the vault" — a museum gallery at night. The warm ivory of the document text cards (setsumei, sayagaki) creates islands of light in the darkness, like papers under glass.

### Inherited Design Patterns

Every reusable pattern from the artist page carries over:

| Artist Page Pattern | Showcase Equivalent |
|---|---|
| Gold rule divider (40px, `bg-gold/50`) | Same, on dark background |
| Small-caps section headers (`text-xs uppercase tracking-[0.18em]`) | Same, `text-sc-accent-gold` |
| Metadata grid (2-col label:value) | Identity Card measurements |
| `max-w-[780px]` prose measure | Curator's Note + documentation text |
| `space-y-16` macro rhythm | Same section spacing |
| Serif display font (`font-serif font-light`) | Hero attribution, section titles |
| Opacity-based text hierarchy (`text-ink/60`, `text-ink/40`) | `text-sc-text-secondary`, `text-sc-text-secondary/60` |
| PrestigePyramid / EliteFactorDisplay | N/A (link to artist page instead) |
| Lineage timeline (vertical dots on left rule) | Provenance timeline (same component pattern) |
| CatalogueShowcase (cover image + photo grid) | Koshirae section (full image + component cards) |
| Biography prose (`prose-biography` styling) | Curator's Note (same prose styling, dark variant) |
| SectionJumpNav (sticky, IntersectionObserver) | Same pattern: `Overview · Scholar's Note · Documentation · Provenance · Mountings · Gallery` |
| ListingCard grid (ArtisanListings) | Image masonry gallery |
| Footer endpiece (centered thin rule) | Same, after dealer/price section |

### The Section Jump Nav

The artist page has `SectionJumpNav` — a sticky bar (desktop) or left sidebar (lg+) with clickable section anchors: *Overview, Designations, Provenance, Blade Forms, Signatures, Lineage, School*. IntersectionObserver tracks the active section and highlights it with `border-b border-gold/60`.

The Showcase uses the same component pattern:

```
Overview · Scholar's Note · Documentation · Provenance · Mountings · Gallery
```

Desktop: sticky top bar or left sidebar (dark variant). Mobile: hidden — the page is linear enough that scroll IS the navigation.

### Structural Mapping — Artist Page → Showcase

| # | Artist Page Section | Showcase Section | Structural Relationship |
|---|---|---|---|
| 1 | **Hero** (image + name + metadata grid) | **Hero** (full-bleed image/video + attribution) | Same position, inverted hierarchy: Showcase leads with image dominance, artist page leads with text |
| 2 | **Metadata grid** (province, era, school, teacher, rankings) | **Identity Card** (type, measurements, mei, cert, era, school) | Same 2-col label:value pattern in a bordered card |
| 3 | **Biography** (prose markdown, scholarly voice) | **Curator's Note** (AI-generated prose, scholarly voice) | Same prose styling, same structural position, different source |
| 4 | **Published Works / CatalogueShowcase** (cover image + photo grid + provenance docs) | **Documentation** (setsumei image + text, sayagaki image + text, hakogaki) | Same two-column document-alongside-text pattern |
| 5 | **Certifications** (PrestigePyramid + EliteFactorDisplay) | *Omitted* — link to artist page instead | The Showcase references designation stats IN the Curator's Note text rather than visualizing them |
| 6 | **Provenance** (ProvenancePyramid + ProvenanceFactorDisplay) | **Provenance Timeline** (chronological dots on rule line) | Artist page shows aggregate provenance across all works; Showcase shows THIS sword's specific ownership chain |
| 7 | **Blade Forms / Signatures** (distribution bars) | *Omitted* — single sword, not a corpus | N/A |
| 8 | — | **Koshirae** (component cards with maker attributions) | Borrows from CatalogueShowcase: full image + card grid |
| 9 | — | **Video** (cinematic HLS playback) | New — no artist page equivalent |
| 10 | **Available Listings** (ListingCard grid) | **Image Gallery** (masonry grid of all photos) | Same "grounding in visual content" structural function |
| 11 | **Lineage** (vertical timeline: teacher → artisan → students) | **Provenance Timeline** (vertical timeline: forged → owners → current dealer) | Same component pattern, different data domain |
| 12 | **Related Artisans** (school context cards) | **Related Items** (same artisan or dealer, via existing `RelatedListingsServer`) | Same "see more" exit ramp |
| 13 | **Footer endpiece** (centered thin rule) | **Footer endpiece** (same) | Identical |

### Cross-Reference Web

The Showcase and Artist page create a **bidirectional link web**:

- **Showcase → Artist**: The artisan's name in the Identity Card links to `/artists/[slug]`. The Curator's Note references the smith's career statistics with inline links. Koshirae component makers link to their respective artist pages.
- **Artist → Showcase**: The ArtisanListings grid on the artist page shows available items. Cards for Showcase-eligible listings could show a subtle visual indicator (a gold corner mark or "Exhibit" badge), signaling the richer experience available.
- **Curator's Note as bridge**: "Among Sadamune's 47 designated works, only 12 hold Tokubetsu Juyo status" — this statement references Yuhinkai data that ALSO appears on the artist page's PrestigePyramid. The collector can verify the claim by clicking through. Trust through cross-referenceability.

### What Makes This Structure Spectacular

**1. Document-as-artifact**: Setsumei and sayagaki aren't rendered as body text. They're presented as physical documents under glass — the image of the actual paper alongside the translation. The parchment-colored text card creates a warm island in the dark gallery. You're not reading data; you're studying a document. This is what Christie's does in lot descriptions, but they can't show the actual NBTHK papers inline.

**2. The Curator's Note as reading moment**: No other platform generates per-object scholarly narrative that synthesizes the NBTHK's own words, Tanobe's calligraphy, the artisan's career statistics, and the provenance chain. It's the thing that makes someone stop scrolling and *read*. Because it's prose (not a grid, not a card, not a badge), it creates a reading moment in a medium usually about scanning.

**3. Cross-references as trust**: Every factual claim in the Curator's Note can be verified by clicking through to the data source (artist page, NBTHK setsumei text, sayagaki image). The Showcase doesn't just present information — it presents **verifiable scholarship**. That's what separates it from marketing copy.

**4. Video as presence**: A 30-second video of a blade being slowly rotated under raking light communicates the jihada and hamon in ways no static photo can. The auto-playing muted hero video creates the feeling of standing in front of the actual sword. It's not a product video — it's a presence.

---

## The Emotional Arc

The experience mirrors the traditional Japanese sword viewing ritual (鑑賞 — kanshō):

### Phase 1: First Impression (一目 — hitome)

The blade speaks first. You see the sword before you know anything about it.

**Design:**
- Single full-bleed hero image on dark charcoal backdrop
- Minimal chrome — only close button and cert badge (floating, like a museum placard)
- Desktop: image fills ~80% viewport. Below it, just the attribution in elegant serif typography: "Sadamune" or "伝 貞宗"
- Mobile: full-screen image. Scroll down to begin the journey
- No price. No dealer. No metadata grid. Just the sword.

**Signal:** *This sword deserves your attention. Slow down.*

### Phase 2: The Identity Card (背景 — haikei)

Who made it. When. Where. The credentials.

**Design:**
- Compact, beautifully typeset placard on linen/cream background
- Museum label aesthetic — structured, minimal, dignified:

```
KATANA
─────
Attributed to Sagami no Kuni Sadamune
相模国 貞宗

Sōshū School · Nanbokuchō Period
Tokubetsu Jūyō Tōken · Session 26

Nagasa 70.2 cm · Sori 1.8 cm
Motohaba 3.12 cm · Kasane 0.68 cm
```

- Cert badge gets real estate — not a tiny pill but a proper designation display with session number
- Measurements could optionally render as a subtle blade silhouette SVG with dimension lines (technical drawing aesthetic)

### Phase 3: Curator's Note (学術解説)

**The centerpiece.** AI-generated scholarly narrative that synthesizes all available data sources into contextual commentary. See [Curator's Note](#curators-note---ai-scholarly-synthesis) section below.

### Phase 4: The Documentation (文書)

Setsumei, sayagaki, and hakogaki presented as **primary artifacts**, not metadata footnotes.

**Design:**
- **Setsumei**: Document image alongside transcription/translation. Side-by-side on desktop (image left, text right). On mobile, document image with text below. "Study" toggle reveals bilingual JA+EN.
- **Sayagaki**: Calligraphy image presented prominently — it's art, not data. Tanobe-sensei's handwriting is a primary artifact. Transcription/translation alongside.
- **Hakogaki**: Same treatment as sayagaki for box inscriptions.

**Key insight:** These documents ARE the story. In the current QuickView they're collapsed sections that feel like footnotes. In the Showcase, they're featured chapters.

### Phase 5: The Journey (伝来 — denrai)

Provenance and expert appraisals presented as a visual timeline.

**Design:**
```
1356          1603          1868         1952         2024
 ·─────────────·─────────────·────────────·────────────·
 Forged        Tokugawa      Meiji        NBTHK        Current
 Sōshū         Collection    Imperial     Jūyō         Dealer
                              Gift         Designation
```

- Each node expands to show owner details + provenance images (collector seals, authentication stamps, photographs)
- Mobile: vertical timeline (natural scroll direction)
- **Kiwame records integrate into the timeline** — "1780: Hon'ami Kōson — Origami attribution to Sadamune" is a historical event in the sword's biography
- Provenance images get proper treatment — viewable documents, not thumbnail strips

### Phase 6: The Mountings (拵 — koshirae)

If the sword comes with koshirae, a dedicated section with component breakdown.

**Design:**
- Full koshirae photo at top
- Below: component cards in a horizontal-scroll strip (mobile) or grid (desktop)
- Each component (tsuba, fuchi-kashira, menuki, kozuka, kogai) gets its own card:

```
┌──────────┐  ┌──────────────┐  ┌──────────┐
│  TSUBA   │  │ FUCHI-KASHIRA│  │  MENUKI  │
│  [photo] │  │   [photo]    │  │  [photo] │
│ Gotō     │  │  Ishiguro    │  │ Hamano   │
│ Ichijō   │  │  Masayoshi   │  │ Shōzui   │
└──────────┘  └──────────────┘  └──────────┘
```

- Each component card links to that maker's artist page
- Koshirae cert info displayed if separate papers exist

### Phase 7: The Offer (取引)

The commercial reality that enables collecting.

**Design:**
- Price displayed prominently
- Dealer identity with logo/brand (from dealer profile system)
- Contact options, "Inquire" CTA
- Desktop: sticky slim bar at bottom (always accessible while scrolling)
- Mobile: comes at end of scroll, with sticky CTA footer

---

## Curator's Note — AI Scholarly Synthesis

### Concept

A 2-3 paragraph scholarly narrative that contextualizes this specific sword within its maker's body of work, its historical moment, and its authentication journey. Think of the wall text at a Met exhibition — written by a specialist curator who knows the full oeuvre, the historical period, and the provenance significance.

### Example Output

For a Tokubetsu Juyo katana attributed to Sadamune:

> *This katana represents a particularly fine expression of the Sōshū tradition at its zenith. Attributed to Sadamune — Masamune's most accomplished pupil and one of only three smiths in the lineage to achieve a designation factor above 1.5 — the blade exhibits the wide mihaba and shallow sori characteristic of the Nanbokuchō period, when the Sōshū school's influence had reached its full maturity.*
>
> *The NBTHK's Tokubetsu Jūyō designation at the 26th session recognizes the blade's exceptional nie-deki and the complexity of its midare hamon, which the setsumei describes as displaying "a magnificent variation of gunome and chōji mixed with kinsuji and sunagashi throughout." Among Sadamune's 47 designated works, only 12 hold Tokubetsu Jūyō status, placing this blade within the upper echelon of his authenticated corpus.*
>
> *Tanobe Michihiro's sayagaki confirms the attribution and notes the exceptional state of preservation of the jihada, characterizing it as "displaying the hallmark Sōshū-den combination of itame mixed with mokume, richly active with ji-nie." The blade's journey through the Matsudaira and Ikeda collections — two of the most distinguished provenance lines in nihontō collecting — further attests to its historical significance.*

### What Makes This Unique (The Data Moat)

The Curator's Note synthesizes **six data sources** that no competitor has in one place:

1. **Corpus positioning** — "Among Sadamune's 47 designated works, only 12 hold Tokubetsu Jūyō status"
   - Only possible because we have full designation counts from `artisan_makers` (Yuhinkai)

2. **Setsumei interpretation** — Quoting and contextualizing the NBTHK's own language
   - We have OCR'd Japanese and translated English setsumei text

3. **Sayagaki cross-reference** — Connecting Tanobe's calligraphic notes to NBTHK findings
   - When sayagaki and setsumei describe the same features, that convergence has scholarly value

4. **Provenance significance** — Contextualizing ownership history
   - Historical collection names carry meaning that the AI can surface

5. **Artist biography integration** — Placing this sword within the maker's career arc
   - AI artist descriptions (already generated for top artisans) + era/measurements = career positioning

6. **Comparative rarity** — Designation statistics framing the object's significance
   - "One of only 3 Tokubetsu Jūyō works by this smith" — only we can make this statement

### Input Assembly

For each listing, the prompt assembles a structured context package:

```
SWORD DATA:
- Type, measurements (nagasa, sori, motohaba, sakihaba, kasane), mei type
- Era, province, school
- Cert type + session number

ARTIST DATA (from Yuhinkai artisan_makers):
- Full name (romaji + kanji), school, era, province
- Designation factor (e.g., 1.52)
- Work counts: {juyo: 35, tokuju: 12, jubi: 0, jubun: 0, gyobutsu: 0, kokuho: 0}
- AI biography (if exists)
- Teacher-student lineage
- School ancestry

SETSUMEI (if exists):
- Japanese OCR text (setsumei_text_ja)
- English translation (setsumei_text_en, markdown)

SAYAGAKI (if exists):
- Author (e.g., Tanobe Michihiro)
- Content text

HAKOGAKI (if exists):
- Author, content

KIWAME (if exists):
- Judge name, type (origami/kinzogan/saya-mei), notes

PROVENANCE (if exists):
- Owner chain with dates/notes

KOSHIRAE (if exists):
- Component attributions with maker names/codes
- Separate certification info
```

### Generation Rules

- **NBTHK scholarly voice** — formal, precise, never casual or promotional
- **Quote, don't rephrase** — When citing setsumei or sayagaki, use the actual text. The NBTHK's words carry authority; paraphrasing dilutes them
- **Counts are live** — Unlike static AI artist descriptions, the Curator's Note can cite specific designation counts because they're computed per-request from live Yuhinkai data
- **Never fabricate** — If we don't have sayagaki data, don't mention sayagaki. If we don't have provenance, don't discuss provenance. Only discuss data sources that are actually provided
- **No price commentary** — Never reference the listing price, value, or "investment" language
- **Bilingual** — Generate EN and JA versions. JA uses proper nihonto terminology in kanji (銘, 無銘, 長さ, 反り, 地鉄, 刃文)
- **2-3 paragraphs, 200-400 words** — Scholarly but not exhausting. Every sentence earns its place
- **No generic filler** — If data is sparse, the note is shorter. A 1-paragraph note for a Hozon wakizashi with just artist data is better than padding with generalities

### Generation Pipeline

**Primary: Batch pre-generation (cron)**
- Cron job generates Curator's Notes for qualifying listings that don't have one
- Similar to existing AI artist description pipeline
- Model: via OpenRouter (same as translate API)
- Store in new columns: `ai_curator_note_en`, `ai_curator_note_ja`, `ai_curator_note_generated_at`
- Invalidation: NULL the note when any source data changes (setsumei updated, provenance added, artisan reassigned, cert changed)

**Fallback: On-demand generation**
- If user opens Showcase for a qualifying listing without a cached note, generate on-the-fly
- Show a subtle loading state ("Preparing curator's note...")
- Cache result for subsequent views

### Competitive Advantage

- **Dealers can't do this** — They don't have Yuhinkai corpus data to contextualize within a smith's full body of work
- **NMB can't do this** — No structured setsumei, sayagaki, or provenance in machine-readable form
- **Auction houses do this manually** — Christie's employs specialists for catalog essays. We do it at scale, with richer data inputs, instantly
- **Other aggregators can't do this** — They don't have the data pipeline (scraper + Yuhinkai + NBTHK setsumei + dealer-entered rich data)

This becomes a reason collectors visit NihontoWatch *instead of* the dealer's own website — the dealer has the listing, but NihontoWatch has the *context*.

---

## Visual Language

### Color & Atmosphere
- **Dark mode backbone** — Charcoal (#1a1a1a) or deep navy, warm accents
- **Gold** for cert designations and accent elements
- **Cream/linen** for text card backgrounds (identity card, curator's note)
- Opposite of the bright browse grid — signals "you've entered a different space"

### Typography
- **Serif for headings** — scholarly, editorial feel (Cormorant Garamond for EN, Noto Serif JP for JA)
- **Sans-serif for body** — clean readability
- Contrast with the rest of the site signals premium context

### Whitespace
- Generous. Museums use negative space to focus attention
- Each section breathes. No cramming. Content-to-chrome ratio heavily favors content

### Transitions
- Subtle fade-ins as sections scroll into view (IntersectionObserver + opacity/translate)
- Not flashy animation — gentle reveals that control pace
- Images: slight parallax or scale-up on enter (optional, must not feel gimmicky)

### Image Treatment
- Dark vignette around edges of hero images
- No harsh borders — images float on the dark background
- Document images (setsumei, sayagaki) get a subtle paper-texture background treatment

---

## Activation Criteria

Not every listing gets this. The Showcase activates when a listing meets a **richness threshold**:

### Automatic Activation
- **Minimum 5 images** (serious photography), AND
- **At least 2 of:** provenance entries, sayagaki, hakogaki, koshirae with attributions, kiwame, setsumei text

### Manual Override
- Dealer toggle in listing form: "Feature as Showcase" (explicit opt-in)
- Admin toggle: force Showcase on/off for any listing

### Natural Restriction
- Scraped listings never qualify (they don't have provenance/sayagaki/kiwame data)
- This makes it de facto dealer-exclusive without hard-coding the restriction
- Creates organic incentive for dealers to add rich data — they want their listings to qualify

---

## Layout Architecture

### Desktop (lg+)

Full-viewport overlay (replaces the split-pane QuickView entirely):

```
┌─────────────────────────────────────────────────┐
│ [×]                                    [Share]  │ <- Minimal chrome bar
├─────────────────────────────────────────────────┤
│                                                 │
│              [HERO IMAGE - full bleed]          │ <- Phase 1: ~80vh
│                                                 │
│              Sadamune · 貞宗                     │
│              Tokubetsu Jūyō Tōken               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    ┌─────────────────────────────────────┐      │
│    │        IDENTITY CARD                │      │ <- Phase 2
│    │   Katana · Sōshū · Nanbokuchō      │      │
│    │   Nagasa 70.2 · Sori 1.8 cm        │      │
│    └─────────────────────────────────────┘      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    CURATOR'S NOTE                               │ <- Phase 3
│    ──────────────                               │
│    "This katana represents a particularly       │
│    fine expression of the Sōshū tradition..."   │
│    [2-3 paragraphs]                             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    ┌──────────────┐  ┌──────────────────┐       │
│    │ [setsumei    │  │ NBTHK setsumei   │       │ <- Phase 4: Documentation
│    │  document    │  │ translation text  │       │
│    │  image]      │  │ with "Study"     │       │
│    │              │  │ toggle for JA    │       │
│    └──────────────┘  └──────────────────┘       │
│                                                 │
│    ┌──────────────┐  ┌──────────────────┐       │
│    │ [sayagaki    │  │ Tanobe Michihiro  │       │
│    │  calligraphy │  │ transcription +   │       │
│    │  image]      │  │ translation       │       │
│    └──────────────┘  └──────────────────┘       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    PROVENANCE                                   │ <- Phase 5: Journey
│    ·────·────·────·────·                        │
│    1356  1603 1868 1952 2024                    │
│    [expandable nodes with images]               │
│                                                 │
│    EXPERT APPRAISALS                            │
│    [kiwame entries integrated into timeline]    │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    KOSHIRAE                                     │ <- Phase 6: Mountings
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│    │tsub│ │f-k │ │menu│ │kozu│                  │
│    │[im]│ │[im]│ │[im]│ │[im]│                  │
│    │Gotō│ │Ishi│ │Hama│ │Goto│                  │
│    └────┘ └────┘ └────┘ └────┘                 │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    FULL IMAGE GALLERY                           │ <- All photos in grid/masonry
│    [2-3 column grid of all listing images]      │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Dealer Logo] Dealer Name    ¥X,XXX,XXX  [Inquire] │ <- Sticky footer
└─────────────────────────────────────────────────┘
```

### Mobile

Full-screen vertical scroll (replaces bottom sheet entirely):

```
┌──────────────────────┐
│ [←]            [Share]│ <- Slim top bar
├──────────────────────┤
│                      │
│  [HERO IMAGE - full] │ <- Full width, ~60vh
│                      │
│  Sadamune · 貞宗     │
│  Tokubetsu Jūyō     │
│                      │
├──────────────────────┤
│  IDENTITY CARD       │ <- Compact, full-width
│  Katana · Sōshū     │
│  70.2 cm · 1.8 cm   │
├──────────────────────┤
│                      │
│  CURATOR'S NOTE      │
│  "This katana..."    │
│  [2-3 paragraphs]   │
│                      │
├──────────────────────┤
│  [setsumei image]    │ <- Full-width document
│  [translation text]  │
│  [sayagaki image]    │
│  [transcription]     │
├──────────────────────┤
│  PROVENANCE          │ <- Vertical timeline
│  │ 1356 Forged       │
│  │ 1603 Tokugawa     │
│  │ 1868 Imperial     │
│  │ 1952 NBTHK Jūyō  │
│  │ 2024 Current      │
├──────────────────────┤
│  KOSHIRAE            │
│  [horizontal scroll  │ <- Swipeable component cards
│   component cards]   │
├──────────────────────┤
│  ALL IMAGES          │ <- 2-col grid, tap to zoom
│  [photo grid]        │
├──────────────────────┤
│                      │
│  ¥X,XXX,XXX         │ <- Price + dealer section
│  Dealer Name         │
│                      │
├──────────────────────┤
│ [    Inquire     ]   │ <- Sticky CTA footer
└──────────────────────┘
```

---

## Exit Ramps

### Back to Browsing
- Close button (×) returns to browse grid, preserving scroll position
- Browser back button works (pushState entry when Showcase opens)

### Compact Summary Toggle
- "Quick summary" toggle collapses everything into a dense overview card (essentially the current QuickView layout)
- For experienced collectors who know what they're looking at and just want the facts
- Respects both the scholar who wants depth and the expert who wants efficiency

### Standard QuickView Fallback
- Listings below the richness threshold continue to use the current split-pane QuickView
- No degradation to existing experience

---

## Dealer Incentive Loop

The Showcase creates a natural flywheel:

1. **Dealer adds rich data** (provenance, sayagaki, koshirae attributions, professional photos)
2. **Listing qualifies for Showcase** — museum-grade presentation
3. **Collectors engage more deeply** — longer dwell time, higher inquiry rate
4. **Dealer sees better analytics** — views, favorites, click-through all increase
5. **Dealer adds more rich data to more listings**

This is more powerful than a completeness score badge. The reward isn't a number — it's a fundamentally better presentation of their inventory.

---

## URL Strategy — Deep Analysis

### Current Architecture

Understanding the existing URL landscape is critical:

| Surface | Route | SSR? | SEO? | Shareable? | Modal? |
|---------|-------|------|------|------------|--------|
| Browse grid | `/?type=katana&sort=...` | Partial | Yes (category pages) | Yes | No |
| QuickView (from grid) | No URL change | No | No | No | Yes (ephemeral) |
| QuickView (deep link) | `/?listing=123` | No (API fetch) | No | Yes (but no SSR) | Yes |
| Listing detail | `/listing/123` | Yes (ISR 300s) | Full (JSON-LD, OG) | Yes | No |
| Dealer inventory | `/dealer?tab=available` | No | No (auth-gated) | No | No |

**Key insight**: QuickView is ephemeral — click a card, the URL doesn't change. Refresh the page, the QuickView is gone. The listing detail page (`/listing/[id]`) is the canonical, crawlable, shareable surface. It has full SSR, JSON-LD Product schema, OG tags, and ISR caching.

### The Four Options

#### Option A: Pure Overlay (Like Current QuickView)

Showcase is a full-viewport modal overlay on the browse page. No URL change, or a query param like `?listing=123&view=showcase`.

```
User clicks card on browse grid
  → Showcase overlay opens (full viewport, dark, immersive)
  → URL: unchanged (or /?listing=123)
  → User refreshes: Showcase gone, back to grid
  → User shares link: Gets browse page (or deep link that re-opens Showcase)
```

**Pros:**
- Fast entry/exit — no page navigation, stays in browse context
- Carousel navigation (prev/next) between Showcase-eligible items
- Minimal architecture change — extends QuickView pattern
- Instant open (data already fetched for browse grid, just need supplementary data)

**Cons:**
- Not crawlable — Googlebot never sees the Showcase content (huge SEO miss)
- Not shareable in a meaningful way — shared URL opens browse page, not the exhibit
- Curator's Note invisible to search engines
- Lost on refresh — ephemeral, like current QuickView
- No OG tags — social sharing card shows the browse page, not the sword

**Verdict:** Defeats the purpose. The Showcase's rich content (Curator's Note, documentation, provenance) is exactly what should be indexed and shared. Hiding it behind a modal wastes the SEO opportunity.

#### Option B: Dedicated New Route (`/showcase/[id]`)

New page route specifically for the Showcase experience. Separate from the existing listing detail page.

```
/listing/123       → Standard detail page (current layout)
/showcase/123      → Museum-grade Showcase experience
```

**Pros:**
- Clean separation — two layouts, two routes, no conditional logic
- Can SSR the Showcase independently
- Shareable URL specifically for the premium experience
- Could have distinct OG tags/social cards (dark, dramatic preview image)

**Cons:**
- **Two canonical URLs for the same listing** — SEO nightmare. Which does Google rank? `rel=canonical` from `/showcase/123` → `/listing/123` solves ranking but means Google shows the standard page, not the Showcase. The reverse means non-Showcase listings have no canonical page.
- **Link rot risk** — if a listing loses Showcase eligibility, `/showcase/123` needs to handle gracefully (redirect? 404? downgrade?)
- **Dealer confusion** — "Which URL do I share?" Two URLs for one product is a UX smell
- **Maintenance burden** — Two separate SSR data fetching paths, two `generateMetadata()` functions, two JSON-LD generators
- **Navigation ambiguity** — Does QuickView link to `/listing/123` or `/showcase/123`? Does the browse CTA change per listing?

**Verdict:** Conceptually clean but practically messy. Two URLs for one listing creates confusion at every level (SEO, sharing, navigation, maintenance).

#### Option C: Adaptive Detail Page — `/listing/[id]` Upgrades (Recommended)

The existing listing detail page dynamically renders as Showcase when the listing qualifies. One URL, two presentation modes.

```
/listing/123  → Sparse listing   → Standard detail layout
/listing/456  → Rich listing     → Showcase museum layout
```

**Pros:**
- **One canonical URL** — no SEO confusion. `/listing/[id]` is always the answer
- **Full SSR** — Curator's Note, provenance timeline, documentation all server-rendered. Googlebot sees everything
- **Natural sharing** — Share `/listing/456`, recipient gets the museum experience. No special URL to remember
- **OG tags adapt** — `generateMetadata()` can produce richer OG descriptions for Showcase listings (include Curator's Note snippet, dramatic OG image)
- **ISR caching works** — Same revalidation pattern, just rendering different layouts
- **Graceful degradation** — If listing loses eligibility, page renders standard layout. No 404, no redirect, no broken links
- **Single data fetching path** — `getListingDetail()` already fetches everything. Showcase just renders more of it
- **Dealer clarity** — "Share your listing page" always works

**Cons:**
- Two very different layouts in one route — conditional rendering complexity
- The standard detail page may need design work to not feel "lesser" next to Showcase
- No carousel navigation (it's a full page, not a modal) — you leave the browse context

**The carousel problem is real but solvable** (see Hybrid approach below).

#### Option D: Hybrid — Adaptive Page + QuickView Enhancement

Combines Option C (adaptive detail page) with a browse-context enhancement:

```
From browse grid:
  1. Click Showcase-eligible listing card
  2. QuickView opens as normal (current split-pane/bottom sheet)
  3. QuickView shows enhanced CTA: "View Exhibit →" (instead of "View full details")
  4. CTA navigates to /listing/456 which renders as Showcase

From direct URL / shared link:
  1. /listing/456 renders as Showcase (full SSR)

From email alert deep link:
  1. /?listing=456 opens QuickView (current behavior)
  2. "View Exhibit →" CTA available
```

**Pros:**
- Everything from Option C, plus...
- **Preserves browse flow** — QuickView still works for quick scanning. Showcase is a deliberate "go deeper" action
- **The QuickView becomes a preview** — it teases the Showcase, creating a pull toward the full experience
- **Carousel still works** — prev/next in QuickView for quick browsing, then "dive in" to Showcase when one catches your eye
- **Two UX modes respected** — quick browsing (QuickView) vs. deep study (Showcase page). Different goals, different containers
- **Progressive enhancement** — QuickView could show a visual hint that Showcase exists (subtle icon, different border treatment, "Exhibit available" badge)

**Cons:**
- QuickView and Showcase page need to feel connected (shared visual language) even though they're architecturally different
- User navigates away from browse to view Showcase — back button returns to grid, but they lose their scroll position unless we preserve it (already handled by existing router patterns)

### Recommendation: Option D (Hybrid)

**The Showcase lives at `/listing/[id]`** — it's the adaptive version of the existing detail page. The QuickView remains the quick-browse surface but gains awareness of Showcase eligibility.

### How It Works — User Journey

```
BROWSE GRID
    │
    ├── Click standard listing card
    │       → Standard QuickView (split-pane / bottom sheet)
    │       → CTA: "View full details" → /listing/123 (standard layout)
    │
    ├── Click Showcase-eligible listing card
    │       → Standard QuickView (same shell — familiar, fast)
    │       → Visual hint: ✦ Showcase badge on hero, subtle dark accent
    │       → CTA: "View Exhibit →" → /listing/456 (Showcase layout)
    │       → QuickView shows enough to hook interest, Showcase delivers the full story
    │
    └── Deep link from email: /?listing=456
            → QuickView opens (familiar behavior)
            → "View Exhibit →" CTA if eligible
```

### The QuickView as "Trailer"

This is the key conceptual shift. For Showcase-eligible listings, the QuickView becomes a **trailer for the exhibit** rather than a complete summary:

- Shows the best image, price, cert, attribution (same as today)
- Shows a Showcase badge or visual treatment signaling "there's more"
- Rich content sections (provenance, sayagaki, koshirae) are **hinted but not fully expanded** — "Provenance: 3 documented owners" as a teaser line rather than the full timeline
- The CTA shifts from "View full details" to something like "View Exhibit" or "Explore" — language that signals a richer destination
- The detail page then delivers the full immersive experience

This creates a **pull** rather than a push. The collector sees enough to be intrigued, then chooses to go deeper. That's more powerful than forcing everyone into a full-screen experience they didn't ask for.

### SEO Architecture for Showcase Pages

The adaptive `/listing/[id]` gets enhanced SEO when Showcase-eligible:

**Standard listing (`/listing/123`):**
```html
<title>Unsigned Wakizashi, Hozon | NihontoWatch</title>
<meta name="description" content="Hozon certified wakizashi. ¥180,000 at Aoi Art." />
<meta property="og:image" content="/api/og?id=123" />
```

**Showcase listing (`/listing/456`):**
```html
<title>Sadamune — Tokubetsu Jūyō Katana | NihontoWatch</title>
<meta name="description" content="This katana represents a fine expression of the
  Sōshū tradition. Among Sadamune's 47 designated works, only 12 hold Tokubetsu Jūyō
  status. Provenance: Matsudaira, Ikeda collections." />
<meta property="og:image" content="/api/og?id=456&showcase=1" />
<!-- Curator's Note snippet in description, dramatic OG image variant -->
```

**JSON-LD enhancements:**
- Standard Product schema (same as today)
- Add `description` field with Curator's Note excerpt
- Add `provenance` as `itemCondition` or custom properties
- `review` property for sayagaki/kiwame expert citations

**Structured data for Curator's Note:**
```json
{
  "@type": "ScholarlyArticle",
  "name": "Curator's Note: Sadamune Tokubetsu Jūyō Katana",
  "author": { "@type": "Organization", "name": "NihontoWatch" },
  "about": { "@type": "Product", "@id": "/listing/456" },
  "text": "This katana represents a particularly fine expression..."
}
```

This means Google can potentially show the Curator's Note as a rich snippet — "NihontoWatch: This katana represents a particularly fine expression of the Sōshū tradition..." That's a click magnet.

### Social Sharing Cards

Showcase listings get a distinct OG image treatment:

- **Standard listings**: Current OG image (listing photo with basic overlay)
- **Showcase listings**: Dark-background cinematic treatment — hero image with vignette, cert badge, attribution text overlay. Feels premium in a Twitter/LINE feed. Generated by an enhanced `/api/og?id=456&showcase=1` variant

### URL Behavior — Edge Cases

| Scenario | Behavior |
|----------|----------|
| Listing qualifies for Showcase | `/listing/456` renders Showcase layout |
| Listing loses eligibility (dealer removes data) | `/listing/456` renders standard layout. No redirect, no 404. Graceful downgrade |
| Dealer toggle: "Feature as Showcase" OFF | `/listing/456` renders standard even if data qualifies |
| Admin toggle: force Showcase | `/listing/456` renders Showcase regardless of richness score |
| ISR revalidation | Page regenerates with current data. Showcase eligibility re-evaluated each time |
| Sold listing with Showcase data | Showcase still renders (with "Sold" overlay). Archive value — the content is still scholarly |
| QuickView deep link `/?listing=456` | QuickView opens (not Showcase page). CTA links to `/listing/456` Showcase |

### Navigation & History

```
Browse grid ──card click──→ QuickView (no URL change)
                               │
                     "View Exhibit →"
                               │
                               ▼
                     /listing/456 (Showcase)
                               │
                        Back button
                               │
                               ▼
                     Browse grid (scroll position preserved)
```

- QuickView open: no history entry (current behavior, unchanged)
- Navigate to Showcase: `router.push('/listing/456')` — one history entry
- Back button: returns to browse grid with scroll position preserved (existing behavior via `window.history`)
- Closing Showcase: no special handling needed — it's a normal page, back button works

### Implementation Implications

This decision simplifies the architecture significantly:

1. **No new routes** — enhance existing `/listing/[id]` page
2. **`ListingDetailClient.tsx`** gains a conditional layout branch: `isShowcaseEligible(listing) ? <ShowcaseLayout /> : <StandardLayout />`
3. **`page.tsx` SSR** already fetches all data via `getListingDetail()` — Showcase just renders more of it
4. **`generateMetadata()`** already dynamic — enhance with Curator's Note snippet for Showcase listings
5. **QuickView** gains `showcaseEligible` awareness for CTA text/styling — minimal change
6. **Component reuse**: `ShowcaseLayout` can import existing display components (SayagakiDisplay, ProvenanceDisplay, KoshiraeDisplay) and restyle them for the dark theme, or create Showcase-specific variants

---

## Video in the Showcase

With Bunny.net Stream video support now live (HLS delivery, TUS uploads), video becomes a first-class element in the Showcase — potentially its most powerful differentiator. A 30-second video of a blade being slowly rotated under raking light communicates more about the jihada and hamon than 20 static photos ever could.

### Video Hierarchy in the Exhibit

Not all videos are equal. The Showcase should treat video differently depending on what it shows:

**1. Hero Video — The Cinematic Opening**

If a listing has video, it can replace the static hero image as the Phase 1 "First Impression." Think: a slow, deliberate pan along the blade's length — muted autoplay, no controls visible initially, looping. The collector's first encounter is a living image.

```
┌─────────────────────────────────────────┐
│                                         │
│     [VIDEO — muted autoplay, loop]      │  ← Full-bleed, dark bg
│     Slow pan along nagasa               │
│     Subtle play/pause on hover          │
│     Tap for full controls + sound       │
│                                         │
│            Sadamune · 貞宗               │  ← Attribution fades in
│            Tokubetsu Jūyō Tōken         │     after 2s delay
│                                         │
└─────────────────────────────────────────┘
```

Design rules for hero video:
- **Muted autoplay** — no sound on entry (browsers require this anyway). Respects the museum atmosphere
- **No visible controls** on initial play — just the moving image. Tap/hover reveals standard HLS controls
- **Loop seamlessly** — the video is ambient, not a presentation with a beginning and end
- **Fallback**: If video fails to load or is still processing, the hero image renders (existing `MediaItem` already handles the `status === 'ready'` check)
- **Performance**: HLS adaptive bitrate ensures mobile users get appropriate quality. `startLevel: -1` (auto) already configured in VideoPlayer

**2. Inline Detail Videos**

Additional videos appear contextually within the exhibit sections:
- A video of the nakago appears in the Identity Card section alongside measurements
- A video showing koshirae fittings appears in the Mountings section
- A video walkthrough with dealer narration appears in its own "Dealer's Perspective" section

For MVP, all videos beyond the hero play in a unified gallery section (Phase 7.5 — between Koshirae and the full image gallery). Future: dealers can tag videos by subject for contextual placement.

**3. The Full Gallery**

After all narrative sections, the gallery combines images and videos in a unified `MediaItem[]` grid (using the existing `getMediaItemsFromImages()` pattern). Videos show thumbnail with play icon overlay. Click opens inline HLS player (existing `VideoGalleryItem` component).

### Mobile Video Considerations

- **Hero video on mobile**: Autoplay works on iOS/Android for muted inline video. Use `playsinline` attribute (already standard). Keep hero video short (~10-15s loop) to avoid data usage concerns
- **Below-fold videos**: Lazy-load via IntersectionObserver — don't fetch HLS manifests until video scrolls into view
- **Cellular data**: Consider a "Load videos" opt-in on cellular connections, or rely on HLS adaptive bitrate (which naturally degrades to low bandwidth)
- **Aspect ratio**: Hero video fills the viewport width. Inline videos maintain their native aspect ratio within max-width constraints

### Video as Showcase Qualifier

Video presence should boost Showcase eligibility. Updated richness scoring:

```typescript
function isShowcaseEligible(listing: Listing): boolean {
  const imageCount = (listing.images?.length ?? 0) + (listing.stored_images?.length ?? 0);
  const videoCount = listing.video_count ?? 0;

  // Need substantial visual content
  if (imageCount < 5 && videoCount === 0) return false;

  let richSections = 0;
  if (listing.provenance?.length) richSections++;
  if (listing.sayagaki?.length) richSections++;
  if (listing.hakogaki?.length) richSections++;
  if (listing.koshirae?.components?.length || listing.koshirae?.artisan_id) richSections++;
  if (listing.kiwame?.length) richSections++;
  if (listing.setsumei_text_en || listing.setsumei_text_ja) richSections++;
  if (videoCount > 0) richSections++;  // Video counts as a rich section

  return richSections >= 2;
}
```

A listing with 3 images + 1 video + provenance could qualify — the video compensates for fewer static photos, because it IS the rich visual content.

---

## Concrete Visual Design Spec

This section defines the exact visual treatment for each Showcase section. The design language is: **museum exhibition at night** — dark, atmospheric, dramatic lighting, scholarly typography, generous space.

### Design Tokens

```css
/* Showcase-specific tokens (scoped to .showcase container) */
--sc-bg-primary:     #0f0f0f;     /* Near-black — the "gallery walls" */
--sc-bg-card:        #1a1917;     /* Warm dark — identity card, curator's note */
--sc-bg-document:    #f5f0e8;     /* Aged parchment — setsumei/sayagaki text cards */
--sc-text-primary:   #e8e4dc;     /* Warm white — body text on dark bg */
--sc-text-secondary: #9a9590;     /* Muted warm gray — captions, labels */
--sc-text-heading:   #f2efe8;     /* Bright warm white — section headings */
--sc-accent-gold:    #c4a35a;     /* Deep gold — cert badges, accents, dividers */
--sc-accent-cert:    var(--cert-color);  /* Inherited from cert color system */
--sc-border:         #2a2825;     /* Subtle warm border */
--sc-divider:        #3a3632;     /* Section dividers */

/* Typography */
--sc-font-display:   'Cormorant Garamond', Georgia, serif;
--sc-font-display-ja: 'Noto Serif JP', 'Yu Mincho', serif;
--sc-font-body:      'Inter', system-ui, sans-serif;
--sc-font-body-ja:   'Noto Sans JP', system-ui, sans-serif;
```

### Section-by-Section Design

#### S1: Hero (Full-Bleed Opening)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │   [IMAGE or VIDEO — 100% width, max-h: 85vh]   │    │
│  │                                                 │    │
│  │   object-fit: contain (NOT cover)               │    │
│  │   The sword floats on darkness                  │    │
│  │   No cropping — the full blade visible          │    │
│  │                                                 │    │
│  │   Subtle radial gradient vignette:              │    │
│  │   transparent center → #0f0f0f edges            │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│          gap: 32px                                      │
│                                                         │
│     ╱ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╲              │
│    │ Cormorant Garamond · 3xl · tracking-wide │          │
│    │                                          │          │
│    │           S A D A M U N E                │          │
│    │              貞  宗                       │          │
│    │                                          │          │
│    │    ── Tokubetsu Jūyō Tōken ──           │          │
│    │         text-gold · small-caps           │          │
│     ╲ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╱              │
│                                                         │
│           gap: 64px before next section                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- `object-fit: contain` NOT `cover` — the sword's silhouette is sacred. No cropping.
- The image/video floats in darkness — the dark background IS the matting
- Attribution text uses letter-spacing (tracking-wide) for gravitas. Small caps for cert designation
- On mobile: hero takes ~70vh. Text below. Scroll to continue
- **Video variant**: Muted autoplay loop. Subtle pulsing play icon (bottom-right) to hint at interactivity. Tap shows full HLS controls
- **Scroll indicator**: Subtle animated chevron or "Scroll to explore" text at very bottom of hero, fades on scroll

#### S2: Identity Card (Museum Placard)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    ┌───────────────────────────────────────────┐        │
│    │ bg: #1a1917 · border: 1px #2a2825         │        │
│    │ rounded-lg · max-w-2xl · mx-auto          │        │
│    │ px-10 py-8                                │        │
│    │                                           │        │
│    │  KATANA                                   │        │
│    │  text-sc-accent-gold · text-xs            │        │
│    │  tracking-[0.3em] · uppercase             │        │
│    │                                           │        │
│    │  ─── (gold divider line, 40px wide) ───   │        │
│    │                                           │        │
│    │  Attributed to                            │        │
│    │  Sagami no Kuni Sadamune                  │        │
│    │  相模国 貞宗                               │        │
│    │  font-display · text-xl                   │        │
│    │                                           │        │
│    │  Sōshū School · Nanbokuchō Period         │        │
│    │  text-sc-text-secondary · text-sm         │        │
│    │                                           │        │
│    │  ┌─────────────────────────────────┐      │        │
│    │  │ Measurements (2×2 grid)         │      │        │
│    │  │                                 │      │        │
│    │  │  Nagasa     70.2 cm             │      │        │
│    │  │  Sori        1.8 cm             │      │        │
│    │  │  Motohaba    3.12 cm            │      │        │
│    │  │  Kasane      0.68 cm            │      │        │
│    │  │                                 │      │        │
│    │  │  tabular-nums · text-sm         │      │        │
│    │  │  label: text-secondary          │      │        │
│    │  │  value: text-primary · medium   │      │        │
│    │  └─────────────────────────────────┘      │        │
│    │                                           │        │
│    │  Mei: Zaimei (在銘)                       │        │
│    │  text-sc-text-secondary · text-sm         │        │
│    │                                           │        │
│    │  ┌─────────────────────────────┐          │        │
│    │  │ TOKUBETSU JŪYŌ · 26th      │          │        │
│    │  │ bg: cert-color/10           │          │        │
│    │  │ border: cert-color/30       │          │        │
│    │  │ text: cert-color            │          │        │
│    │  │ px-4 py-2 · rounded-md      │          │        │
│    │  └─────────────────────────────┘          │        │
│    │                                           │        │
│    └───────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- Card is centered, max-width constrained — museum placard, not full-width
- Cert badge uses the existing `CERT_CONFIG` color system but in a larger, more prominent format
- Measurements in a clean tabular grid — label left-aligned, value right-aligned
- Mei type and nakago type shown here (currently NOT shown in QuickView — this is new visibility)
- On mobile: card goes full-width with slightly reduced padding (px-6 py-6)

#### S3: Curator's Note

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    max-w-prose · mx-auto                                │
│                                                         │
│    CURATOR'S NOTE                                       │
│    text-sc-accent-gold · text-xs                        │
│    tracking-[0.3em] · uppercase                         │
│                                                         │
│    ─── (gold divider, 40px) ───                         │
│                                                         │
│    "This katana represents a particularly fine          │
│    expression of the Sōshū tradition at its             │
│    zenith..."                                           │
│                                                         │
│    font-display · text-lg · leading-relaxed             │
│    text-sc-text-primary                                 │
│    first-letter: text-4xl float-left (drop cap)         │
│                                                         │
│    [2-3 paragraphs, generous line-height]                │
│    [paragraph gap: 1.5em]                               │
│                                                         │
│    ── Generated by NihontoWatch AI ──                   │
│    text-xs · text-sc-text-secondary · italic            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- `max-w-prose` (~65ch) for optimal readability — scholarly text needs a narrow measure
- Drop cap on first letter — classic editorial touch
- Font: Cormorant Garamond (EN) / Noto Serif JP (JA) — serif signals scholarship
- Transparent attribution: "Generated by NihontoWatch AI" — builds trust, doesn't pretend to be human-written
- Loading state: Skeleton lines with subtle shimmer animation while AI generates on first view

#### S4: Documentation (Setsumei + Sayagaki + Hakogaki)

Each document type gets the same treatment pattern — the document IS an artifact:

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    NBTHK SETSUMEI · 重要刀剣認定書                       │
│    text-sc-accent-gold · text-xs · tracking-[0.3em]     │
│                                                         │
│    ─── (gold divider) ───                               │
│                                                         │
│    Desktop (lg+): side-by-side                          │
│    ┌────────────────────┐  ┌────────────────────────┐   │
│    │                    │  │ bg: #f5f0e8 (parchment) │   │
│    │  [setsumei image]  │  │ rounded-lg              │   │
│    │                    │  │ px-8 py-6               │   │
│    │  aspect-auto       │  │                         │   │
│    │  click to zoom     │  │ text-ink (dark on light)│   │
│    │  (lightbox)        │  │ font-body               │   │
│    │                    │  │                         │   │
│    │  subtle shadow     │  │ [English translation]   │   │
│    │  paper-edge effect │  │                         │   │
│    │                    │  │ ── toggle ──            │   │
│    │                    │  │ [日本語原文]              │   │
│    │                    │  │ font-body-ja            │   │
│    └────────────────────┘  └────────────────────────┘   │
│                                                         │
│    Mobile: stacked (image full-width, then text card)   │
│                                                         │
│    ─── section gap: 48px ───                            │
│                                                         │
│    SAYAGAKI · 鞘書                                      │
│    by Tanobe Michihiro · 田野辺道宏                      │
│    text-sc-accent-gold · text-xs                        │
│                                                         │
│    ┌────────────────────┐  ┌────────────────────────┐   │
│    │                    │  │ bg: #f5f0e8             │   │
│    │  [sayagaki image]  │  │                         │   │
│    │  calligraphy       │  │ [Transcription]         │   │
│    │                    │  │ font-display-ja         │   │
│    │  the handwriting   │  │ text-lg                 │   │
│    │  IS the artifact   │  │                         │   │
│    │                    │  │ ── toggle ──            │   │
│    │                    │  │ [English translation]   │   │
│    └────────────────────┘  └────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- The parchment/cream text cards create a warm contrast against the dark gallery background — like a document under glass
- Document images get a subtle paper-edge shadow (box-shadow with warm tones) — they look like physical papers
- Click-to-zoom opens a lightbox (dark overlay, centered image, pinch-zoom on mobile) — scholars want to read the characters
- Sayagaki author is credited prominently (Tanobe-sensei's name is a credential)
- Translation toggle (not auto-expand) — respects users who read Japanese and don't want English in the way
- Hakogaki gets identical treatment but with the "HAKOGAKI" heading

#### S5: Provenance Timeline (伝来)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    PROVENANCE · 伝来                                     │
│    text-sc-accent-gold · text-xs · tracking-[0.3em]     │
│                                                         │
│    ─── (gold divider) ───                               │
│                                                         │
│    Desktop: horizontal timeline                         │
│                                                         │
│    ●─────────────●──────────────●──────────●             │
│    │             │              │          │             │
│    ▼             ▼              ▼          ▼             │
│  ┌──────┐    ┌──────┐     ┌──────┐    ┌──────┐         │
│  │Forged│    │Matsu-│     │NBTHK │    │Dealer│         │
│  │Sōshū │    │daira │     │Jūyō  │    │Name  │         │
│  │c.1340│    │Coll. │     │1952  │    │2024  │         │
│  │      │    │      │     │      │    │      │         │
│  │[img?]│    │[img?]│     │[img?]│    │      │         │
│  └──────┘    └──────┘     └──────┘    └──────┘         │
│                                                         │
│    Timeline line: 2px solid #3a3632                      │
│    Nodes: 12px circle, bg: gold when has image           │
│    Cards: bg: #1a1917, rounded, p-4                      │
│    Click node with image → lightbox                      │
│                                                         │
│    ─── section gap: 32px ───                            │
│                                                         │
│    EXPERT APPRAISALS · 極め                              │
│    ┌──────────────────────────────────────────┐          │
│    │ ⊙ Hon'ami Kōson · Origami · 1780        │          │
│    │   "Attributed to Sagami Sadamune"        │          │
│    │                                          │          │
│    │ ⊙ Tanobe Michihiro · Sayagaki · 2019    │          │
│    │   "Confirmed attribution, exceptional    │          │
│    │    preservation of jihada"                │          │
│    └──────────────────────────────────────────┘          │
│    Kiwame entries: compact list, no cards                │
│    Icon: ⊙ with kiwame type color (origami=gold,        │
│    kinzogan=silver, saya-mei=warm-gray)                  │
│                                                         │
│    Mobile: vertical timeline                            │
│    │                                                    │
│    ●── Forged · Sōshū · c.1340                          │
│    │   [image if exists]                                │
│    │                                                    │
│    ●── Matsudaira Collection                            │
│    │   [image if exists]                                │
│    │                                                    │
│    ●── NBTHK Jūyō · 1952                               │
│    │                                                    │
│    ●── Current Dealer · 2024                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- Desktop: horizontal timeline (reading left-to-right = chronological). Mobile: vertical (natural scroll)
- Kiwame entries are integrated as events on the timeline OR in a companion section — they're part of the sword's biography
- Nodes with provenance images get a gold dot; nodes without get a hollow dot
- Timeline is proportional-ish (not strictly to scale, but Edo period gets more space than modern)

#### S6: Koshirae (Mountings)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    KOSHIRAE · 拵                                         │
│    text-sc-accent-gold · text-xs · tracking-[0.3em]     │
│                                                         │
│    ─── (gold divider) ───                               │
│                                                         │
│    [Full koshirae image — wide, ~40vh]                  │
│    Separate cert if exists: "Tokubetsu Hozon Tōsōgu"   │
│                                                         │
│    gap: 24px                                            │
│                                                         │
│    Desktop: grid of component cards (3-col or 4-col)    │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│    │ bg: card │  │ bg: card │  │ bg: card │            │
│    │          │  │          │  │          │            │
│    │ [image]  │  │ [image]  │  │ [image]  │            │
│    │ aspect   │  │ aspect   │  │ aspect   │            │
│    │ square   │  │ square   │  │ square   │            │
│    │          │  │          │  │          │            │
│    │ TSUBA    │  │ FUCHI-   │  │ MENUKI   │            │
│    │ 鐔       │  │ KASHIRA  │  │ 目貫      │            │
│    │          │  │ 縁頭      │  │          │            │
│    │ Gotō     │  │ Ishiguro │  │ Hamano   │            │
│    │ Ichijō   │  │ Masa-    │  │ Shōzui   │            │
│    │          │  │ yoshi    │  │          │            │
│    │ → Artist │  │ → Artist │  │ → Artist │            │
│    │   page   │  │   page   │  │   page   │            │
│    └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
│    Cards: bg #1a1917, rounded-lg, p-4                   │
│    Component type: gold, xs, uppercase, tracking-wide   │
│    Maker name: font-display, text-base, text-primary    │
│    "→ Artist page" link: text-gold, hover:underline     │
│    Click image: lightbox                                │
│                                                         │
│    Mobile: horizontal scroll (snap-x snap-mandatory)    │
│    Each card: min-w-[200px], scroll-snap-align: start   │
│                                                         │
│    Single-maker koshirae (issaku):                      │
│    No component grid — show maker attribution inline    │
│    with koshirae description. "All fittings by          │
│    Gotō Ichijō" with link to artist page               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### S7: Video Gallery (If Multiple Videos)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    VIDEO · 動画                                          │
│    text-sc-accent-gold · text-xs · tracking-[0.3em]     │
│                                                         │
│    ─── (gold divider) ───                               │
│                                                         │
│    [Primary video — large, ~50vh, full width]           │
│    VideoGalleryItem: thumbnail → inline HLS player      │
│    Dark controls theme matching Showcase palette        │
│                                                         │
│    gap: 16px                                            │
│                                                         │
│    Additional videos (if > 1):                          │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│    │ [thumb]  │  │ [thumb]  │  │ [thumb]  │            │
│    │ ▶ 0:45  │  │ ▶ 1:23  │  │ ▶ 0:30  │            │
│    │ "Detail" │  │ "Nakago" │  │ "Koshi-  │            │
│    │          │  │          │  │  rae"    │            │
│    └──────────┘  └──────────┘  └──────────┘            │
│    Click: swap into primary player slot                 │
│                                                         │
│    NOTE: If only 1 video AND it's used as hero,         │
│    this section is skipped entirely (no duplication)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### S8: Image Gallery (Full Collection)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f                                             │
│                                                         │
│    GALLERY · 写真                                        │
│    text-sc-accent-gold · text-xs · tracking-[0.3em]     │
│                                                         │
│    ─── (gold divider) ───                               │
│                                                         │
│    Masonry grid (using CSS columns or grid):            │
│                                                         │
│    Desktop: 3 columns                                   │
│    ┌────────┐ ┌────────┐ ┌────────┐                     │
│    │        │ │        │ │        │                     │
│    │  img1  │ │  img2  │ │ img3   │                     │
│    │        │ │ (tall) │ │        │                     │
│    ├────────┤ │        │ ├────────┤                     │
│    │        │ │        │ │        │                     │
│    │  img4  │ ├────────┤ │  img6  │                     │
│    │        │ │        │ │ (tall) │                     │
│    │        │ │  img5  │ │        │                     │
│    ├────────┤ │        │ │        │                     │
│    │  img7  │ ├────────┤ ├────────┤                     │
│    │        │ │  img8  │ │  img9  │                     │
│    └────────┘ └────────┘ └────────┘                     │
│                                                         │
│    Images: rounded-md, subtle border #2a2825            │
│    Hover: subtle scale(1.02) + brighter border          │
│    Click: lightbox with prev/next + pinch-zoom          │
│    gap: 8px between images                              │
│                                                         │
│    Mobile: 2 columns, same masonry                      │
│    Tap: full-screen lightbox with swipe                  │
│                                                         │
│    Excludes setsumei/sayagaki/provenance images          │
│    (those appear in their respective sections)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### S9: Dealer & Price (The Offer)

```
┌─────────────────────────────────────────────────────────┐
│ bg: #1a1917 (slightly lighter than gallery)             │
│ border-t: 1px #3a3632                                   │
│ py-16                                                   │
│                                                         │
│    ┌───────────────────────────────────────────┐        │
│    │ max-w-2xl · mx-auto · text-center         │        │
│    │                                           │        │
│    │  [Dealer Logo — if uploaded, 64×64 circle]│        │
│    │                                           │        │
│    │  Dealer Name                              │        │
│    │  font-display · text-2xl · text-primary   │        │
│    │                                           │        │
│    │  dealerdomain.com · Tokyo, Japan          │        │
│    │  text-secondary · text-sm                 │        │
│    │                                           │        │
│    │  ─── (gold divider) ───                   │        │
│    │                                           │        │
│    │  ¥ 35,000,000                             │        │
│    │  font-display · text-4xl · text-gold      │        │
│    │  tabular-nums                             │        │
│    │  (or "Price on request" / "Sold")         │        │
│    │                                           │        │
│    │  gap: 24px                                │        │
│    │                                           │        │
│    │  ┌─────────────────────────────────┐      │        │
│    │  │  Inquire About This Piece       │      │        │
│    │  │  bg: gold · text: #0f0f0f       │      │        │
│    │  │  rounded-md · px-8 py-4         │      │        │
│    │  │  text-lg · font-medium          │      │        │
│    │  │  hover: bg-gold/90              │      │        │
│    │  └─────────────────────────────────┘      │        │
│    │                                           │        │
│    │  View on dealer website →                 │        │
│    │  text-gold · text-sm · hover:underline    │        │
│    │                                           │        │
│    │  ── Share ──                              │        │
│    │  [LINE] [Twitter/X] [Copy link]           │        │
│    │                                           │        │
│    └───────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Sticky Price Bar (Desktop)

While scrolling through the exhibit, a slim sticky bar appears (after scrolling past the hero):

```
┌─────────────────────────────────────────────────────────┐
│ bg: #0f0f0f/95 (frosted glass effect)                   │
│ backdrop-blur-md · border-b: 1px #2a2825                │
│ h-14 · fixed top-0 · z-40                               │
│ opacity: 0 → 1 (appears after scrolling past hero)      │
│                                                         │
│  Sadamune · TJ    [gap]    ¥35,000,000    [Inquire]    │
│  text-sm                   text-gold       btn-sm       │
│  text-secondary            font-medium     bg-gold      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

On mobile: sticky bottom bar instead (safe-area-inset-bottom):

```
┌──────────────────────────┐
│ bg: #0f0f0f/95 · blur    │
│ safe-area-bottom padding │
│                          │
│  ¥35,000,000  [Inquire]  │
│  text-gold     full-CTA  │
│                          │
└──────────────────────────┘
```

### Scroll-Driven Animations

Each section fades in as it enters the viewport. Subtle, not distracting:

```typescript
// IntersectionObserver-based reveal
// Each .showcase-section starts with:
//   opacity: 0; transform: translateY(24px);
// On intersection (threshold: 0.15):
//   opacity: 1; transform: translateY(0);
//   transition: opacity 0.6s ease, transform 0.6s ease;
```

- Sections only animate IN (never re-hide on scroll up)
- Hero section: no animation (immediately visible)
- Identity card: slight upward slide + fade (0.4s delay after hero)
- All subsequent sections: same pattern, staggered by observation

---

## Updated Activation Criteria

With video support, the richness check becomes:

```typescript
function isShowcaseEligible(listing: Listing): boolean {
  const imageCount = (listing.images?.length ?? 0) + (listing.stored_images?.length ?? 0);
  const videoCount = listing.video_count ?? 0;

  // Need substantial visual content (photos OR video)
  if (imageCount < 5 && videoCount === 0) return false;

  // Count rich content sections
  let richSections = 0;
  if (listing.provenance?.length) richSections++;
  if (listing.sayagaki?.length) richSections++;
  if (listing.hakogaki?.length) richSections++;
  if (listing.koshirae?.components?.length || listing.koshirae?.artisan_id) richSections++;
  if (listing.kiwame?.length) richSections++;
  if (listing.setsumei_text_en || listing.setsumei_text_ja) richSections++;
  if (videoCount > 0) richSections++;

  // Manual override
  if (listing.showcase_override === true) return true;
  if (listing.showcase_override === false) return false;

  return richSections >= 2;
}
```

---

## Open Questions (Remaining)

- [ ] Should the Curator's Note be visible to all users or gated behind a subscription tier?
- [ ] Curator's Note model selection — Gemini Flash (fast/cheap, like translate API) vs Claude/GPT-4 (higher quality for premium content)?
- [ ] Caching strategy for Curator's Notes — per listing? Per listing+locale? TTL or event-driven invalidation?
- [ ] How should the standard detail page evolve to not feel "lesser" compared to Showcase?
- [ ] Should QuickView for Showcase-eligible listings visually tease the Showcase (dark accents, preview snippets)?
- [ ] OG image generation — separate `/api/og?showcase=1` variant or auto-detect from data richness?
- [ ] Should dealers be able to tag videos by subject (e.g., "blade detail", "nakago", "koshirae") for contextual placement?
- [ ] Lightbox component — build custom or use existing library (yet-another-react-lightbox, etc.)?
- [ ] Print stylesheet — should the Showcase have a print-optimized layout for collectors who want physical documentation?

---

## Technical Considerations

### New Components (Updated)
- `ShowcaseLayout.tsx` — orchestrator, conditionally rendered inside `ListingDetailClient.tsx`
- `ShowcaseHero.tsx` — full-bleed hero image/video + attribution text + scroll indicator
- `ShowcaseIdentityCard.tsx` — museum placard with measurements, mei type, cert
- `ShowcaseCuratorNote.tsx` — AI narrative display + loading skeleton + locale toggle
- `ShowcaseDocumentation.tsx` — setsumei/sayagaki/hakogaki side-by-side document viewer
- `ShowcaseTimeline.tsx` — horizontal (desktop) / vertical (mobile) provenance + kiwame
- `ShowcaseKoshirae.tsx` — component cards grid (desktop) / horizontal scroll (mobile)
- `ShowcaseVideoGallery.tsx` — primary player + thumbnail strip (reuses existing VideoGalleryItem/VideoPlayer)
- `ShowcaseImageGallery.tsx` — masonry grid with lightbox
- `ShowcaseDealerSection.tsx` — dealer identity + price + CTA
- `ShowcaseStickyBar.tsx` — scroll-aware sticky price/CTA bar
- `ShowcaseSection.tsx` — wrapper component with IntersectionObserver fade-in animation
- `ShowcaseLightbox.tsx` — full-screen image/document viewer with pinch-zoom

### Existing Components Reused
- `VideoGalleryItem` / `VideoPlayer` — HLS video playback (restyle for dark theme)
- `SayagakiDisplay` / `HakogakiDisplay` / `KoshiraeDisplay` / `ProvenanceDisplay` / `KiwameDisplay` — data extraction logic reused, presentation restyled
- `SocialShareButtons` — LINE + Twitter/X sharing
- `CERT_CONFIG` from `MetadataGrid.tsx` — cert color system

### New API
- `GET /api/listing/[id]/curator-note` — return cached Curator's Note (or trigger generation)
- Cron: `/api/cron/generate-curator-notes` — batch pre-generation for eligible listings

### New DB Columns (listings table)
- `ai_curator_note_en` (TEXT) — English Curator's Note
- `ai_curator_note_ja` (TEXT) — Japanese Curator's Note
- `ai_curator_note_generated_at` (TIMESTAMPTZ)
- `ai_curator_note_input_hash` (TEXT) — SHA-256 of all input data for cache invalidation
- `showcase_override` (BOOLEAN, nullable) — TRUE = force Showcase, FALSE = force standard, NULL = auto-detect

### Data Flow
```
page.tsx (SSR)
  │
  ├── getListingDetail() ← already fetches everything
  │     (videos, sayagaki, hakogaki, koshirae, provenance, kiwame, setsumei, artisan)
  │
  ├── isShowcaseEligible(listing) ← new, runs server-side
  │
  ├── getCuratorNote(listing.id) ← new, fetches cached note (or null)
  │
  └── generateMetadata() ← enhanced for Showcase (curator's note snippet, dramatic OG)

ListingDetailClient.tsx
  │
  ├── isShowcaseEligible(listing)
  │     ├── true  → <ShowcaseLayout listing={listing} curatorNote={note} />
  │     └── false → <StandardLayout listing={listing} />  (current layout)
  │
  └── ShowcaseLayout
        ├── ShowcaseHero (image or video)
        ├── ShowcaseIdentityCard
        ├── ShowcaseCuratorNote (with loading state if generating)
        ├── ShowcaseDocumentation (setsumei, sayagaki, hakogaki)
        ├── ShowcaseTimeline (provenance + kiwame)
        ├── ShowcaseKoshirae
        ├── ShowcaseVideoGallery (if multiple videos)
        ├── ShowcaseImageGallery (masonry)
        ├── ShowcaseDealerSection (price + CTA)
        └── ShowcaseStickyBar (scroll-aware)
```

---

## Inspiration References

- **Christie's lot pages** for important Japanese art — editorial narrative, large images, provenance sections
- **Bonhams Fine Japanese Art** catalog format — scholarly descriptions with NBTHK references
- **The Met Collection Online** — museum placard aesthetic, dark background, generous whitespace
- **Google Arts & Culture** — immersive full-screen art viewing with contextual annotations
- **Apple product pages** — scroll-driven reveal, atmospheric photography, controlled pacing
- **Artsy.net** — gallery-quality art presentation, dark mode, clean typography

---

## Future Possibilities

- **3D/AR viewer** for blade geometry (nagasa + sori + motohaba → parametric blade curve)
- **Audio narration** of the Curator's Note (text-to-speech, scholarly voice)
- **Comparative view** — "See similar works by this smith" linking to artist page
- **Print-quality PDF** export of the full Showcase (collector documentation)
- **Social sharing card** that includes a snippet of the Curator's Note + dramatic OG image
- **Collector annotations** — authenticated users can add private notes to any Showcase section
- **Dealer narration videos** — tagged by subject, placed contextually within exhibit sections
- **Multi-language Curator's Note** — beyond EN/JA, generate for other collector markets (FR, DE, ZH)
