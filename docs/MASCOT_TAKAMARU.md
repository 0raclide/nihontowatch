# Takamaru (宝丸) — The NihontoWatch

**Status:** Design concept
**Date:** 2026-02-22

---

## The Core Idea

NihontoWatch is not a company that has a mascot. **NihontoWatch is what the mascot does.**

- **Nihonto** (日本刀) = the swords, the treasures, the objects
- **Watch** = Takamaru's duty — to scout, to monitor, to keep vigil

The fox watches nihonto. That's the job. The site is Takamaru's report back to you — what the fox found on today's rounds across 52 dealers.

This reads the way Japanese business names read. 銀座盛光堂 (Ginza Seikodo) isn't a "brand" — it's "Ginza's Flourishing Light Hall," a description of what the place is. 刀剣小町 (Touken Komachi) is "Sword Beauty." NihontoWatch is "the watching of nihonto" — and Takamaru is the one doing the watching.

Look at the logo: **Nihonto** in ink-black (the swords themselves, steel and iron) + **Watch** in amber-gold (the fox's color, the fox's duty). The mascot was always in the name.

---

## Identity

**Name:** 宝丸 (Takamaru)
**Reading:** ta-ka-ma-ru
**Meaning:** "Treasure" (宝, takara) + "-maru" (丸), the traditional suffix for beloved swords, ships, and cherished things

The -maru suffix is deeply embedded in nihonto culture. Famous blades carry it: Kogarasu-maru (小烏丸, "Little Crow"), Onimaru (鬼丸, "Demon"), Juzumaru (数珠丸, "Rosary"). By naming our mascot with -maru, we signal two things at once: this is a treasured companion, and we speak the language of swords.

**Species:** Inari fox (稲荷狐) — a zenko (善狐, benevolent shrine fox), messenger of Inari Okami

**Role:** Takamaru *is* the NihontoWatch. The fox ranges across 52 dealers, finds treasures, and brings them back to collectors. Sometimes stumbles. Always tries again. The site is the fox's ledger — a record of everything Takamaru has found.

---

## Why an Inari Fox

### The tradition *is* the function

Inari foxes are not a metaphor we're grafting onto a tech product. What Inari foxes do and what NihontoWatch does are the same thing described in different centuries.

| What Inari Foxes Do | What Takamaru Does |
|---------------------|---------------------|
| Serve as messengers of Inari, kami of commerce | Serves collectors in the nihonto market |
| Scout and retrieve treasures for the faithful | Ranges across 52 dealers, brings back what it finds |
| Carry a hoju (宝珠) — the wish-fulfilling jewel | Helps you find the exact sword you're looking for |
| Carry a key (鍵) to the granary | Unlocks inventory you'd never find dealer by dealer |
| Keep vigil at the shrine gate | Keeps watch over the nihonto market — that's the name |
| Trusted, benevolent (zenko), working for others | Works for the collector, not the dealer. No hidden agenda. |
| Present at 30,000+ shrines across Japan | Universally recognized by every Japanese user |

### Cultural legitimacy

Foxes are not an external imposition on nihonto culture. Kitsune motifs appear in historical sword fittings — Edo-period tsuba, menuki, kozuka, and fuchi-kashira with fox engravings exist in the historical record. Aoi Art (a dealer we aggregate) has listed fox-motif tosogu. Takamaru has material culture backing.

### No existing competition

The nihonto collector space has zero established mascot characters. The Nihonto Message Board, NBTHK, Nihonto Club, and all major dealers use photography, mon (family crests), or calligraphy-based branding. This is a completely open field.

---

## Visual Design

### Fox Type: Zenko (善狐) — Benevolent Shrine Fox

Takamaru is an Inari shrine guardian fox, **not** a wild trickster (yako/nogitsune). The visual language must read as trustworthy and dignified, with warmth.

| Attribute | Direction | Rationale |
|-----------|-----------|-----------|
| Fur | **Warm amber** (kohaku-iro, 琥珀色) | Matches NihontoWatch brand accent (`#d49040`). Natural fox color. The brand made fur. |
| Build | Slender, elegant, fox proportions | Not chibi/round. Not hyper-realistic. Refined. |
| Expression | Bright, alert, slightly warm | Not sly or cunning. Not stoic. Approachable dignity. |
| Tail | **Single**, raised elegantly | Shrine foxes have one tail. Multiple tails = supernatural folklore, wrong register. |
| Eyes | Amber/gold | Traditional, warm, connects to kin-iro (gold) |
| Posture | Primary: seated upright, looking forward | The canonical Inari fox pose. Secondary poses for different contexts. |

