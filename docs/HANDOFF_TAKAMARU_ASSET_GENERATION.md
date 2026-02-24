# Handoff: Takamaru Asset Generation

**Date:** 2026-02-22
**Status:** Ready to generate
**Design doc:** `docs/MASCOT_TAKAMARU.md`
**Prompts:** `assets/takamaru/prompts/` (12 files)
**Output:** `assets/takamaru/output/`

---

## What This Is

Takamaru (宝丸) is NihontoWatch's mascot — an amber-furred Inari fox whose duty *is* the NihontoWatch (watching over nihonto and bringing treasures to collectors). The character design, personality, lore, and UI integration points are fully documented. What remains is generating the visual assets from the prompt files.

## What's Done

- Full character design doc (`docs/MASCOT_TAKAMARU.md`) covering:
  - Identity and naming (宝丸 = "Treasure" + sword-naming suffix)
  - Core concept: "NihontoWatch is what the fox does, not a company that has a mascot"
  - Visual design spec: amber fur matching brand accent `#c9a040`→`#d49040`, cream undercoat, vermillion bib, gold hoju jewel
  - Personality: diligent scout, keen-nosed, occasionally clumsy (aikyo/愛嬌), loyal
  - Error culture & AI pipeline section: why the mascot is functional, not decorative — blame absorption for probabilistic AI systems in an error-intolerant culture
  - Conflict avoidance: clear differentiation from Touken Ranbu's Konnosuke
  - UI integration map: which poses appear where
  - Illustrator brief
  - Lore, seasonal variants, implementation phases

- 12 prompt files in `assets/takamaru/prompts/`:

| File | Pose | UI Context | Priority |
|------|------|-----------|----------|
| `00-style-reference.md` | — | Master visual DNA, read before all others | Required |
| `01-primary-seated.md` | Seated at attention, hoju in mouth | Brand identity, About page, social avatar | **P0 — generate first** |
| `02-searching.md` | Nose down, tracking scent | Loading states, "Searching..." | P1 |
| `03-found-it.md` | Trotting in, hoju blazing | New listing alerts, search results | P1 |
| `04-stumbled.md` | Tripped, hoju rolled away | 404, 500, failed requests | **P0 — most important for JA UX** |
| `05-presenting.md` | Offering hoju with bow | Price drop alerts, notifications | P1 |
| `06-empty-search.md` | Looking around, puzzled | Empty search results, no matches | P1 |
| `07-at-the-gate.md` | Seated at torii gate | Onboarding, welcome, About page | P2 |
| `08-favicon.md` | Fox face only, minimal mark | Favicon, app icon (16px–512px) | **P0 — brand mark** |
| `09-email-header.md` | Small centered stamp | Email notification banners | P2 |
| `10-confident.md` | Ears up, hoju bright (bust) | HIGH confidence artisan badge | P3 |
| `11-uncertain.md` | Head tilt, hoju dim (bust) | LOW confidence artisan badge | P3 |

## What Needs to Be Done

### Step 1: Generate Primary Seated Pose (01)

This is the reference image. All subsequent poses must match this character exactly. Run `01-primary-seated.md` through the image model. Iterate until:

- Fox reads as warm amber, not brown or yellow
- Vermillion bib is clearly visible
- Hoju is recognizable as an onion-shaped jewel with flame glow
- Expression is warm and dignified, not sly or cute
- Art style is ink-brush influenced — not chibi, not photorealistic, not anime
- Single tail only

Save the best result as the style reference for all future generations.

### Step 2: Generate Error Pose (04) and Favicon (08)

These are the other two P0 assets:

- **04-stumbled**: The gap between fox and dropped hoju is the storytelling device. The fox should look sheepish, not distressed. This is the aikyo (愛嬌) pose — charm through imperfection.
- **08-favicon**: Test at actual 16x16 and 32x32 pixel sizes. If the amber fur, ears, and bib don't read at those sizes, simplify further. The silhouette must be instantly "fox."

### Step 3: Generate Remaining P1 Poses (02, 03, 05, 06)

These are the core UI states. For each, verify visual consistency with the primary pose — same fur color, same bib, same face, same hoju design. The key differentiator between poses:

| Pose | Hoju Glow | Tail Position | Ears | Body |
|------|-----------|--------------|------|------|
| 02 Searching | Dim pulse | Level | Forward, alert | Leaning forward, nose down |
| 03 Found it | **Bright**, vivid flame | **High**, wagging | Up, forward | Trotting toward viewer |
| 05 Presenting | Steady glow | Curled to side | Softly forward | Seated, slight bow, paws extended |
| 06 Empty | Barely visible | Neutral | **Asymmetric** (one forward, one side) | Standing, head turned |

The hoju glow level is the primary emotional signal across all poses — bright = success, dim = working, barely there = uncertain, dropped = error.

### Step 4: Generate P2 and P3 Assets

- **07 At the Gate**: The only pose with a background element (torii). Keep the gate simple — one gate, vermillion, ink-brush rendered. The fox is the subject, not the architecture.
- **09 Email Header**: Wide banner format (~600x120). Fox is small and centered — a stamp, not a hero image. Must work in email clients that strip background colors.
- **10 Confident / 11 Uncertain**: These are a pair. Same bust crop, same framing, differentiated by ear position and hoju brightness. Must work at ~48-64px inline next to artisan badges.

### Step 5: Format for Integration

For each generated asset, produce:

| Format | Use | Notes |
|--------|-----|-------|
| PNG (transparent bg) | UI integration | Primary format for all poses |
| PNG on `#FAF7F2` | Light theme preview | Verify contrast |
| PNG on `#0e0d0c` | Dark theme preview | Verify contrast |
| SVG (if model supports) | Favicon, scaling | Preferred for 08-favicon |
| WebP (transparent) | Production serving | Smaller file size for web |

Recommended generation sizes:
- Full-body poses (01–07): 1024x1024 or 1024x1280 master, scale down as needed
- Favicon (08): 512x512 master → export 192, 32, 16
- Email banner (09): 1200x240 master (2x for retina)
- Bust crops (10, 11): 512x512 master → use at 48-128px

## Model Recommendations (Updated 2026-02-23)

### Model Landscape (Current)

| Model | Status | Best For | Transparent BG |
|-------|--------|----------|----------------|
| **Midjourney Niji 7** (Jan 2026) | Current | Highest aesthetic quality for illustrated/kawaii characters | No (post-process) |
| **Midjourney V7** (Jun 2025) | Current | Stylized characters, concept art | No (post-process) |
| **GPT Image 1.5** (Dec 2025) | Current | Best instruction following, native transparency | **Yes** (`background="transparent"` API param) |
| **Flux 2 Pro** / **Flux Kontext** | Current | Character consistency across poses without training | No (post-process) |
| **Google Imagen 3** | Current | Good all-rounder, animal companion customization | No |
| **DALL-E 3** | **Deprecated** (EOL May 2026) | — | — |
| **Midjourney V6** | Superseded | Still useful for `--cref` (not available in V7) | No |

### Recommended Pipeline

Use different models for different phases — no single model is best at everything:

| Phase | Model | Why | Command/Setting |
|-------|-------|-----|-----------------|
| **1. Design** (pose 01 anchor) | Midjourney Niji 7 | Best aesthetic for illustrated mascot work | `--niji 7 --style cute --ar 1:1` |
| **2. Style lock** | Midjourney | Extract `--sref` code from approved 01 | `--sref [code] --sw 100` on all subsequent |
| **3. Pose library** (02-11) | Flux Kontext | Edit anchor into new poses; preserves identity | "Change ONLY the pose to... Keep everything else identical" |
| **4. Transparent BG** | GPT Image 1.5 API | Native RGBA PNG, clean edges, no halos | `background="transparent", output_format="png", quality="high"` |
| **5. Fallback** | Midjourney Niji 6 + `--cref` | If Kontext struggles with a specific pose | `--cref [anchor URL] --cw 100` |
| **6. Nuclear option** | Train Flux Kontext LoRA | ~95% consistency from text alone, any pose | 15-20 images, trigger word "TAKAMARU" |

### Why This Pipeline

