# Instagram Integration — NihontoWatch

## Status: Setup In Progress

**Account**: @nihontowatch (Instagram Business account created)
**Date**: 2026-02-26

---

## Setup Checklist

| Step | Status | Notes |
|------|--------|-------|
| Create Instagram @nihontowatch | Done | Business account, "Shopping & retail" category |
| Convert to Business account | Done | |
| Create Facebook Page "NihontoWatch" | Done | Profile pic: Tokugawa mon (icon-512.png), cover: blade hamon photo |
| Link Instagram to Facebook Page | Done | Via Accounts Center |
| Set up Instagram profile (bio, pic, link) | In Progress | Bio + pic done on desktop, website link needs mobile app |
| Register as Meta Developer | Blocked | New-account email cooldown — retry in 24h (2026-02-27) |
| Create Meta Developer App | Pending | App type: Business, name: "NihontoWatch Poster" |
| Add Instagram Graph API product | Pending | |
| Generate short-lived access token | Pending | Via Graph API Explorer |
| Exchange for long-lived token (60-day) | Pending | Via token exchange endpoint |
| Get Instagram Business Account ID | Pending | Via /me/accounts → page-id → instagram_business_account |
| App Review for `instagram_content_publish` | Not needed | Dev mode sufficient for publishing to own account |

**Note:** App Review is only required for publishing to *other people's* accounts. For publishing to @nihontowatch (owned by the app admin), development mode is sufficient. This eliminates the 3-7 day review wait.

---

## Env Vars Needed (once setup complete)

```bash
# Add to .env.local + Vercel
INSTAGRAM_APP_ID=               # From Meta Developer App dashboard
INSTAGRAM_APP_SECRET=           # From Meta Developer App dashboard → App Secret
INSTAGRAM_ACCESS_TOKEN=         # Long-lived token (60-day, must auto-refresh)
INSTAGRAM_BUSINESS_ACCOUNT_ID=  # Instagram Business Account ID (numeric)
```

---

## Architecture Plan

### API: Instagram Graph API (Official)