### Color Palette

Takamaru's primary fur color is **warm amber** — the same honey-gold-orange tone as "Watch" in the NihontoWatch logo. This is the brand's signature accent (`--accent`), which ranges from `#B8860B` (light theme) to `#d49040` (dark theme, described in CSS as "honey gold — deep warm, almost orange"). The fox *is* the brand color.

| Color | Japanese Name | Hex Range | Use |
|-------|--------------|-----------|-----|
| Amber/honey | 琥珀色 (kohaku-iro) | `#B8860B` → `#d49040` | **Fox body** — warm amber matching the "Watch" logo accent. The brand made fur. |
| Cream/white | 白練 (shironeri) | `#F5F0E8` | Chest, belly, tail tip, inner ears — the lighter undercoat |
| Vermillion | 朱色 (shu-iro) | `#C73B3A` | Bib or collar cord. The torii gate color. Pops against amber fur. |
| Gold | 金色 (kin-iro) | `#C9A040` | Hoju jewel, eye color. Slightly warmer/brighter than the fur to read as a distinct object. |
| Ink black | 墨色 (sumi-iro) | `#1C1C1C` | Nose, eye outlines, paw tips, ear tips. Already our `--text-primary`. |
| Flame orange | 橙 (daidai) | `#E8740C` | Hoju flame nimbus — hotter than the fur, reads as "glowing" |

**Why amber, not white:** The canonical Inari byakko (白狐) is white, but the zenko/yako distinction is carried by expression and posture, not fur color. Modern Inari art frequently uses warm amber tones. An amber fox matches the NihontoWatch brand palette, reads naturally as "fox" without explanation, and is visually warmer and more approachable than a white fox. White would look clinical against our warm theme tones. Amber *is* us.

**Theme adaptability:** The fox's amber hue should be the midpoint of the accent range (~`#c9a040`), which reads well against both light backgrounds (`#FAF7F2`) and dark (`#0e0d0c`). The cream undercoat provides contrast on dark themes; the ink-black details provide contrast on light themes.

### The Hoju (宝珠, Wish-Fulfilling Jewel)

Takamaru's signature held object. Among the four canonical items Inari foxes carry (key, jewel, rice sheaf, scroll), the hoju maps best to NihontoWatch's purpose: *wish fulfillment for collectors*.

**Traditional form:** A rounded, slightly bulbous orb — not a perfect sphere but an inverted teardrop / onion shape with a pointed top, often wreathed in flame (kaen-hoju, 火炎宝珠). This is the same shape seen on bridge railings (giboshi) across Japan.

**Our version:** Takamaru carries a small kaen-hoju in its mouth or balanced on a paw. The flame wreath is subtle — more glow than fire. Gold with warm orange flame edges.

### Accessory: Vermillion Bib (Optional)

Inari fox statues at shrines commonly wear red cloth bibs (yodarekake) placed by worshippers as votive offerings. A small vermillion bib or collar cord on Takamaru would instantly read as "shrine fox" to Japanese users. The vermillion (`#C73B3A`) pops against amber fur — complementary warmth with enough hue shift to read as a distinct element.

### Art Style Target

**"Cleaner than ukiyo-e, warmer than corporate, more refined than yuru-chara."**

The style should sit between:
- **NOT** chibi/kawaii yuru-chara (too casual for a premium collector tool)
- **NOT** hyper-realistic wildlife illustration (too cold, no personality)
- **NOT** anime/manga style (too close to Touken Ranbu territory)
- **YES** something like: a confident ink-brush illustration with clean lines, slight warmth, and just enough stylization to feel like a character rather than a nature painting. Think museum shop quality — the kind of illustration that would look good on a tenugui (手拭い).

Reference register: the fox illustrations in traditional Inari shrine ema (絵馬, votive tablets), but with modern polish.

---

## Personality

### Core Traits

**Diligent (勤勉)** — Takamaru is always working. Scanning dealers, checking prices, verifying availability. The core personality is *earnest effort on the collector's behalf*.