- **Niji 7** produces the highest aesthetic quality for this art style (ink-brush influenced kawaii). It has `--style cute` which is ideal for warm mascot characters, and better prompt precision than V7 for illustration work.
- **Flux Kontext** is the breakthrough for pose consistency. Instead of regenerating from text (which causes drift), you edit the approved anchor image with natural language: "Change the pose to searching, keep everything else identical." Character identity is preserved through the edit, not reconstructed from description.
- **GPT Image 1.5** is the only major model with native transparent background support via API. Others require post-processing with rembg/remove.bg which can cause edge halos — especially problematic on amber fur against warm backgrounds.

### Midjourney-Specific Settings

```
# Pose 01 (anchor — generate and iterate here)
[Character DNA block] --niji 7 --style cute --ar 1:1 --s 80

# Extract style reference from approved 01
# (use the seed or --sref code from the approved generation)

# Subsequent poses (if not using Kontext)
[Character DNA block + pose description] --niji 7 --style cute --ar 1:1 --sref [code] --sw 100

# V7 alternative (if you need the --oref workflow)
[prompt] --v 7 --oref [anchor URL] --ow 300

# Niji 6 fallback (for --cref character reference)
[prompt] --niji 6 --cref [anchor URL] --cw 100
```

**Important V7 gotchas:**
- V7 does NOT support `--cref` — it was replaced by `--oref` (Omni Reference)
- V7 `--oref` only accepts one reference image per prompt
- `--style raw` was V6; Niji 7 has `--style cute`, `--style expressive`, `--style scenic`
- Keyword stuffing produces worse results in V7 than natural sentences

### Flux Kontext Prompting

```
# Edit-based workflow (preferred for poses 02-11)
Take the character from the reference image and change ONLY the pose to:
[detailed pose description]. Keep the character's fur color, facial features,
vermillion bib, body proportions, and art style exactly the same.
Transparent background.

# Key rules:
# - Be explicit about what must NOT change
# - Specify the transformation clearly
# - One change at a time (pose OR expression, not both)
```

### GPT Image 1.5 API Settings

```python
response = client.images.generate(
    model="gpt-image-1.5",
    prompt="[Character DNA block + pose]",
    background="transparent",    # Native RGBA
    output_format="png",         # Required for transparency
    quality="high",              # Clean edges, fine detail
    size="1024x1024"             # Native resolution
)
```

### Google Imagen 3 Notes

If using Imagen 3 on Vertex AI:
- Supports `subject_type="animal_companion"` for few-shot character customization
- Provide 1-4 `SubjectReferenceImage` objects of approved 01
- Longer, more detailed prompts yield better results (unlike MJ where natural language wins)
- Best accessed via Vertex AI API, not consumer-facing tools

---

## Character DNA Block (Copy-Paste Into Every Prompt)

**This is the single most important technique for character consistency.** AI models have zero memory between generations. The exact same paragraph must appear verbatim in every prompt. Do not rephrase, reorder, or "improve" it between poses — identical text produces more consistent results than equivalent text.

```
TAKAMARU: A young Inari shrine fox (kitsune). Warm amber-gold fur (hex #c9a040
midtone, #d49040 highlights, #9A7209 shadows) with subtle tonal variation —
warmer on the back, lighter on the sides. Cream-white undercoat on chest, belly,
inner legs, tail tip, and inner ears (hex #F5F0E8, like old silk). Slender, elegant
young adult fox proportions — not chibi, not round, not puppy-like. Head is
fox-shaped with pointed muzzle and alert, intelligent expression. Eyes are
amber-gold (#C9A040) with a darker ring, slightly large for warmth but not
anime-large. Ears are large, triangular, black-tipped (#1C1C1C), standing upright.
Single fluffy tail (never multiple). Nose is small, black, triangular. Paw tips are
black. Wears a small vermillion red cloth bib (yodarekake) tied at the back of the
neck (hex #C73B3A, the color of Inari shrine torii gates). Carries a small kaen-hoju
(wish-fulfilling jewel) — onion/teardrop shaped with pointed top, gold body
(#D4AF37) with warm orange flame nimbus (#E8740C). Art style: Japanese ink-brush
influenced illustration with clean confident fude-brush lines — thicker on
contours, thinner on details. Museum gift shop quality, tenugui-grade. Warm and
approachable with dignity. Not chibi, not photorealistic, not anime, not flat vector.
```