- **Free**, no payment to Meta
- Requires Business account + linked Facebook Page
- 25 posts/day hard limit (we'd do 2-4/day)
- Images must be **publicly accessible URLs** (Instagram servers fetch them)
- Two-step container model: create container → poll status → publish

### Publishing Flow

```
1. Cron selects top candidates from listings
   ↓
2. Store in `instagram_queue` table (pending/posted/skipped)
   ↓
3. For each approved item:
   a. Resize images to 1080x1350 (4:5 portrait) via sharp
   b. Upload to public URL (Supabase Storage or existing CDN)
   c. Create media container(s) via Graph API
      - Single image: POST /{ig-user-id}/media
      - Carousel: Create child containers, then parent
   d. Poll container status until FINISHED
   e. Publish: POST /{ig-user-id}/media_publish
   f. Mark as posted in queue table
```

---

## Content Psychology — Making the Page Irresistible

### The Collector's Brain

Nihonto collectors are not impulse buyers. They are **identity-driven acquirers**. A collector who spends ¥5M on a katana isn't buying steel — they're buying membership in a lineage that stretches back 700 years. Every piece of content must speak to that identity.

**The 3 identity needs** (in order of power):

1. **Mastery** — "I understand things most people can't see." This is why collectors study hamon patterns, school characteristics, and mei. Content that teaches = content that flatters. The collector saves it not because they'll study it later, but because *having it saved* reinforces who they are.

2. **Discovery** — "I found this before anyone else." The thrill isn't buying — it's *recognizing value others miss*. A Hozon blade by a Juyo-capable smith is invisible to casual observers. Content that reveals hidden quality triggers the collector's deepest instinct.

3. **Belonging** — "I'm part of this world." Nihonto collecting is a closed culture with its own language, hierarchies, and rituals. Content that uses insider vocabulary without explaining it (hada, nie, nioi, utsuri) signals *this account is for us, not tourists*.

### The 5 Engagement Layers

Each layer must be deliberately designed. Miss one and the funnel breaks.

**Layer 1: The Scroll Stop (0.3 seconds)**

The feed is food, friends, and memes. A sword photo alone doesn't stop the thumb. What stops it:

- **Dramatic raking light on hamon** — the visual pattern interrupt. Most sword photos are flat catalog shots. A hamon caught in side-light is alien and beautiful. If the dealer photo doesn't have this, skip the listing.
- **Bold stat overlay** — White text on dark: "47 Jūyō designations." The number creates a curiosity gap that demands resolution.
- **Certification color** — The first slide should prominently feature the cert tier in its brand color (tokuju purple, juyo blue). Collectors' eyes are trained to scan for these.
- **Negative space** — A single blade floating on black. Instagram feeds are cluttered. Emptiness is the pattern interrupt.

**What does NOT stop the scroll**: Busy catalog shots with white backgrounds. Multiple items in one frame. Small text. Dealer logos. "NEW LISTING!" overlays.

**Layer 2: The Read (the caption fold)**

Only ~125 characters show before "...more". This is the most valuable real estate. The fold line must create an **information asymmetry** the reader needs to resolve.

**Bad fold** (answers the question):
> "Tokubetsu Jūyō katana by Nagamitsu. Bizen school, Kamakura period. ¥8.5M via Aoi Art."

The reader knows everything. No reason to tap "more."

**Good fold** (opens a question):
> "47 Jūyō designations. 3 available right now — and one of them shouldn't be."

Now they MUST tap. Why shouldn't it be available? Which one? The fold creates a narrative gap.

**Better fold** (identity trigger):
> "You'll spot the Kamakura hada before you read the caption."

Flattery + challenge. The collector taps to prove they can see it. They're hooked before they've read a word about the item.

**Layer 3: The Save (the bookmark)**

Saves are the second-strongest algorithm signal (after shares). A collector saves a post for one of three reasons:

1. **Reference** — "I'll need this later." Educational content (school identification, mei reading guides, measurement significance). These are high-save, low-share — the collector keeps knowledge for themselves.

2. **Wishlist** — "I'm considering this piece." Listing posts with enough detail to revisit but not enough to decide. Withholding one critical detail (price, or full-resolution images) drives the save + eventual site visit.

3. **Identity shelf** — "Having this saved proves I'm serious." The post doesn't need to be useful. It needs to be *prestigious*. A Tokubetsu Juyo blade with provenance back to a named daimyo — saving it is like bookmarking a painting at Christie's.

**Design for saves**: Every post should give the collector a reason to think "I'll want to find this again." Curated lists ("5 Jūyō katana under ¥3M"), artist deep-dives, and rare-find reveals all trigger saves.

**Layer 4: The Share/Send (social currency)**

Shares are the #1 algorithm signal in 2026. When someone DMs a post to a friend, Instagram aggressively distributes it to non-followers. A collector shares for one reason: **"Look what I found."**

This is social currency. The sharer gains status by being the one who discovered the content. Design for this by creating posts that make the sender look knowledgeable:

- **"Which would you choose?"** — The sender is saying "I know enough to have an opinion on this."
- **Price reveals** — "You won't believe what this Tokuju sold for." The sender is demonstrating market knowledge.
- **Rare finds** — "Only 3 known works by this master." The sender is demonstrating depth.
- **Controversial context** — "This Hozon is from a Juyo-capable smith. Why didn't it certify higher?" The sender is starting a discussion that positions them as an expert.

**What does NOT get shared**: Generic listing posts. Anything that looks like an ad. Content without a narrative hook.

**Layer 5: The Follow (identity commitment)**

A follow is an identity statement: "I am the kind of person who follows @nihontowatch." The profile page is the conversion point, and it must answer three questions in under 5 seconds:

1. **What is this?** — Bio line 1. "Japanese sword intelligence. 52 dealers. 13,500 artisans."
2. **Why should I care?** — The grid. If the top 9 posts look like a research institution's feed (data visualizations, dramatic photography, gold-on-dark aesthetics), the collector sees authority.
3. **What will I miss if I don't follow?** — Pinned post. Your single best-performing educational piece.

### Grid Aesthetic — The 3-Second Audit

When someone taps your profile, they see a 3x3 grid of thumbnails. This is not about individual posts — it's about the *pattern*. The grid must look intentional.

**Visual rules:**
- **Dark backgrounds dominate** — mirrors the NihontoWatch site (ink/charcoal). Bright/white catalog photos are visual noise.
- **Gold accent text** — stats, cert names, era labels. Consistent color = brand recognition.
- **Alternating rhythm** — Every row of 3: one full-bleed photo, one stat card, one carousel cover. Creates visual breathing room.
- **No repeated compositions** — Two similar sword-on-black posts adjacent = lazy. Vary angle, crop, orientation.

**The grid test**: Screenshot the profile, show it to someone for 3 seconds, take it away. They should say "some kind of Japanese sword expert/research thing." If they say "a sword store" — the grid failed.

---

## Content Formats — Mapped to Psychology

### Format 1: The Artisan Intelligence Card (carousel, 5-7 slides)

**Psychology**: Mastery + completionism. Collectors swipe to the end because each slide reveals a new dimension of the artisan. Unswiped carousels resurface to the same user — built-in second exposure.

**Slide structure:**
1. **Hero image** — Best available photo of a work by this artisan, full bleed, dark background. Name + era overlay in gold.
2. **The Number** — "47 Jūyō designations. Elite factor: top 3% of 12,453 swordsmiths." One stat, large type, dark background.
3. **Certification Pyramid** — Screenshotted/redesigned from the artist page. The visual hierarchy (Kokuho → Juyo) is immediately legible and unlike anything on any dealer's Instagram.
4. **Signature insight** — "92% of known works are signed. Distinctive long mei with era-name dating." Photo of a mei if available.
5. **Form specialization** — "78% katana, 15% wakizashi, 7% tantō." Bar chart on dark background.
6. **Currently available** — "3 works by this master are on the market right now." Thumbnail strip of listings.
7. **CTA** — "Full certification history + available works → nihontowatch.com/artists/{slug}"

**Link to**: Artist page. This is your highest-value funnel — users land on the profile, see the pyramid, browse listings, click through to dealers.

**Posting cadence**: 1/week. Rotate through artisans by elite_factor descending — start with the most prestigious names.

### Format 2: The Market Intelligence Drop (carousel, 5-6 slides)

**Psychology**: Discovery + social currency. "5 Jūyō katana under ¥3M right now" is reference material AND bragging rights when shared. High save rate, high share rate.

**Slide structure:**
1. **Cover** — Bold text: "5 Jūyō Katana Under ¥3M — February 2026". Dark background, gold text.
2-6. **One listing per slide** — Photo (smart-cropped), artisan name, school, cert, price. Minimal text. The incompleteness drives the click.

**Link to**: Browse page with pre-filtered URL (`/browse?cert=juyo&type=katana&sort=featured`).

**Posting cadence**: 1-2/month. Vary the angle: by cert tier, by price band, by school, by era.

### Format 3: The "What Makes This Special" Single (single image post)

**Psychology**: Mastery flattery. The caption teaches something the casual observer wouldn't notice. The collector reads it and thinks "I already knew that" (even if they didn't). Validates their expertise.