**Keen-nosed (鼻が利く)** — Finds things others miss. A new Juyo listing at a small dealer, a price drop on a rare tsuba, a pattern in the market. This is the "treasure hunter" aspect.

**Occasionally clumsy (ドジっ子)** — Sometimes stumbles, drops the hoju, gets confused. This is the humanizing trait that makes error states and empty results feel warm instead of frustrating. The stumbles are endearing, never incompetent.

**Loyal (義理堅い)** — Works for the collector, not the dealer. Brings back honest information. Doesn't play favorites. The zenko (benevolent fox) identity means Takamaru is fundamentally trustworthy.

**Quietly proud** — When Takamaru finds something great, there's a subtle tail wag, a slight puff of the chest. Not boastful, but visibly satisfied with a good find.

### Voice & Tone (for UI copy)

Takamaru speaks in polite but warm Japanese — です/ます form with occasional casual warmth. Not stiff keigo (too corporate) and not casual dictionary form (too familiar). The omotenashi (おもてなし) register: anticipatory hospitality. The fox is reporting its own work, not narrating for a brand.

**Examples:**

| What the Fox Is Doing | JP | EN |
|-----------------------|----|----|
| Scouting | 探しています... | Searching... |
| Reporting a find | 見つけました！ | Found them! |
| Came up empty | まだ見つかりませんでした。もう少し探してみます。 | Nothing yet. I'll keep looking. |
| Stumbled | あれ？つまずいてしまいました。もう一度お試しください。 | Oops, I stumbled. Please try again. |
| Bringing back new inventory | 新しいお宝を見つけました！ | Found new treasures! |
| Spotted a price drop | お得な情報です！ | A deal for you! |
| Greeting a returning collector | おかえりなさい。新着がありますよ。 | Welcome back. There's something new. |

---

## Conflict Avoidance: Touken Ranbu's Konnosuke

Touken Ranbu (刀剣乱舞) is a massively popular sword-collecting game with its own fox mascot, **Konnosuke (こんのすけ)** — a small kuda-gitsune (pipe fox) that serves as the player's tutorial guide. Nihonto collectors will know this franchise. Takamaru must be clearly distinct.

| Attribute | Konnosuke (avoid overlap) | Takamaru (our direction) |
|-----------|--------------------------|--------------------------|
| Fox type | Kuda-gitsune (pipe fox, tiny, supernatural) | Inari byakko (full shrine guardian) |
| Size | Palm-sized, tiny | Full fox, dignified stature |
| Art style | Chibi, round, kawaii | Refined, ink-brush-influenced, museum quality |
| Color | Tan/brown, pink inner ears | Warm amber (brand accent), cream undercoat, vermillion bib |
| Role | Tutorial helper, game companion | Treasure scout, market guide |
| Audience | Primarily female, anime/game fans | Serious collectors, international |
| Tone | Playful, cute | Warm but authoritative |

**Key differentiator:** Konnosuke is a game UI companion. Takamaru is a brand identity character — closer to a crest or insignia than a chatbot avatar.

---

## UI Integration Points

### Moments in the Fox's Work

These aren't "mascot placements" — they're glimpses of Takamaru doing the job. The fox is always working; these are the moments the user sees it.

| What's Happening | What the User Sees | Pose |
|------------------|--------------------|------|
| **Takamaru is scouting** | Loading / searching state | Ears perked, nose forward, alert — actively on the hunt |
| **Takamaru found something** | New listing alerts, search results loaded | Trotting in, hoju glowing bright, tail up — discovery |
| **Takamaru is presenting a find** | Price drop notification, saved search match | Both paws offering hoju forward, slight bow — omotenashi |
| **Takamaru came up empty** | Empty search results, no matches | Looking around, slightly puzzled, hoju dimmed — still trying |
| **Takamaru stumbled** | Error pages (404, 500), failed requests | Hoju rolling away, sheepish expression — endearing, not broken |
| **Takamaru greets you at the gate** | Welcome / onboarding | Seated at a torii gate, looking inviting — the shrine entrance |
| **Takamaru is proud of your collection** | Achievement, milestone | Holding hoju high, slight sparkle — quietly pleased |
| **The fox's mark** | Favicon, app icon | Minimal: fox face silhouette in amber + vermillion — works at 16x16 |
| **The fox's seal** | Email notification headers | Small seated pose — consistent across all correspondence |