**Rules for the DNA block:**
1. Paste it **identically** into every prompt — before the pose-specific section
2. Never rephrase between poses (even "better" phrasing causes drift)
3. Front-load it — all models weight earlier text more heavily
4. The pose-specific section comes AFTER the DNA block
5. If a pose needs to override something (e.g., tail position), state the override explicitly: "Tail held level (not raised)"

---

## Prompt Engineering Best Practices

### Structure (applies to all models)

```
[CHARACTER DNA BLOCK — identical every time]

[POSE SECTION — what's different in this pose]
Action, body position, expression, tail, ears, hoju glow level.

[STYLE REINFORCEMENT]
Same art style tokens as DNA block, plus any pose-specific rendering notes.

[ANTI-REFERENCES]
What this should NOT look like.

[COMPOSITION]
Framing, aspect ratio, background.
```

### Universal Rules

| Rule | Why | Example |
|------|-----|---------|
| **Front-load the subject** | All models weight earlier words more | DNA block first, then pose |
| **Positive phrasing only** | "No X" can paradoxically trigger X | "solid warm off-white background" not "no busy background" |
| **Concrete nouns > adjectives** | Less ambiguous | "vermillion cloth bib" not "red accessory" |
| **One change per generation** | Reduces drift | Change pose OR expression, not both vs anchor |
| **HEX codes work** | Especially in Flux and GPT Image | `primary fur color #c9a040` |
| **Lock art style on image one** | Never switch style descriptors mid-project | Copy-paste identical style block |
| **Restate EVERYTHING** | Models have zero memory between runs | Full DNA block + full style spec every time |

### Magic Words for Mascot Illustration

**Use these:**
- `Japanese ink-brush illustration` — triggers the right aesthetic
- `clean bold outlines` / `confident fude brush lines` — defined edges
- `museum gift shop illustration` / `tenugui design quality` — sets quality register
- `sticker design` — produces clean edges and natural cutout shapes (good for transparent BG)
- `professional illustration` — signals quality
- `flat color fills with subtle tonal variation` — prevents gradients while allowing depth

**Avoid these:**
- `photorealistic` / `hyperrealistic` — wrong aesthetic entirely
- `highly detailed` — adds unwanted texture
- `cinematic lighting` — creates 3D shading
- `3D render` / `octane render` — wrong dimension
- `kawaii` / `chibi` — too cute, wrong register (use only in Niji `--style cute` flag, not in prompt text)
- `anime` / `manga` — too close to Touken Ranbu territory

### Combating Character Drift

| Symptom | Cause | Fix |
|---------|-------|-----|
| Face changes between poses | Regenerating from text each time | Use Kontext edit workflow, not text-to-image |
| Fur color shifts to brown or yellow | Vague color words | Use HEX codes in every prompt: `#c9a040` |
| Art style drifts toward anime | Mixed style descriptors | Copy-paste identical style block, include anti-references |
| Proportions change (head too big) | Model "correcting" to kawaii | Add: "young adult fox proportions, head is proportional to body, not chibi" |
| Bib disappears | Too far down in prompt, model ignores | Move bib to DNA block, front-loaded |
| Hoju becomes a generic orb | Shape not specified clearly | "onion/teardrop shape with pointed top, like a Japanese bridge giboshi" |
| Multiple tails appear | Fox archetype association | "single fluffy tail (one tail only, never multiple)" — parenthetical reinforcement |

---

## Consistency Techniques (Ranked by Reliability)