**Image**: Single dramatic photo. Full-bleed, smart-cropped from listing. The best photo from the listing, not a collage.

**Caption architecture** (below the fold):
```
[HOOK — identity trigger or curiosity gap, 120 chars max]

[REVEAL — 2-3 sentences explaining what makes this piece remarkable.
Reference the artisan's cert history, school significance, or a
specific detail visible in the photo. Use insider vocabulary
without apology — hada, nie, nioi, utsuri, sugata.]

[CONTEXT — 1 sentence placing it in the market. "One of N
available works by this master" or "The only signed example
currently on the market."]

[CTA — "Full documentation + N photos →
nihontowatch.com/listing/{id}"]

#nihonto #katana #{school} #{era} #japaneseswords
```

**Link to**: Listing page. The single-photo + incomplete detail drives the click.

**Posting cadence**: 2-3/week. This is the workhorse format.

### Format 4: The "Hidden Value" Reveal (carousel or Reel)

**Psychology**: Discovery instinct. This is the collector's deepest drive — recognizing value that others miss. A Hozon blade by a Juyo-capable smith is an arbitrage signal. Content that says "most people would scroll past this" is irresistible to collectors who pride themselves on not being "most people."

**Carousel version:**
1. **The piece** — Unassuming photo. No cert badge, no artisan name. Just the blade.
2. **"Most people scroll past this."** — Dark slide, white text.
3. **The reveal** — Artisan name + elite factor. "This smith has 23 Jūyō designations. This blade is certified Hozon."
4. **The implication** — "A Hozon from a Juyo-capable master. What does that mean for value?"
5. **CTA** — "See this artisan's full certification history → nihontowatch.com/artists/{slug}"

