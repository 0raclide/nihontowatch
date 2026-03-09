# Yuhindo Design & Content Research

> Research document for NihontoWatch Showcase layout. Extracted from Wayback Machine archives of yuhindo.com (2020-2022). Yuhindo was the personal dealing website of Darcy Brockbank, life member of the NBTHK Tokyo.

---

## Executive Summary

Yuhindo was not a commerce site that happened to have good content. It was a scholarly publication that happened to sell the objects it documented. Every listing received monograph-length treatment, placed every piece in the full context of Japanese sword history, and used photography not as a sales tool but as illustration of the text's observations.

The closest analog in other art markets: the scholarly catalog essays produced by Christie's or Sotheby's for their top-tier Asian Art sales, but presented with the personal warmth and collecting passion of a private dealer.

---

## 1. Overall Design Philosophy

### Dark Museum Aesthetic
- `html { background-color: #000; }` with body text `color: #eae8e6` (warm off-white)
- This is not "dark mode" — it is the ONLY mode
- The effect: reading a museum catalog in a dimly lit gallery, where the objects themselves are illuminated

### Single-Column Scholarly Layout
- Body constrained to `max-width: 863px` (scales to 963px/1063px on wider screens)
- No sidebar, no grid, no multi-column layout on listing pages
- Every page reads as a single continuous essay, like a chapter in an art monograph

### Typography as Luxury Signal
- Primary font: custom geometric sans-serif (`__fl`), falling back to `Gill Sans`
- Headings: `Trebuchet MS` → `Times`
- Body: `12pt` (→`13pt` at 1160px+, →`14pt` at 1360px+), `font-weight: 300` (light), `line-height: 1.4em`
- Light weight against dark background creates an elegant, ethereal reading experience

### Bold as Small-Caps (Distinctive)
```css
p b, p strong { font-variant: small-caps; font-size: 85%; }
```
Bold emphasis renders as small caps rather than heavy weight — classical typographic feel.

### Links as Footnote Markers
```css
a { font-family: "Trebuchet MS", Times; color: #A9D; font-size: 75%;
    font-weight: 700; text-transform: uppercase; }
a:hover { color: gold; }
```
Links appear as small, bold, uppercase, lavender text — like footnote markers rather than web links.

### No Persistent Header
- Hamburger menu is `position: fixed` floating overlay (right side)
- Menu items: semi-transparent purple glass pills (`rgba(48, 32, 80, 0.95)` + `backdrop-filter: blur(3px)`)
- No nav bar consuming vertical space — the content IS the page

### Color Palette (Extremely Restrained)
| Element | Color | Hex |
|---------|-------|-----|
| Background | Pure black | `#000` |
| Body text | Warm off-white | `#eae8e6` |
| Headings | Slightly warm white | `#FFFeFa` |
| Links | Lavender | `#A9D` |
| Link hover | Gold | `gold` |
| Emphasis (em) | Light blue/lavender | `#c3c3ff` |
| Blockquote attribution | White | `#fff` |
| Menu background | Deep purple | `rgba(48, 32, 80, 0.95)` |

---

## 2. Listing Page Structure (Swords)

Canonical structure observed consistently across Kencho, Go Yoshihiro, Shizu Kaneuji, and Norishige:

### Section 1: Hero Image + Title + Specs Table
- **Hero image** (`img.sugata`): Full-width blade photo with koshirae (if present). Floated left. Always FIRST thing visible.
- **H1 title**: The smith/blade name, often italicized. E.g., *"Hoshizukiyo— Kencho"*, *"Go Yoshihiro"*
- **Summary table** (`table.summary`): Minimal, borderless. Italic labels. Decorative dashed line between columns (`content: "--------------------"` in `color: #333`).
  - Fields: period, designation, rating, nakago, nagasa, sori, motohaba, sakihaba, kissaki, nakago nagasa, nakago sori, price
  - Price always LAST and formatted as dollar figure or "-sold-"

### Section 2: Historical Essay (Scholar's Context)
The LARGEST section on every page — often **2,000–5,000 words**. NOT a product description. A scholarly essay.

Key patterns:
- **Begins with historical context, not the item itself.** Kencho page opens with the entire Osafune school history, the Soshu tradition, the Masamune Juttetsu, smith migrations — BEFORE mentioning the specific blade.
- **Detail images interleaved within text** (`img.spotlight`): Full-width macro photographs of hamon, jihada, nie details inserted between paragraphs. No captions — the surrounding text IS the caption.
- **Reference images from OTHER collections** (`figure.R`, floated right, max-width 65%): Comparative pieces with figcaptions. Like "cf." illustrations in an auction catalog.
- **Blockquotes from authorities**: NBTHK publications, Dr. Honma Junji, Markus Sesko, Fujishiro, Albert Yamanaka. Styled italic with em-dash attribution.