| Rank | Method | Consistency | Effort | Best For |
|------|--------|-------------|--------|----------|
| 1 | **Flux Kontext LoRA** (train on 15-20 images) | ~95% | High (hours) | If you need pixel-perfect Takamaru in ANY pose from text |
| 2 | **Flux Kontext edit** (from anchor image) | ~90% | Low (minutes) | Poses 02-11 from approved 01 |
| 3 | **Midjourney `--cref`/`--oref`** (reference image) | ~85% | Low (minutes) | Alternative to Kontext for stubborn poses |
| 4 | **IP-Adapter + ControlNet** (SDXL/ComfyUI) | ~85% | Medium | If you need precise pose control via skeleton |
| 5 | **GPT Image 1.5 anchor + restate** (text only) | ~75% | Low | Transparent backgrounds, text-heavy needs |
| 6 | **Text-only DNA block** (no reference image) | ~60% | Lowest | Initial exploration before anchor is approved |

**Recommended for Takamaru:** Start at Rank 2 (Kontext edit) for most poses. Fall back to Rank 3 (MJ --cref) for poses where Kontext struggles. Consider Rank 1 (LoRA training) if you plan seasonal variants or future poses beyond the initial 11.

---

## Turnaround Sheet (Optional but Recommended)

Before generating all 11 poses, consider generating a **character turnaround sheet** — front, 3/4, side, back views of Takamaru in neutral standing pose. This establishes the character from all angles and prevents surprises when a pose requires a view you haven't generated before.

**Flux Kontext approach:**
1. Generate front-facing anchor (pose 01)
2. Edit: "Same character, rotated to show 3/4 view from the left"
3. Edit: "Same character, showing left side profile view"
4. Edit: "Same character, viewed from behind, showing back of bib knot and tail"

**ComfyUI approach:** Use the Flux Kontext Character Turnaround Sheet LoRA workflow — input single character image, outputs front/3/4/side/back automatically.

## Acceptance Criteria

A generated pose is ready for integration when:

1. **Character match**: Same fox across all poses — same fur color, face shape, bib, hoju design
2. **Color accuracy**: Amber fur reads as `#c9a040`–`#d49040` range, not brown, not yellow, not orange-red
3. **Bib visible**: Vermillion bib is recognizable in every pose (the Inari shrine signifier)
4. **Hoju readable**: The jewel reads as a distinct object, not a generic orb — onion/teardrop shape with flame
5. **Expression correct**: Each pose's emotional register matches spec (dignified, not cute; sheepish, not sad; puzzled, not defeated)
6. **Not chibi**: The fox has real fox proportions — slender, elegant, not round or big-headed
7. **Not Konnosuke**: Clearly a different character from Touken Ranbu's mascot (different size, color, style, register)
8. **Works at target size**: The pose reads correctly at its intended display size (especially 08, 10, 11)
9. **Transparent background**: Clean alpha channel, no fringing or halo artifacts

## Key Design Decisions (for context)

These decisions are documented in `docs/MASCOT_TAKAMARU.md` with full rationale:

- **Amber fur, not white**: Matches NihontoWatch brand accent (`--accent: #d49040`). The fox *is* the brand color. White would be canonical Inari (byakko) but disconnected from the brand palette.
- **"NihontoWatch is what the fox does"**: The brand name is the fox's duty. Nihonto (swords) + Watch (the fox's vigil). The amber "Watch" in the logo is Takamaru's color.
- **Hoju, not key/scroll/rice**: The wish-fulfilling jewel maps best to "find the sword you're looking for." The flame glow provides a storytelling device (brightness = confidence).
- **Vermillion bib**: The instant "Inari fox" signifier for Japanese viewers. Also provides critical color contrast against amber fur.
- **Single tail**: Shrine foxes have one tail. Multiple tails = yako/supernatural folklore, wrong register for a trusted brand.
- **Error state is the highest-priority JA asset**: The stumbled pose absorbs blame for AI pipeline failures in a culture where corporate errors create 不信感 (fushinkan, distrust). The fox's aikyo (愛嬌, charm through imperfection) converts system failure into forgivable fumble.

## Files

| File | Path |
|------|------|
| Design doc | `docs/MASCOT_TAKAMARU.md` |
| This handoff | `docs/HANDOFF_TAKAMARU_ASSET_GENERATION.md` |
| Style reference | `assets/takamaru/prompts/00-style-reference.md` |
| All prompts | `assets/takamaru/prompts/01-*.md` through `11-*.md` |
| Output directory | `assets/takamaru/output/` |
| README | `assets/takamaru/README.md` |