**Link to**: Artist page. This format is your Collector-tier conversion funnel — the "capable of" intelligence is the paywall thesis.

**Posting cadence**: 2/month. These are high-effort, high-impact. Don't dilute.

### Format 5: The "This Week on NihontoWatch" Recap (Stories, 5-8 slides)

**Psychology**: FOMO + belonging. Weekly cadence creates the habit. Missing a week means missing what other collectors saw.

**Story structure:**
1. "This Week on NihontoWatch" — branded title card
2-6. Top 3-5 new listings with swipe-up links (link stickers → listing pages)
7. "Most favorited this week" — social proof (shows activity)
8. "Browse all → nihontowatch.com" link sticker

**Saved to Highlight**: "This Week" (rolling, replace weekly). Creates an evergreen content library on the profile.

---

## Caption Architecture — The Fold Line

The fold line (~125 chars visible) is everything. The full caption below is important for SEO and hashtags, but the fold determines whether anyone reads it.

### Fold Patterns That Work

**The Insider Challenge:**
> "The hamon tells you the school before you read the attribution."

*Why it works*: Flatters mastery. The collector wants to prove they can do it. They tap to see if they were right.

**The Asymmetric Stat:**
> "47 Jūyō designations. Only 3 available worldwide right now."

*Why it works*: The gap between 47 (historical significance) and 3 (current scarcity) creates tension that demands resolution.

**The Hidden Signal:**
> "Hozon certification. But look at who made it."

*Why it works*: Implies the cert undersells the piece. Collectors who understand the cert hierarchy feel a dopamine hit — they know what's coming.

**The Provenance Tease:**
> "This blade passed through 4 named collections before reaching the market."

*Why it works*: Provenance is the deepest prestige signal. Named collections = daimyo, zaibatsu, museums. The collector must know which ones.

**The Quiet Authority:**
> "Kamakura. Bizen. Signed."

*Why it works*: Three words, no explanation. If you know, you know. If you don't, this account isn't for you. This is the belonging signal — insiders recognize the weight of those three words together.

### Below the Fold — Full Caption Template

```
[FOLD LINE — one of the patterns above, ≤125 chars]

{artisan_display_name} · {school} school · {era} period
{cert_type} certified · {nagasa_cm}cm nagasa

[1-3 sentences of context. Why this piece matters. What the artisan's
career looked like. What's unusual about this specific work. Use
vocabulary without defining it — hada, nie, sugata, nakago.]

[Scarcity signal: "One of N works by this master currently available"
or "N photos including full-length oshigata"]

Full documentation →
nihontowatch.com/listing/{id}
—or—
Certification history + available works →
nihontowatch.com/artists/{slug}

#nihonto #japaneseswords #{item_type_lower} #{school_lower} #{era_lower}
```