### Where Takamaru Does NOT Appear

- **Admin pages** — the fox works for collectors, not for us
- **Dealer-facing pages** — B2B context, different relationship
- **Legal/terms pages** — wrong register
- **Every single UI element** — restraint. Takamaru appears at moments of emotion (delight, frustration, discovery), never as decoration. The fox is working, not posing.

### Progressive Disclosure

First-time visitors see Takamaru at the gate (onboarding). Returning users see the fox in loading/empty/error states and notifications. Power users mostly see the favicon mark — the fox is still working, just out of sight. The mascot's presence scales inversely with user expertise: it guides newcomers and stays out of the way for veterans.

---

## Error Culture & the AI Pipeline

### The problem: probabilistic systems in an error-intolerant culture

NihontoWatch runs on AI pipelines that are probabilistic by nature — artisan matching, LLM price extraction, machine translation, smart crop detection. These systems produce confidence levels, not certainties. In Western tech culture, that's fine — users understand "AI confidence: 72%" and shrug. Ship fast, fix later.

Japanese collector culture is the opposite. Nihonto collecting is a scholarly discipline. Collectors know more about specific smiths than most museum curators. Accuracy is not a feature — it's a moral obligation. A wrong attribution isn't a bug, it's an insult to the smith, the tradition, and the collector's intelligence. The cultural weight of errors is fundamentally different:

- **Western tech error:** Engineering problem. "Oops, we'll fix it." Users file a bug report.
- **Japanese professional error:** Failure of duty. Loss of face. Users lose trust in the institution.

This is why Japanese businesses treat errors with gravity that looks disproportionate to Western eyes — public apologies, deep bows, sometimes actual career consequences. The word is 不信感 (fushinkan) — the feeling of distrust that an error creates. Once established, it's very hard to undo.

### The solution: blame absorption through aikyo (愛嬌)

This is arguably the strongest functional reason for Takamaru's existence — not branding, but **blame absorption for probabilistic systems**.

愛嬌 (aikyo) means "charm through imperfection." A mascot that sometimes fails has aikyo. A corporation that sometimes fails has fushinkan. Same error, completely different emotional response.

When Takamaru stumbles, it's a narrative event — the fox tripped. When NihontoWatch-the-corporation makes an error, it's a systemic failure. The fox converts institutional blame into personal sympathy.

This is not decorative. This is why Japanese police departments, banks, hospitals, train companies, and municipal governments — institutions that *cannot* afford to seem incompetent — all use mascots. It's social technology. When the train is late, the mascot apologizes. The anger that would land on JR East lands on a penguin instead, and it becomes a forgivable moment.

### Mapping to NihontoWatch's actual AI pipeline

Every row below is a real failure mode that has happened or will happen:

| AI Pipeline | What Goes Wrong | Without Takamaru | With Takamaru |
|-------------|----------------|-----------------|---------------|
| **Artisan matching** (HIGH/MEDIUM/LOW confidence) | Wrong smith attributed to a blade | "System confidence: 62%" — cold, invites scrutiny from experts | Takamaru thinks this might be Yasumitsu, but isn't sure yet — still investigating |
| **LLM price extraction** | Catalog number extracted as price (BUG-010) | Corporate data error — "can I trust this site at all?" | Takamaru misread the listing — a fumble, not fraud |
| **Translation** (Gemini 3 Flash) | Awkward or incorrect JP↔EN translation | Bad machine translation — cheap, careless, disrespectful | Takamaru's interpretation — earnest attempt, not a claim of authority |
| **Smart crop focal points** | Thumbnail focuses on background, not the sword | Broken image — technical incompetence | Takamaru looked at the wrong part of the photo |
| **School/province kanji** | Wrong kanji for a school name (happened 3x) | Factual error on a scholarly topic — offensive to experts | Takamaru is still learning the old records |
| **Scraper availability** | Listing marked sold when it's still available | "Your data is wrong" — fundamental distrust | Takamaru hasn't checked back with that dealer yet |
| **Featured score ranking** | Mediocre listing ranked above a Juyo masterpiece | Algorithmic incompetence — "this site doesn't understand swords" | Takamaru is still figuring out what matters most |

