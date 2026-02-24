# Japanese UX Recommendations for Nihontowatch

> **Context:** With JA localization complete (1090+ i18n keys, locale-aware listing data, Noto Sans JP/Serif JP fonts), this document identifies UI/UX improvements to better serve Japanese users based on established Japanese web design conventions and collector community patterns.
>
> **Date:** 2026-02-22

---

## Table of Contents

1. [Design Philosophy Differences](#1-design-philosophy-differences)
2. [Typography](#2-typography)
3. [Information Density](#3-information-density)
4. [Trust Signals](#4-trust-signals)
5. [Navigation Patterns](#5-navigation-patterns)
6. [Mobile Considerations](#6-mobile-considerations)
7. [Traditional Aesthetic Touches](#7-traditional-aesthetic-touches)
8. [Form Design & Error Handling](#8-form-design--error-handling)
9. [Social & Community](#9-social--community)
10. [Collector-Specific Patterns](#10-collector-specific-patterns)
11. [What We Already Do Well](#11-what-we-already-do-well)
12. [Implementation Priority](#12-implementation-priority)
13. [Sources](#13-sources)

---

## 1. Design Philosophy Differences

Japanese web design is governed by principles that often contradict Western minimalism:

### Ichimokuryouzen (一目瞭然) — "Understanding at a Glance"

Users expect to see **all options and details immediately** without clicking through multiple pages or expanding hidden sections. Sparse layouts create suspicion that information is being withheld. This isn't about visual clutter — it's about **organized density**, like a bento box: every compartment is full, but each has a clear boundary.

### Omotenashi (おもてなし) — "Anticipatory Hospitality"

Interfaces should anticipate what the user needs before they ask. Pre-filled forms, contextual suggestions ("Searching for katana over 70cm? Try the nagasa filter"), and gentle guidance through flows. Error states should instruct, not scold.

### Trust Through Completeness

Japanese consumers are among the most thorough information-seekers globally. Hiding dealer policies, shipping terms, contact details, or data freshness timestamps triggers distrust. **More information = more credibility**, provided it's well-organized.

### Key Tension

Japanese web design is evolving — younger users and modern brands (Mercari, Cookpad) have adopted cleaner layouts. The sweet spot for nihontowatch is **denser than Western minimalism, cleaner than Rakuten** — which aligns well with the "museum catalog" aesthetic we already have.

---

## 2. Typography

### Current State

- Body: `line-height: 1.65`, `font-size: 14px`
- JA body font: Noto Sans JP → Hiragino Kaku Gothic ProN → Yu Gothic
- JA heading font: Noto Sans JP → Hiragino Mincho ProN → Yu Mincho
- Locale-specific font stacks via `html[lang="ja"]` selector in `globals.css`

### Problems

**Line height is too tight for Japanese text.** Kanji and kana are visually denser than Latin characters — each character occupies a full square em-box. Best practice is **1.85–2.0** line-height for Japanese body text (vs. 1.5–1.65 for English). Our current 1.65 makes JA text feel cramped, especially in listing descriptions and setsumei translations.

**Italic rendering breaks Japanese.** Japanese fonts have no true italic glyphs. CSS `font-style: italic` forces an algorithmic oblique slant that looks broken. Any `italic` class that can render on JA text (emphasis, blockquotes, descriptions) needs an override.

### Recommendations

```css
/* globals.css additions */
html[lang="ja"] body {
  line-height: 1.85;
}

html[lang="ja"] .prose,
html[lang="ja"] .description-text {
  line-height: 2.0;
}

/* Kill italic for JA — use bold or color for emphasis instead */
html[lang="ja"] em,
html[lang="ja"] i,
html[lang="ja"] .italic {
  font-style: normal;
  font-weight: 600;
}
```

**Line length:** Japanese text reads best at ~35 characters per line (vs. 60–80 for English). Consider constraining `max-width` on JA text blocks in listing descriptions and setsumei translations.

**Font size floor:** 16px minimum for interactive elements. 14px body text is acceptable for JA (character detail is sufficient at that size on modern screens), but buttons and form labels should be 16px+.

**Never use:** `text-transform: uppercase` on Japanese text (no-op but signals locale-unaware code), `letter-spacing` adjustments designed for Latin text (kanji spacing is fixed-width by design).

---

## 3. Information Density

### Current State

Listing cards show: image, certification badge, title, artisan name, price, dealer, favorite button. This is a good baseline but leans toward Western minimalism.

### Recommendations

**Show more data on listing cards for JA locale:**

| Field | Why | Where |
|-------|-----|-------|
| Nagasa (刃長) | First spec Japanese collectors look at — blade length determines category and price | Below title, next to item type |
| Era/period (時代) | Immediately narrows collector interest | Below artisan name |
| Favorites count (N人がお気に入り) | Social proof — heavily weighted in Japanese e-commerce | Bottom of card |
| "Updated X ago" (N時間前に更新) | Freshness trust signal | Near price or bottom |

This can be conditional on locale — EN cards stay clean, JA cards show the extra row. The *bento box* approach: add a thin row of metadata below the existing card content, separated by a subtle border.

**Listing detail pages:**

Japanese users expect **all specifications above the fold** without "Read more" truncation. For JA locale:
- Expand description by default (no truncation)
- Show full measurement table without collapse
- Display certification session number and year
- Price history graph inline (transparency signal)

**Filter sidebar:**

Keep all filter sections **expanded by default** for JA locale. Collapsed accordions hide information — violates ichimokuryouzen. The sidebar is already `hidden lg:block` on desktop, so expanded filters don't cost mobile real estate.

---

## 4. Trust Signals

Japanese users weight these signals much higher than Western users.

### Freshness Indicators

Add "last updated" timestamps to listing cards and detail pages. We already compute relative times with JA suffixes (秒, 分, 時間, 日). Display them:

- Listing cards: small text near price — "3時間前に更新"
- Detail pages: below price — "最終確認: 2026年2月22日 14:30"
- Dealer pages: "最終スクレイピング: 2時間前" (admin-visible, but public "last updated" version for users)

### Dealer Verification

| Signal | Display | Where |
|--------|---------|-------|
| Active since | "2024年から掲載" | Dealer badge on cards |
| Inventory count | "現在 47点出品中" | Dealer page header |
| Country + city | 🇯🇵 東京 or 🇺🇸 New York | Dealer badge |
| Response rate | "通常24時間以内に返信" | Inquiry form |

### Contact Visibility

Japanese users expect visible contact information — hiding it triggers suspicion. The footer should include (at minimum for JA locale):
- Email address
- Business hours (with JST timezone)
- Physical location or registered business info
- LINE official account (if created)

### Certification Authenticity

For NBTHK-certified items, show:
- Session number and year: "第58回 (2023年)"
- Paper type explicitly: "特別保存刀剣鑑定書"
- Consider linking to NBTHK's public records (if available)

These signals cost nothing to display — the data already exists in the `cert_session` and `cert_type` fields.

---

## 5. Navigation Patterns

### Current State

- Desktop: Single-row header with logo, search, theme/locale/auth controls
- Mobile: Bottom tab bar (Browse, Search, Saved, Collection, Menu) + hamburger drawer
- Breadcrumbs: Present but hidden on mobile

### Recommendations

**Secondary navigation row (desktop):**

Japanese mega-sites (Rakuten, Yahoo! Japan) trained users to expect quick-access shortcuts. Add a thin secondary bar below the header:

```
[新着] [値下げ] [重要刀剣] [特別重要] [刀装具] [全刀剣商]
[New]  [Drops]  [Juyo]     [Tokuju]   [Tosogu] [All Dealers]
```

These are just pre-filtered browse links — zero backend work. The bar can be locale-aware (JA shows more shortcuts, EN stays minimal) or universal.

**Breadcrumbs on mobile:**

Currently hidden. Japanese users rely on breadcrumbs for orientation, especially on detail pages. Show a compact, horizontally-scrollable breadcrumb bar on mobile:

```
ホーム › 刀剣 › 特別保存 › 葵美術 › [Title]
```

This also generates structured data for Japanese Google search results (BreadcrumbList schema).

**Filter chips on mobile:**

After applying filters, show active filter chips above the grid that can be individually dismissed. Japanese users want to see what's active at a glance rather than re-opening the filter drawer to check.

---

## 6. Mobile Considerations

### Context

Japan's smartphone penetration is ~85%, and ~65% of e-commerce transactions happen on mobile. Train commuters browse one-handed on crowded trains — thumb-reach matters enormously.

### Current Strengths

- Bottom tab bar already implemented
- Safe area handling for notches/home indicators
- Touch targets at 44px minimum
- Virtual scrolling for performance

### Recommendations

**Thumb-zone optimization:**

Primary actions (favorite, contact dealer, save search) should be in the bottom 1/3 of the screen. Currently the favorite button is in the card's top-right corner — on tall phones, this requires a reach. Consider a floating action bar on listing detail pages:

```
┌─────────────────────────────────┐
│  [♡ Save]  [📧 Inquire]  [↗ Share]  │
└─────────────────────────────────┘
```

Fixed at the bottom, always visible, thumb-accessible.

**Image gallery gestures:**

Ensure pinch-to-zoom and swipe-between-images work flawlessly on iOS Safari (dominant in Japan — iPhone market share ~50%). Test on actual devices, not just Chrome DevTools emulation.

**Performance targets:**

Japanese mobile networks are fast (5G widespread) but users have **zero tolerance** for jank. Targets:
- LCP < 2.5s (current target: <3s — tighten for JA)
- CLS < 0.1 (layout shifts are especially jarring with kanji text reflow)
- FID < 100ms

**Font loading:**

Noto Sans JP is ~4MB for full character coverage. Ensure we're using `font-display: swap` and subsetting. If not already, consider `size-adjust` to prevent CLS when the JP font loads:

```css
@font-face {
  font-family: 'Noto Sans JP';
  font-display: swap;
  size-adjust: 100%;
}
```

---

## 7. Traditional Aesthetic Touches

Nihontowatch occupies a unique position — it's a modern web app about traditional Japanese culture. Subtle traditional design elements signal authenticity to Japanese collectors and differentiate us from purely Western-designed competitors.

### Vertical Text (縦書き / Tategaki)

CSS `writing-mode: vertical-rl` enables traditional top-to-bottom, right-to-left text. Use sparingly for maximum impact:

| Where | Example | Effect |
|-------|---------|--------|
| Artist name on profile page header | 正宗 (vertical, large) | Museum-label aesthetic |
| Category section titles | 刀剣 / 刀装具 | Traditional menu feel |
| NBTHK certification labels | 特別保存刀剣 | Mimics actual paper layout |
| 404 / empty state | 見つかりません | Elegant error page |

```css
.tategaki {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
```

**Important:** Only for short labels and headings in JA locale. Never for body text or UI controls.

### Traditional Color Accents

Our Sotheby's light theme is elegant but Western-coded. Subtle accent adjustments for JA-aware sections:

| Color | Name | Hex | Use |
|-------|------|-----|-----|
| Indigo | 藍色 (ai-iro) | `#003D61` | Section dividers, link hover |
| Vermillion | 朱色 (shu-iro) | `#C73B3A` | NBTHK seal marks, important badges |
| Gold | 金色 (kin-iro) | `#C9A040` | Already in use — certification highlights |
| Ink black | 墨色 (sumi-iro) | `#1C1C1C` | Already our text primary |

Not a theme overhaul — subtle touches on certification badges, section dividers, and the JA locale footer.

### Wagara (和柄) Background Patterns

Very subtle traditional patterns as section dividers or empty-state backgrounds:

- **Seigaiha** (青海波) — wave pattern for footer or hero section
- **Asanoha** (麻の葉) — hemp leaf for card hover states
- **Sayagata** (紗綾形) — interlocking swastika for borders (traditional Buddhist symbol, common in Japanese design)

Implementation: SVG patterns at 5–10% opacity as `background-image`. Must be invisible at a glance — felt rather than seen.

### Ruby Annotations (ふりがな)

For rare kanji in artisan names or specialized terminology, HTML `<ruby>` tags show reading aids above characters:

```html
<ruby>銘<rt>めい</rt></ruby>  →  めい
                                  銘
```

Useful for: mei types, obscure school names, historical terminology. Helps less experienced Japanese collectors and signals educational depth.

---

## 8. Form Design & Error Handling

### Omotenashi in Practice

Japanese form UX emphasizes anticipatory guidance — tell users what you need before they make mistakes, and when they do, be polite and specific about the fix.

### Validation Message Patterns (JA Locale)

```
❌ "必須" (Required)
✅ "検索条件を1つ以上選択してください" (Please select at least one search condition)

❌ "無効な形式" (Invalid format)
✅ "メールアドレスの形式が正しくありません。例: name@example.com"
   (Email format is incorrect. Example: name@example.com)

❌ "エラーが発生しました" (An error occurred)
✅ "保存に失敗しました。しばらく経ってからもう一度お試しください。"
   (Save failed. Please try again after a moment.)
```

**Rules:**
- Always use です/ます (polite) form — never dictionary form for user-facing text
- Include an example of the correct format when rejecting input
- Suggest the next action the user should take
- Never show technical error codes or stack traces

### Inline Validation Timing

- Validate **on blur** (after user leaves the field), not on every keystroke
- Show success state (✓) for completed fields — Japanese users expect confirmation
- Pre-validate and warn before submission: "この検索条件に一致する結果はありません" (No results match this search)

---

## 9. Social & Community

### LINE Integration

LINE is Japan's dominant messaging platform (~95M monthly active users). It's not optional for reaching Japanese users.

**Immediate:** Add LINE share button on listing detail pages and artist profiles. LINE's share URL scheme:

```
https://social-plugins.line.me/lineit/share?url={encodedUrl}
```

**Future:** LINE Official Account for nihontowatch — push notifications for new Juyo listings, price drops, and weekly digests. LINE's message API supports rich cards with images, which maps perfectly to listing cards.

### Twitter/X Sharing

Twitter/X is the primary social platform for Japanese niche communities (sword collectors, antique enthusiasts). Add share buttons with pre-filled text:

```
{title} - {dealer} | ¥{price}
{url} #日本刀 #nihonto
```

### Social Proof Metrics

Japanese e-commerce heavily features social proof. Display where possible:
- "247人が閲覧" (247 views) — on listing detail pages
- "12人がお気に入り" (12 favorites) — on listing cards and detail pages
- "今週 15点の新着" (15 new items this week) — on dealer pages

We already track views, favorites, and clicks — this is a display change, not a data change.

---

## 10. Collector-Specific Patterns

### Comparison Tool

Japanese collectors are methodical researchers. A side-by-side comparison feature:
- Select 2–3 listings from browse → compare view
- Specs aligned: nagasa, sori, motohaba, era, school, certification
- Images side by side
- Price comparison

This matches the detailed-analysis behavior common in Japanese enthusiast communities and is a natural extension of the collection manager.

### Provenance Depth

Japanese collectors value provenance (伝来 / denrai) deeply. Where data is available, show:
- Previous owners or collections
- Publication citations (参考文献)
- Auction history
- Exhibition history

Currently limited by data availability, but the UI should be ready when the data comes.

### Terminology Glossary

A `/glossary` page (用語集) linking to from inline terms throughout the site. Japanese collectors would use this as a reference resource, driving repeat visits and SEO value for Japanese search queries.

### "New This Week" Prominence

Japanese collectors check dealer sites daily/weekly for new inventory. A prominent "今週の新着" (New This Week) section or sort option should be front-and-center for JA locale — possibly as the default landing view rather than "Featured."

---

## 11. What We Already Do Well

These existing patterns align with Japanese UX expectations:

| Feature | Why It Works for JA |
|---------|-------------------|
| Bottom tab bar (mobile) | Matches Japanese mobile-first expectations, thumb-accessible |
| Noto Sans JP / Serif JP fonts | Proper JA font stack with fallbacks (Hiragino, Yu Gothic) |
| Smart crop focal points | Image quality matters enormously — Japanese collectors scrutinize photos |
| Virtual scrolling | Performance-critical for mobile browsing on trains |
| Kanji artisan names in JA locale | Shows cultural respect, not just romanization |
| Certification color badges | Visual hierarchy via color is the primary tool in JA design (limited font-family variety) |
| 3:4 portrait image ratio | Matches sword photography conventions |
| 5 theme options | Choice signals care for user preferences |
| Artisan lineage on profile pages | Teacher-student relationships are core to Japanese sword scholarship |
| Certification pyramid visualization | Perfect for JA users — mirrors NBTHK's own presentation hierarchy |

---

## 12. Implementation Priority

### Phase 1 — Quick Wins (1–2 days) — COMPLETE

| # | Change | Status | Commit |
|---|--------|--------|--------|
| 1 | JA line-height 1.85+ | **Done** | `1779d4a` |
| 2 | Kill italic on JA text | **Done** | `1779d4a`, `8f17fd9` (added `:lang(en)` escape) |
| 3 | "Updated X ago" on listings | **Done** | `1779d4a`, `c6f4aaa` (hides when NEW badge visible) |
| 4 | Expand filters by default (JA) | **Done** | `1779d4a` |

### Phase 2 — Trust & Density (3–5 days) — PARTIALLY COMPLETE

| # | Change | Status | Commit / Notes |
|---|--------|--------|----------------|
| 5 | LINE + Twitter share buttons | **Done** | `1779d4a` — LINE JA-only, Twitter/X always |
| 6 | Denser listing cards (JA) | **Done** | `1779d4a`, `b3e3af9` — nagasa + era (JA-only), item type kanji (`4f93545`), era kanji (`55443ed`) |
| 7 | Dealer trust signals | **Partial** | Dealer names in kanji (`df6302d`), freshness timestamps. Still missing: response rate, inventory count, country badge |
| 8 | Polite form validation (JA) | **Partial** | Filter empty states done (`1779d4a`). Form validation messages not yet updated |
| 9 | Breadcrumbs on mobile | Not started | Needs design decision on scroll behavior |
| 10 | Navigation shortcut bar | Not started | Quick-access filter presets |

### Phase 3 — Traditional Aesthetic (1 week) — NOT STARTED

| # | Change | Effort | Impact | Files |
|---|--------|--------|--------|-------|
| 11 | Vertical text accents (JA) | 2–3 hr | Medium | Artist profiles, category headers |
| 12 | Traditional color accents | 1–2 hr | Medium | `globals.css` theme variables |
| 13 | Social proof metrics | 3–4 hr | Medium | `ListingCard.tsx`, detail pages |
| 14 | Wagara background patterns | 2–3 hr | Low | `globals.css`, SVG assets |
| 15 | Ruby annotations for terminology | 3–4 hr | Low | TranslatedTitle, description components |

### Phase 4 — Collector Features (2+ weeks) — NOT STARTED

| # | Change | Effort | Impact | Notes |
|---|--------|--------|--------|-------|
| 16 | Comparison tool | 1–2 weeks | **High** | New page + API |
| 17 | "New This Week" landing | 3–4 hr | Medium | Browse filter preset |
| 18 | Terminology glossary | 1 week | Medium | New `/glossary` page |
| 19 | LINE Official Account | Ongoing | **High** | External setup + webhook API |
| 20 | Community forum | 2+ weeks | **High** | Major feature — Phase 3+ |

### Additional Completed Work (not in original plan)

| Change | Commit | Notes |
|--------|--------|-------|
| Item type kanji on cards | `4f93545` | 刀, 脇差, 鐔 etc. via `td()` |
| Era kanji on cards | `55443ed` | 古刀, 新刀 etc. (18 keys) |
| 155 school kanji translations | `e050d4d` | All sword + tosogu schools for `/artists` |
| 3 school kanji corrections | `cfc71ac` | Kinai, Kai Mihara, Kozori |
| Dealer names in kanji | `df6302d` | 39 Japanese dealers verified from official sites |
| Setsumei icon hidden for JA | `7e01ae3` | English-only feature |
| Bidirectional translation (EN→JP) | `120d9e8` | International dealer listings auto-translated |
| QuickView JA fixes | `ff77fa3` | Description, mei type, photo counter, artisan kanji |
| ArtisanTooltip localization | `243fb3e` | School, province, era values |
| Macron font fixes | `eadbeba`, `8623e48` | Inter rendering + latin-ext subset |
| Ratio-based JP detection | `0138af9` | Prevents false positives from embedded kanji |

---

## 13. Sources

### Japanese UX Design Philosophy
- [Japanese UX Patterns and Metrics to Optimize Trust, Performance](https://www.icrossborderjapan.com/en/blog/creative-marketing/japanese-ux-patterns-metrics-optimize-performance/)
- [The "Chaos" of Japanese UI: Why It Looks That Way](https://medium.com/@digitalate/the-chaos-of-japanese-ui-why-it-looks-that-way-and-what-you-can-learn-from-it-de6f8ccc7481)
- [The Evolution of Japanese UX: A Shift Towards Western Minimalism](https://medium.com/design-bootcamp/the-evolution-of-japanese-ux-design-a-shift-towards-western-minimalism-9feb75de9da8)
- [How Japanese UX Differs Fundamentally](https://www.crestecusa.com/blog/how-japanese-ux-differs-fundamentally-from-what-you-may-think-is-best/)
- [The Lies, Myths, and Secrets of Japanese UI Design](https://www.disruptingjapan.com/the-lies-myths-and-secrets-of-japanese-ui-design/)

### Japanese E-commerce Patterns
- [How to Design for Maximum Engagement in Japan E-commerce](https://wpic.co/blog/how-to-design-for-maximum-engagement-in-japan-ecommerce/)
- [Japan eCommerce Trends 2025 & Beyond](https://en.komoju.com/blog/payment-method/japan-ecommerce-trends/)
- [Japan's Top E-Commerce Marketplace Comparison](https://nextlevel.global/blog/2025/10/22/japan-ecommerce-marketplace-comparison/)

### Typography
- [Seven Rules for Perfect Japanese Typography](https://www.aqworks.com/blog/perfect-japanese-typography)
- [Making Vertical Layouts a Web Standard](https://tategaki.github.io/en/)
- [Beyond Translation: Japanese Typography in Web Design](https://www.ulpa.jp/post/beyond-translation-japanese-typography-in-web-design)
- [Comprehensive Guide to Web Typography in Japanese](https://www.linkedin.com/pulse/most-comprehensive-guide-web-typography-japanese-hayataki-masaharu)

### Trust & Conversion
- [Trust Signals: What Are They & How to Use Them](https://www.webstacks.com/blog/trust-signals)
- [Trust Badges to Elevate Credibility](https://nestify.io/blog/trust-badges-types/)

### Form Design
- [10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Inline Validation UX](https://smart-interface-design-patterns.com/articles/inline-validation-ux/)