**Rules:**
- Max 5 hashtags (3-5 is Instagram's 2026 recommendation; 30-tag dumps suppress reach)
- Price goes below the fold or is omitted entirely — curiosity drives clicks
- Never explain insider terms — defining "hamon" signals this account is for beginners
- Link text is plain (not clickable) — bio link is the real funnel
- 2,200 character max

### Hashtag Strategy

**Core set (use 3-4 every post):**
`#nihonto` `#japaneseswords` `#katana` `#swordcollector`

**Rotating by content (pick 1-2):**
- By type: `#tsuba` `#tosogu` `#wakizashi` `#tanto`
- By school: `#bizenschool` `#soshuden` `#yamato`
- By era: `#kamakura` `#muromachi` `#edoperiod`
- By cert: `#juyo` `#tokuju` `#nbthk`

**Positioning (pick 1, occasionally):**
`#luxurycollectibles` `#japaneseantiques` `#artmarketplace`

**Never use**: `#art` `#history` `#japan` `#samurai` `#FYP` — too broad, dilutes algorithm signal, attracts the wrong audience.

---

## Curation Criteria

### What Gets Posted

Items selected by priority score. The cron computes an `instagram_score` distinct from `featured_score` because Instagram rewards different attributes than browse does.

**Instagram score formula:**

```
instagram_score =
  (image_quality × 40)        -- 3+ images, first image is dramatic
  + (cert_prestige × 30)      -- tokuju=30, juyo=25, tokuho=15, hozon=10
  + (artisan_richness × 20)   -- HIGH confidence + artist page exists + elite_factor > 0.05
  + (narrative_potential × 10) -- has description, has provenance, has measurements
```

**Hard requirements** (score = 0 if any fail):
- Has at least 1 image (ideally 3+)
- Not `item_type` in (armor, helmet, stand, book, other, unknown)
- Not `artisan_id` UNKNOWN
- Not `admin_hidden`
- Not already posted (`instagram_queue` dedup)
- Not from same artisan as last 3 posts (rotation)
- Not from same dealer as last 2 posts (diversity)

**Artist page posts** (Format 1) selected separately:
- `elite_factor > 0.05` (meaningful cert history)
- At least 1 listing currently available
- Artist page not featured in last 30 days
- Ordered by elite_factor descending (most prestigious first)

### What Gets Skipped

- Flat white-background catalog photos (no visual drama)
- Listings without artisan attribution (caption too thin)
- Items with only 1 small image
- Koshirae-only listings (limited visual variety)
- Anything with `artisan_confidence = NONE`

---

## Image Preparation

### Specs

| Spec | Value |
|------|-------|
| Dimensions | 1080 x 1350px (4:5 portrait, optimal for feed) |
| Format | JPEG, quality 92 |
| Max file size | 8MB per image |
| Carousel | Up to 10 slides via API |
| All slides | Same aspect ratio (matched to first slide) |

### Processing Pipeline

1. Fetch original from `stored_images` or `images[0]` URL
2. Use `focal_x`/`focal_y` from DB for smart crop center (same as browse cards)
3. Resize to 1080x1350 via `sharp` with `fit: 'cover'`
4. Apply subtle contrast enhancement (+5%) for feed visibility
5. Upload to Supabase Storage bucket `instagram-prepared` (public URL required by Graph API)

### Stat Card Generation (for carousel data slides)

For artisan intelligence cards and market drops, generate data slides programmatically:

- Dark background (#0a0a0a) matching NihontoWatch brand
- Gold (#c8a96e) accent text for stats and labels
- Clean sans-serif typography (Inter or similar)
- Generated server-side via `sharp` composite or `@vercel/og` (satori)
- Cached in Supabase Storage alongside photo slides

---

## Profile Setup

### Bio

```
Japanese Sword Intelligence
52 dealers · 13,500 artisans · Certification data

Browse the market →
```

**Why this works:**
- "Intelligence" not "marketplace" — positions as authority, not store
- Numbers = social proof (52 dealers is impressive, 13,500 artisans is staggering)
- "Certification data" signals depth unavailable elsewhere
- CTA is minimal — one line, one action

### Bio Link

`nihontowatch.com/browse?sort=featured&tab=available`

Single link, no Linktree. The browse page IS the funnel. Collectors arriving from Instagram want to browse, not read a menu.

### Highlights Structure

| Highlight | Content | Refresh |
|-----------|---------|---------|
| "This Week" | Weekly recap stories (Format 5) | Replace weekly |
| "Tokuju" | Best Tokubetsu Juyo posts | Add as posted, cap at 15 |
| "Artisans" | Artist intelligence card posts | Add as posted |
| "How It Works" | 3-5 stories explaining NihontoWatch | Once, update quarterly |

### Pinned Post

Pin the single best-performing educational carousel. This is the first thing non-followers see. It should demonstrate **what kind of content they'll get** if they follow.

Ideal candidate: An artisan intelligence card for the most prestigious smith (Masamune MAS590 — 5 Tokuju, 47 Juyo, elite factor top 1%). This establishes authority immediately.

---

## Phased Rollout

**Phase 1 — Admin-curated (MVP)**
- Cron selects 5-8 candidates daily based on `instagram_score`
- Stores in `instagram_queue` table with pre-generated captions
- Admin reviews queue, edits captions if needed, approves/skips
- Approved items posted via Graph API at scheduled time
- 4-5 posts/week (Mon/Wed/Fri single + 1 carousel)
- Weekly story recap (Format 5) — manual initially

**Phase 2 — Semi-automated**
- Remove admin review for single-image posts (Format 3) — auto-post
- Admin review retained for carousels (Formats 1, 2, 4) — higher stakes
- Auto-post at optimal times (Wed-Thu 8-9 PM ET)
- Track engagement metrics per format type → refine curation
- Add `instagram_engagement` column to queue table (likes, saves, shares pulled via API)

**Phase 3 — Fully automated + analytics**
- All formats auto-post
- A/B test fold patterns (rotate caption templates, measure click-through)
- Engagement data feeds back into featured_score (Instagram heat signal)
- Weekly automated report: top post, follower growth, click-through rate

**Phase 4 — Cross-platform**
- Extend to X/Twitter (same content, different caption length/style)
- LINE for JA audience (Stories equivalent)
- Consider unified API for multi-platform posting

---

## Key Files (to be created)

| Component | Planned Location |
|-----------|-----------------|
| Instagram API client | `src/lib/instagram/client.ts` |
| Image preparation (resize + stat cards) | `src/lib/instagram/imagePrep.ts` |
| Caption generation (fold patterns) | `src/lib/instagram/caption.ts` |
| Fold pattern templates | `src/lib/instagram/foldPatterns.ts` |
| Curation/candidate scoring | `src/lib/instagram/curate.ts` |
| Posting cron job | `src/app/api/cron/post-instagram/route.ts` |
| Queue management API | `src/app/api/admin/instagram-queue/route.ts` |
| Admin queue UI | `src/app/admin/instagram/page.tsx` |
| Token refresh cron | `src/app/api/cron/refresh-instagram-token/route.ts` |
| Engagement pull cron | `src/app/api/cron/pull-instagram-metrics/route.ts` |
| DB migration (queue table) | `supabase/migrations/XXX_instagram_queue.sql` |

### DB Schema (planned)

```sql
CREATE TABLE instagram_queue (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id),        -- NULL for artisan-focused posts
  artisan_code TEXT,                                  -- for Format 1 (artisan intelligence cards)
  post_format TEXT NOT NULL DEFAULT 'single',         -- single | artisan_card | market_drop | hidden_value
  status TEXT DEFAULT 'pending',                      -- pending | approved | posted | skipped | failed
  caption TEXT,
  fold_pattern TEXT,                                  -- which fold template was used
  image_urls JSONB,                                   -- prepared image URLs (resized, public)
  slide_count INTEGER DEFAULT 1,                      -- number of carousel slides
  instagram_media_id TEXT,                            -- returned after successful publish
  instagram_permalink TEXT,                           -- post URL on Instagram
  link_target TEXT,                                   -- listing/{id} or artists/{slug}
  instagram_score REAL,                               -- curation score at selection time
  -- Engagement metrics (pulled via API 24h + 7d after posting)
  ig_likes INTEGER,
  ig_comments INTEGER,
  ig_saves INTEGER,
  ig_shares INTEGER,
  ig_reach INTEGER,
  ig_impressions INTEGER,
  engagement_pulled_at TIMESTAMPTZ,
  -- Timestamps
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ,                         -- target post time (optimal timing)
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  created_by TEXT DEFAULT 'cron'                      -- cron | admin
);

-- Index for dedup: never re-post same listing or artisan
CREATE UNIQUE INDEX idx_instagram_queue_listing ON instagram_queue(listing_id)
  WHERE listing_id IS NOT NULL AND status IN ('approved', 'posted');
CREATE UNIQUE INDEX idx_instagram_queue_artisan ON instagram_queue(artisan_code)
  WHERE artisan_code IS NOT NULL AND status IN ('approved', 'posted')
  AND selected_at > NOW() - INTERVAL '30 days';
```

---

## Token Management

- **Short-lived token**: ~1 hour, obtained from Graph API Explorer
- **Long-lived token**: 60 days, obtained via exchange endpoint
- **Auto-refresh**: Cron job every 50 days exchanges current long-lived token for a new one
- **Refresh endpoint**: `GET /oauth/access_token?grant_type=fb_exchange_token&...`
- **Store in**: Vercel env var (manual update) or Supabase `settings` table (auto-update)

---

## Gotchas & Risks

### Technical
1. **Images must be publicly accessible** — Instagram servers fetch from URL, no file upload
2. **Container processing is async** — must poll status before publishing, can take seconds to minutes
3. **Token expires every 60 days** — silent failure if not refreshed. Cron must auto-refresh at day 50.
4. **Caption links are plain text** — not clickable, bio link is the real traffic driver
5. **App Review required for production** — dev mode limits to 5 test users; review takes 3-7 days
6. **25 posts/day hard cap** — more than enough for our use case
7. **New Facebook account cooldown** — currently blocked, retry after ~1 hour

### Content/Strategy
8. **Copyright** — dealer photos are their IP. Always credit the dealer in caption. Linking back to their listing page is both good practice and the value prop.
9. **Never explain insider terms** — defining "hamon" or "hada" in captions signals the account is for beginners. The target audience already knows. Explanation content goes in dedicated educational posts, not listing captions.
10. **Never post without a narrative** — a photo + specs dump looks like every dealer's feed. The caption must contain a *reason this piece matters*. If the cron can't generate a narrative (no artisan match, no cert, no measurements), skip the listing.
11. **Resist daily posting pressure** — 4-5 high-quality posts/week beats 7 mediocre ones. Instagram's algorithm rewards completion rate (watch time, swipe-through) not volume. Quality decay kills engagement rate which kills reach.
12. **Don't compete with dealers visually** — dealers have the original photography. NihontoWatch's visual advantage is *data visualization* (pyramids, stats, comparisons). The grid should look like a research institution, not a storefront.
13. **The grid is the conversion page** — optimizing individual posts while the grid looks incoherent is a leak. Every post must contribute to the overall pattern. Check the 3x3 view before posting.

---

## Posting Schedule

### Weekly Cadence (Phase 1)

| Day | Format | Content | Link Target |
|-----|--------|---------|-------------|
| Mon | Single (Format 3) | "What Makes This Special" — best new listing | `/listing/{id}` |
| Wed | Carousel (Format 1 or 2) | Artisan intelligence card OR market drop | `/artists/{slug}` |
| Fri | Single (Format 3) | Second-best listing, different school/era than Mon | `/listing/{id}` |
| Sat | Carousel (Format 4) | "Hidden Value" reveal (2x/month) or second market drop | `/artists/{slug}` |
| Daily | Stories (Format 5) | 3-5 stories: new arrivals, polls, this-week recap | Link stickers |

**Optimal posting time**: Wed-Thu 8-9 PM ET (US evening + JP early morning). Weekend posts at 10 AM ET (catches relaxed browsing).

**Rotation constraints:**
- Same artisan max 1x per 7 days
- Same dealer max 2x per 7 days
- Same school max 2x per 7 days
- Cert tier variety: at least 1 Hozon/Tokuho post per week (not all Juyo/Tokuju — accessible content matters)

---

## 90-Day Growth Targets

### Month 1: Foundation (0 → 100-200 followers)

**Goals:**
- Establish grid aesthetic (dark + gold + data)
- Post 16-20 times (4-5/week)
- Pin 1 artisan intelligence card (Masamune)
- Set up 4 Highlights
- Respond to every comment within 1 hour

**Content mix:**
- 60% single listing posts (Format 3) — build the grid
- 30% artisan cards (Format 1) — establish authority
- 10% educational — "How NBTHK certification works"

**Measure:** Engagement rate (target >3%), save rate on carousels (target >8%)

### Month 2: Engagement Loop (100-200 → 300-500 followers)

**Goals:**
- Identify which fold patterns drive highest tap-through
- Introduce "Hidden Value" format (Format 4)
- Start weekly story recap
- Test "Which would you choose?" engagement posts

**Content mix:**
- 50% single listings
- 25% artisan cards
- 15% market drops
- 10% hidden value reveals

**Measure:** Share rate (target >3% of reach), click-through to site (track via UTM params on bio link)

### Month 3: Compounding (300-500 → 600-1000 followers)

**Goals:**
- Engagement data feeds back into curation (high-engagement formats get more slots)
- Introduce A/B testing on fold patterns
- Begin pulling engagement metrics via API for analytics
- Create first "Best of Month" compilation carousel

**Measure:** Follower growth rate (target 2-3%/week), bio link clicks (target 50+/week)

### Success Metrics (ongoing)

| Metric | Bad | Okay | Good | Great |
|--------|-----|------|------|-------|
| Engagement rate | <1% | 1-2% | 2-4% | >4% |
| Save rate (carousels) | <3% | 3-6% | 6-10% | >10% |
| Share rate | <1% | 1-2% | 2-4% | >4% |
| Follower growth/week | <1% | 1-2% | 2-3% | >3% |
| Bio link clicks/week | <10 | 10-30 | 30-60 | >60 |

---

## The Data Moat — Content Only NihontoWatch Can Make

Individual dealers can photograph their inventory. Only NihontoWatch can produce:

| Content Angle | Data Source | Why Dealers Can't |
|---------------|-----------|-------------------|
| "Top 3% of all swordsmiths" | `elite_factor` + percentile | Requires 12,453 artisan index |
| "47 Jūyō, 3 available now" | Yuhinkai cert counts + live inventory | Cross-dealer aggregation |
| Certification pyramids | `gold_values` aggregation | Museum-grade statistical data |
| "Hozon from a Juyo-capable smith" | `elite_factor` + listing `cert_type` | Cross-database intelligence |
| "4 named collections" | Provenance tier data | Yuhinkai denrai records |
| "Most favorited this week" | `user_favorites` behavioral data | Only NihontoWatch tracks this |
| School comparison across dealers | Browse API facets + artisan data | No single dealer has competitors' inventory |
| Price trend over time | `price_history` table | Dealers don't publish their price changes |
| Form/signature statistics | `gold_values` form + mei analysis | Requires entire certified corpus |

**The thesis**: Every post should contain at least one data point that could only come from NihontoWatch's aggregation. This is what makes the account unfollowable — the intelligence isn't available anywhere else.

---

## References

- [Instagram Graph API Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Meta App Review](https://developers.facebook.com/docs/app-review/)
- [Instagram Image Specs 2026](https://skedsocial.com/blog/best-instagram-image-and-video-size-recommendations)