### Section 3: The Specific Blade (Personal Commentary)
- Own `<h2>`: "Juyo Token Kencho Wakizashi"
- `figure.L` (floated left) showing full-length presentation photo
- Personal observation about blade qualities, condition, significance
- Expert commentary from Tanobe sensei or others who physically examined the piece

### Section 4: Provenance / Named Sword History
For pieces with significant provenance:
- Organized with `<h3>` and `<h4>` sub-headings for each owner/period
- Translations from Japanese reference books
- Cross-references multiple scholarly sources
- Original Japanese text alongside translations
- Images of original reference book entries (`figure.wide`)

### Section 5: NBTHK Setsumei (Official Documentation)
Highly structured:
- Appointment date and session number
- Attribution line
- `<h3>` headings for each aspect: **Keijo** (form), **Kitae** (forging), **Hamon** (temper pattern), **Boshi** (tip), **Horimono** (carvings), **Nakago** (tang), **Setsumei** (explanation)
- Each heading → single paragraph with official NBTHK description
- Oshigata and origami images as `figure.L`

### Section 6: Sayagaki
- Image of shirasaya inscription (`figure.R`)
- Ordered list (`<ol class="sayagaki">`): Japanese text (MS Gothic) → Romanization → English translation
- Personal anecdotes about inscription process

### Section 7: Koshirae / Fittings
- Full essay on fittings maker with biographical detail
- NBTHK setsumei for koshirae
- Extensive detail photography: full views, tsuka, tsuba, individual elements
- Kencho page: **24 individual koshirae element detail photos**

### Section 8: Gallery (Final)
- Galleria.js at bottom of page
- Full-width, black background, thumbnail strip
- Comprehensive visual reference AFTER all text content

---

## 3. Listing Page Structure (Tosogu)

Same opening pattern (hero + title + specs + blockquote), with additions:
- Publication references (e.g., "Tagane no Hana")
- Kinko Tsuba citation from published reference works
- Hakogaki box inscription documentation
- Extraordinary macro photography — individual motif details at macro level

---

## 4. Image Presentation Philosophy

### Image Classes = Design System
| Class | Purpose | Layout |
|-------|---------|--------|
| `img.sugata` | Hero/overview image. Always first. | Float left |
| `img.spotlight` | Full-width detail photos inline between paragraphs. No caption. | Block, padded |
| `figure.R` | Reference images, comparative pieces | Float right, max-width 65% |
| `figure.L` | Oshigata, presentations, detail views | Float left, max-width 100% |
| `figure.wide` | Panoramic shots, reference book scans, full koshirae | Full-width centered |

### Image Sequencing Follows a Narrative Arc
1. Hero shot (blade with/without koshirae) — establishes the subject
2. Detail macro shots interspersed through essay — illustrates technical points
3. Reference/comparative images from other collections — floated right
4. Oshigata and origami documentation — paired, floated left
5. Sayagaki — floated right
6. Koshirae full views — wide/centered
7. Koshirae detail closeups — series of wide images
8. Gallery slideshow — comprehensive set at bottom

### Key Insight
**Detail photography serves the TEXT, not the other way around.** Images are placed at specific points in the narrative to illustrate technical observations. They are NOT collected in a gallery at the top for quick scanning.

### Image Count
Kencho page: **64 images**. Goto Ichijo: **30+**. Each deliberately placed within the narrative.

---

## 5. Writing Voice & Tone

### Scholarly Authority Without Academic Dryness
Technical Japanese terms introduced naturally, often with parenthetical translations on first use, then used freely. Depth of an academic paper, accessibility of a magazine feature.

### Analogies That Make the Unfamiliar Accessible
> "To understand why that might happen, you can look at any technology revolution, such as smart phones."

> "where the work of Norishige appears to embrace the wildness of a thunderstorm, Go Yoshihiro is like the sun shining, and reflecting off the fallen rain after the storm has passed. They are two sides of the same coin: chaos and order."

### Museum Wall Text Quality
> "There is an old saying that 'One never sees a ghost or a Go' testifying to their rarity."

> "his nie are very bright and silvery, and in combination with his unique nioi-guchi, they appear like stars in the milky way"

> "Overall in work of Kencho we will be looking for these works on the very edge of the Bizen tradition, stepping well into Soshu, and filled with enthusiastic activities."

### Personal Vulnerability (Rare in Dealer Writing — Creates Trust)
> "I remember the first time I saw it, with the light coming over my shoulder and spraying back into my eyes from the dense nie in the sword. I got goosebumps, and I just said out loud, though I was the only one in the room, 'It's beautiful.'"

> "This amazing set touched my heart the moment I saw it. I have no idea who can afford it but I fell in love and I had to have it for my website."

> "Of all my possessions, of all artwork, of everything I have owned since I first had a doll..."