### The key psychological shift

**Without the fox:** NihontoWatch claims to know. When it's wrong, it claimed falsely. That's 不信感.

**With the fox:** Takamaru is doing its best to help. When it's wrong, a well-meaning scout made a mistake. That's 愛嬌. The collector's expertise remains the final authority. The fox defers to the human — it found something, brought it back, and the collector decides if the fox got it right.

This is the difference between:
- "NihontoWatch identifies this as Osafune Yasumitsu" (institutional claim → institutional liability)
- "Takamaru thinks this might be Osafune Yasumitsu" (scout's report → collector evaluates)

The fox doesn't replace accuracy. We still fix every error we find. But the fox changes the *relationship* between the user and the error — from betrayal to forgiveness.

### Confidence levels as Takamaru's certainty

The existing artisan confidence system (HIGH / MEDIUM / LOW) maps naturally to the fox's behavior:

| Confidence | Current Display | Takamaru Framing |
|------------|----------------|-----------------|
| HIGH | Green badge | Takamaru is confident — ears up, hoju bright |
| MEDIUM | Yellow badge | Takamaru thinks so, but wants to look closer — ears half-forward, hoju dim |
| LOW | Gray badge | Takamaru isn't sure — head tilted, hoju barely visible |
| Unmatched | No badge | Takamaru hasn't figured this one out yet |

This turns a cold probability score into an emotional signal that Japanese users intuitively understand: the fox is more or less sure, and you can see it in the fox's posture.

---

## Extended Lore (for About page, social, merch)

### Backstory

Takamaru is a young amber-furred fox who lives at a small Inari shrine near a nihonto dealer's workshop. Curious by nature, Takamaru began visiting sword shops, fascinated by the blades, the stories, the craftsmen. Over time, Takamaru developed an uncanny ability to sense exceptional pieces — a nose for quality that even experienced collectors respect.

Now Takamaru ranges across dozens of dealers, from the storied shops of Ginza to quiet workshops in the countryside to international galleries, bringing back word of treasures for those who seek them. The hoju — a gift from the shrine — glows brighter when something truly special is near. This is Takamaru's duty: to watch over nihonto, and to bring what the fox finds back to you. That duty has a name. NihontoWatch.

Sometimes Takamaru trips over a scabbard, or mistakes a reproduction for an original, or gets distracted by a particularly beautiful tsuba. But the fox always gets back up, shakes it off, and keeps looking. That's what scouts do.

### Seasonal Variants (Future)

Japanese culture marks seasons extensively. Takamaru could have seasonal illustrations:

| Season | Variant | Visual |
|--------|---------|--------|
| Spring (春) | Cherry blossom | Hoju glows pink, petals floating |
| Summer (夏) | Festival | Small chochin (lantern) instead of hoju |
| Autumn (秋) | Harvest | Carries rice sheaf (inaho), the alternative Inari held object |
| Winter (冬) | New Year | Wears a small shimenawa (sacred rope), hoju wrapped in gold |
| New Year | Kadomatsu | Seated beside a tiny kadomatsu arrangement |

---

## Name Alternatives Considered

| Name | Kanji | Meaning | Why not chosen |
|------|-------|---------|---------------|
| Konta | コン太 | Fox sound + friendly suffix | Too casual, yuru-chara energy |
| Inarimaru | 稲荷丸 | Inari + -maru | Too on-the-nose, sounds like a shrine, not a character |
| Tanko | 探狐 | "Searching fox" | Clever but reads as a compound noun, not a name |
| Houko | 宝狐 | "Treasure fox" | Unusual reading, could be misread as ほうこ |
| Tsurugi | つるぎ | "Sword" (archaic) | Too literal, no fox connection |

**Takamaru** won because:
1. Sounds like a sword name (natural -maru suffix)
2. "Treasure" (宝) connects to the hoju and to treasure-hunting
3. Phonetically pleasant in both Japanese and English
4. No existing character conflicts found
5. Works as both a formal name (宝丸) and a casual one ("Taka-chan")

---

## Implementation Phases

### Phase 1 — Brand Identity
- Commission illustration: primary seated pose + favicon mark
- Define exact color values for light/dark theme compatibility
- Integrate favicon and app icon
- Add to About page with brief introduction

### Phase 2 — UI Integration
- Loading state illustration (searching pose)
- Empty results illustration (puzzled pose)
- 404/error page illustration (stumbled pose)
- Email notification headers

### Phase 3 — Personality Layer
- Notification copy using Takamaru's voice
- Onboarding flow with Takamaru as guide
- Seasonal variants for homepage/social

### Phase 4 — Extended Brand
- Social media presence (Twitter/X, LINE)
- Sticker set for LINE (huge in Japan)
- Merch potential (tenugui, ema, pins)

---

## Illustrator Brief (for commissioning)

> **Character:** Takamaru (宝丸), a young white Inari fox. Scout and mascot for NihontoWatch, a Japanese sword aggregator website.
>
> **Species:** Zenko (善狐, benevolent shrine fox) — an Inari messenger fox.
>
> **Held object:** Kaen-hoju (火炎宝珠) — a small wish-fulfilling jewel wreathed in gentle flame, gold with warm orange edges. Carried in mouth or balanced on paw.
>
> **Color:** Warm amber fur (~`#c9a040` / `#d49040`, the NihontoWatch brand accent — "honey gold, almost orange"), cream-white undercoat (chest, belly, tail tip), amber/gold eyes, vermillion accent (bib or collar cord), gold hoju (slightly brighter than fur), ink-black nose/paw tips/ear tips/eye outlines.
>
> **Art style:** Clean, refined, ink-brush influence. Not chibi. Not hyper-realistic. Museum shop quality — the kind of illustration that belongs on a tenugui or a high-end ema. Confident lines, slight warmth, elegant but approachable.
>
> **Personality in posture:** Alert, diligent, quietly proud. Single raised tail. Ears forward. Bright eyes. A trusted companion, not a pet.
>
> **Poses needed (in priority order):**
> 1. **Primary/seated:** Upright, looking forward, hoju glowing gently — the "at your service" pose
> 2. **Searching:** Nose down, ears perked, tail level — actively scouting
> 3. **Found it:** Trotting forward, hoju bright, tail wagging — discovery delight
> 4. **Stumbled:** Hoju rolling away, sheepish but not defeated — endearing error state
> 5. **Presenting:** Both paws offering hoju forward, slight bow — omotenashi (gift/notification)
> 6. **Favicon:** Minimal fox face silhouette — white + vermillion, works at 16x16px
>
> **Must NOT resemble:** Konnosuke from Touken Ranbu (small, tan, chibi pipe fox). Our fox is full-sized, warm amber (brand-colored), dignified, refined.
>
> **Reference mood:** Inari shrine ema illustrations, Hokusai's fox prints (refined), Takeuchi Seiho animal paintings (warm), modern Japanese stamp/hanko design (clean).

---

## References

### Symbology
- Inari foxes carry four canonical objects: key (鍵), jewel (宝珠), rice sheaf (稲穂), scroll (巻物)
- Zenko (善狐, benevolent) vs. yako (野狐, trickster) — Takamaru is strictly zenko
- Zenko/yako distinction is carried by expression and posture, not fur color — modern Inari art spans white to amber to red-orange
- Byakko (白狐) hierarchy: tenko (heavenly) > kinko (gold) > ginko (silver) > byakko (white) > kokuko (black)
- Myobu (命婦): an Inari fox that has received imperial court rank — the most refined of all fox spirits
- Takamaru uses amber fur (~kinko register) rather than white to match NihontoWatch's brand accent

### -Maru Swords
- Kogarasu-maru (小烏丸) — attributed to Amakuni, Imperial Collection
- Onimaru (鬼丸) — one of the Tenka-Goken (Five Swords Under Heaven)
- Juzumaru (数珠丸) — another Tenka-Goken, carried by priest Nichiren
- Hizamaru (膝丸) — Minamoto no Yorimitsu's "Knee Cutter"

### Hoju (宝珠)
- Buddhist cintamani (wish-fulfilling jewel), onion-shaped with flame nimbus
- Appears on bridge railings (giboshi/擬宝珠), temple rooftops, votive art
- Kaen-hoju (火炎宝珠) = flame-wreathed variant, most visually distinctive

### Historical Kitsune in Nihonto
- Fox motifs appear in Edo-period tosogu: tsuba, menuki, kozuka engravings
- Kitsune is a legitimate nihonto decorative motif with material culture backing
