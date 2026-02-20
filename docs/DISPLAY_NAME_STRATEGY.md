# Display Name Deduplication — Strategy & Changelog

Source of truth: `src/lib/artisan/displayName.ts`
Tests: `tests/lib/artisan/displayName.test.ts`

---

## The Problem

The Yuhinkai database stores `school` (legacy_school_text) and `name_romaji` separately. Naively concatenating them produces duplicates:

| School | Name | Naive result | Correct |
|--------|------|-------------|---------|
| Gotō | Gotō | Gotō Gotō | Gotō |
| Gotō | Gotō Renjō | Gotō Gotō Renjō | Gotō Renjō |
| Ichijō | Gotō Ichijō | Ichijō Gotō Ichijō | Gotō Ichijō |
| Hizen Tadayoshi | Tadahiro | Hizen Tadayoshi Tadahiro | Hizen Tadahiro |
| Waki-Gotō | Gotō Ichijō | Waki-Gotō Gotō Ichijō | Gotō Ichijō |

Two mechanisms fix these: **dedup rules** (automatic, pattern-based) and **aliases** (manual overrides for specific artisan codes).

---

## Dedup Rules (Applied in Order)

| Rule | Condition | Result | Example |
|------|-----------|--------|---------|
| **Slash** | School contains "/" | No prefix, just name | "Natsuo / Tokyo Fine Arts" + "Shomin" → "Shomin" |
| **1** | school == name (macron-normalized) | No prefix | "Gotō" + "Gotō" → "Gotō" |
| **2** | Name starts with school (word boundary) | No prefix, just name | "Gotō" + "Gotō Renjō" → "Gotō Renjō" |
| **2b** | School starts with name (word boundary) | No prefix, show school | "Oishi Sa" + "Oishi" → "Oishi Sa" |
| **3** | School ends with name (space/hyphen) | No prefix, show school | "Sue-Naminohira" + "Naminohira" → "Sue-Naminohira" |
| **3b** | Name is a token in school | No prefix, show school | "Bizen Osafune" + "Osafune" → "Bizen Osafune" |
| **3c** | School is a token in name | No prefix, show name | "Ichijō" + "Gotō Ichijō" → "Gotō Ichijō" |
| **4** | Lineage substitution (4+ char root match) | Strip founder, keep prefix | "Horikawa Kunihiro" + "Kunitomo" → "Horikawa Kunitomo" |
| **5** | Geographic prefix (province/city) | Strip geography | "Osaka Gassan" + "Sadakazu" → "Gassan Sadakazu" |
| **6** | Default | School as prefix | "Osafune" + "Kanemitsu" → "Osafune Kanemitsu" |

---

## Artisan Aliases (Manual Overrides)

These bypass all dedup rules. Used when the collector-standard name differs from the Yuhinkai data.

| Code | Alias | Yuhinkai Name | School | Why Override? |
|------|-------|---------------|--------|--------------|
| `KAN1670` | Kencho | Kanenaga | Osafune | Known by era name "Kencho Kanenaga", not "Osafune Kanenaga" |
| `KUN539` | Shintogo Kunimitsu | Kunimitsu | Sōshū | Known as "Shintogo" (founder prefix), not "Soshu" school prefix |
| `KUN636` | Saburo Kunimune | Kunimune | Naomune | Known by personal name "Saburo", not school "Naomune" |
| `GOT042` | Goto Ichijo | Gotō Ichijō | Ichijō / Waki-Gotō | Known as "Goto Ichijo", school prefix is redundant or wrong |

---

## Changelog

| Date | Change | Artisan | Rule/Alias |
|------|--------|---------|------------|
| 2026-02-19 | Initial implementation | — | Rules 1-6 |
| 2026-02-20 | Added GOT042 alias | Goto Ichijo | Alias (commit f8670c8) |
| 2026-02-20 | Added Rule 3c, fixed macron comparison | Goto Ichijo | Rule 3c + norm() export |

---

## Decision Guide: Rule vs Alias

### Add a **rule** when:
- The pattern is **structural** — the school/name overlap follows a predictable pattern
- Multiple artisans would benefit (e.g., all artisans where school = last word of name)
- The fix can be described as "if X relationship between school and name, then Y"

### Add an **alias** when:
- The collector-standard name **differs entirely** from the Yuhinkai data
- The name involves a historical/personal title (era name, personal name, pseudonym)
- No structural rule can capture this — it's specific to one person
- Examples: "Kencho" (era name), "Shintogo" (historical founder prefix)

### Workflow for new display name issues:
1. Check if an existing rule should have caught it (bug in rule logic)
2. If a rule COULD catch it generically, add/modify a rule
3. If it's a one-off historical name, add an alias to `ARTISAN_ALIASES`
4. Add a test to `tests/lib/artisan/displayName.test.ts`
5. Update the changelog above

---

## Integration Points

The display name system is consumed in 4 places:

| Location | Pattern |
|----------|---------|
| Browse API (`api/browse/route.ts`) | `getArtisanAlias(id) \|\| getArtisanDisplayName(name, school)` |
| Listing Detail (`lib/listing/getListingDetail.ts`) | Same pattern |
| Artisan Listings API (`api/artisan/[code]/listings`) | Same pattern |
| Artist Page h1 (`artists/[slug]/ArtistPageClient.tsx`) | `getArtisanDisplayParts()` + `getArtisanAlias()` + `norm()` comparison |

The artist page uses `norm()` for macron-safe comparison between alias and computed name.

---

## Known Edge Cases

- **Waki-Goto hyphen**: "Waki-Goto" is one token (hyphenated), so "Goto" inside it doesn't trigger Rule 3c. The GOT042 alias handles this.
- **Short school names**: One-character school names (e.g., "Sa") could match in unexpected places. The token-based matching (whitespace/hyphen split) prevents false positives.
- **Multi-word schools with "/"**: Treated as "display only name" (no prefix). This handles institutional names like "Natsuo / Tokyo Fine Arts".