### Tanobe Sayagaki Translation Format
Three layers per line: Japanese characters → romanization → English translation. Translation preserves poetry:
> "The activities of nie in the jihada and hamon are beautiful and of refined taste, as well as exceedingly noble in the highest degree."

> "Chin chin, cho cho. — It is very rare and important."

---

## 6. Inventory Index (Anti-E-Commerce)

Each item as a compact entry:
- `p.smith` — Smith name as large small-caps link (150% size)
- `p.rating` — Fujishiro rating (italic)
- `p.period` — Historical period
- `p.paper` — Certification (italic)
- `p.notes` — Single poetic sentence (max-width: 295px)
- `p.price` — Price or "-sold-" (small-caps)

**Critical design choice**: Smith name > Rating > Period > Certification > Notes > Price. The ARTIST matters more than the object. Price is literally last.

**"Reference Archive"**: Sold items remain on site for education. Not removed or paywalled.

---

## 7. SEO & Structured Data

### Title Format
`{Smith Name} . {Designation} {Type} . {Category} — Yuhindo.com`

### Meta Description Formula
`{Designation} {Type} by {Smith}. {One-sentence provenance/distinction}. {Period}.`

### JSON-LD
Two blocks per listing: `Product` schema + `BreadcrumbList` (two levels).

---

## 8. Technical Implementation

- **Platform**: Custom-built static site (NOT WordPress). Hand-written HTML.
- **CSS**: Single file (`y.57.css`, ~24KB). No framework. No utility classes. All semantic.
- **JS**: Minimal — only Galleria.js for image gallery.
- **Responsive**: 7 breakpoints from 320px to 1360px+. Mobile unfloats figures, reduces margins.
- **Print stylesheet**: Background → white, text → black, hides menu/gallery. Site designed to be printed as reference.

---

## 9. Ten Design Principles Extracted

1. **Content is the design.** No decorative chrome. No gradients, cards, badges, or icons. Photography and prose ARE the design. Dark background makes images luminous.

2. **Each listing is a complete scholarly article.** Can stand alone as a reference document. Sold items remain for this reason.

3. **The essay comes before the product.** You understand historical context before you understand what's for sale. Inverts typical e-commerce. Signals education > transaction.

4. **Detail photography serves the text, not the other way around.** Images at specific narrative points illustrate technical observations. Not a gallery for quick scanning.

5. **Authority through scholarship AND vulnerability.** Cites NBTHK, Honma, Sesko, Fujishiro extensively. But also shares personal emotional responses. The combination creates extraordinary trust.

6. **Price is the least important element.** Appears last in specs table. Never visually emphasized. No currency conversion, comparison tools. Almost an afterthought to the scholarship.

7. **Japanese language woven in naturally.** Technical terms, mei transcriptions, sayagaki translations, original Japanese source texts integrated without apology. Reader expected to be knowledgeable or willing to learn.

8. **The gallery is the final course, not the main dish.** Slideshow at very bottom, after all text. A comprehensive visual reference, but the page doesn't lead with it.

9. **Comparative reference images from other collections.** The practice of an auction catalog or museum exhibition, not a retail website.

10. **The inventory index prioritizes the artist.** Smith name in large small-caps before everything else. A single poetic sentence instead of a feature list.

---

## 10. Implications for NihontoWatch Showcase Layout

### What to Adopt
- Dark-on-black aesthetic with warm off-white text (we already have `.showcase` CSS vars)
- Single-column scholarly reading flow
- Images interspersed within text, not separated into a gallery-first layout
- The narrative arc: context → the specific piece → documentation → gallery
- Restrained color palette (black, warm white, one accent)
- Typography as the primary design element (light weight, generous leading)
- Small-caps for emphasis instead of bold (optional — a signature Yuhindo touch)

### What to Adapt
- Our Showcase gets content from structured data (not hand-written essays) — the AI curator's note fills the "scholarly essay" role
- We need to handle the common case (no koshirae, no sayagaki, no provenance) gracefully — Yuhindo could be maximalist because every listing had rich content
- Our image sequencing should follow the narrative arc but work with whatever images the scraper found
- The specs table can draw from Yuhindo's format (italic labels, minimal borders, dashed separator)
- We serve both JA and EN audiences — Yuhindo was EN-only with inline Japanese

### What NOT to Copy
- The homepage-as-letterhead pattern (we're an aggregator, not a personal dealer)
- The inventory index design (we already have browse with filters — different purpose)
- Galleria.js (we have our own lightbox)
- The hamburger-only navigation (we need persistent nav for an aggregator)

### The Core Lesson
**The Yuhindo page was not designed to sell a sword. It was designed to make you understand why the sword matters.** If our Showcase layout achieves even a fraction of this — where the viewer learns something before they decide whether to buy — we will have succeeded.

---

*Research compiled 2026-03-08 from Wayback Machine archives (web.archive.org). Site parked since late 2022.*
