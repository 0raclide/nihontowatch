# Handoff: School/Province Kanji Translations for JA Locale

**Date:** 2026-02-22
**Source:** oshi-v2 audit (migration 401)
**Affects:** `/artists` page — school filter sidebar, artist card subtitles, mobile filters

## Problem

The `/artists` page in JA locale shows **101 of 128 sword school names** and **many tosogu school names** in romaji instead of kanji. The `td('school', value)` translation function works correctly — the issue is that `ja.json` only has 63 `school.*` keys while the `get_directory_enrichment` RPC returns **197 distinct school values** (128 sword + 69 tosogu).

**Example:** Sidebar shows "Ko-Bizen 75" instead of "古備前 75" in JA locale.

The `td()` fallback logic (`return r === k ? v : r`) correctly falls back to the raw romaji value when no translation key exists.

## Root Cause

The original `ja.json` translations were added for the ~63 most common schools. Since then, the artisan directory grew from enrichment migrations (384–400) adding many more schools.

## Fix Required

Add the following translation keys to `/src/i18n/locales/ja.json` (and corresponding identity mappings to `en.json`).

### Prerequisites (oshi-v2 side — already done)

Migration 401 in oshi-v2 fixes:
1. **23 artisan_schools** with romaji stored in `name_kanji` field → now proper kanji
2. **33 artisan_schools** with NULL `name_kanji` → now populated
3. **3 truncated province values** in artisan_makers + smith_entities:
   - `Bitch` → `Bitchu` (557 records)
   - `Etch` → `Etchu` (159 records)
   - `Hy` → `Hyuga` (33 records)

After migration 401 is deployed, the province facet values will change. The existing `province.Bitchu`, `province.Etchu`, `province.Hyuga` keys in `ja.json` already handle these correctly. The broken truncated values will simply stop appearing.

---

## School Translation Keys to Add

### Sword Schools (101 missing)

Add to `ja.json` after the existing `school.*` block (line ~843):

```json
  "school.Fukuoka Ichimonji": "福岡一文字",
  "school.Ko-Aoe": "古青江",
  "school.Chu-Aoe": "中青江",
  "school.Sa": "左",
  "school.Hizen Tadayoshi": "肥前忠吉",
  "school.Suishinshi Masahide": "水心子正秀",
  "school.Enju": "延寿",
  "school.Yoshii": "吉井",
  "school.Horikawa": "堀川",
  "school.Sanjo": "三条",
  "school.Hatakeda": "畠田",
  "school.Ko-Ichimonji": "古一文字",
  "school.Omiya": "大宮",
  "school.Oei-Bizen": "応永備前",
  "school.Nio": "二王",
  "school.Mishina": "三品",
  "school.Senoo": "妹尾",
  "school.Seki": "関",
  "school.Soden-Bizen": "相伝備前",
  "school.Takada": "高田",
  "school.Naoe Shizu": "直江志津",
  "school.Yoshioka Ichimonji": "吉岡一文字",
  "school.Hosho": "保昌",
  "school.Sue-Soshu": "末相州",
  "school.Hoki": "伯耆",
  "school.Ukai": "鵜飼",
  "school.Shimosaka": "下坂",
  "school.Ayanokoji": "綾小路",
  "school.Kiyomaro": "清麿",
  "school.Sue-Aoe": "末青江",
  "school.Yamashiro Nobukuni": "山城信国",
  "school.Ishido": "石堂",
  "school.Sengo": "千子",
  "school.Katayama Ichimonji": "片山一文字",
  "school.Katsumitsu": "勝光",
  "school.Iwato Ichimonji": "岩戸一文字",
  "school.Miike": "三池",
  "school.Sue-Naminohira": "末波平",
  "school.Chiyozuru": "千代鶴",
  "school.Chikuzen": "筑前",
  "school.Heianjo": "平安城",
  "school.Sukesada": "祐定",
  "school.Ko-Mihara": "古三原",
  "school.Kongobyoe": "金剛兵衛",
  "school.Shimada": "島田",
  "school.Mizuta": "水田",
  "school.Monju": "文珠",
  "school.Mino Senjuin": "美濃千手院",
  "school.Kamakura Ichimonji": "鎌倉一文字",
  "school.Mito (Swordsmiths)": "水戸鍛冶",
  "school.Ryokai": "了戒",
  "school.Mogusa": "舞草",
  "school.Momokawa": "百川",
  "school.Osaka Shinto": "大坂新刀",
  "school.Motoshige": "元重",
  "school.Nakajima Rai": "中島来",
  "school.Hirado Sa": "平戸左",
  "school.Saburo Kunimune": "三郎国宗",
  "school.Shimbo": "新保",
  "school.Kokaji": "小鍛冶",
  "school.Zensho": "善正",
  "school.Bungo": "豊後",
  "school.Daruma": "達磨",
  "school.Dotanuki": "同田貫",
  "school.Gojo": "五条",
  "school.Inoue": "井上",
  "school.Iruka": "入鹿",
  "school.Kashu Kanewaka": "加州兼若",
  "school.Kiyomitsu": "清光",
  "school.Ko-Naminohira": "古波平",
  "school.Kokubunji": "国分寺",
  "school.Kotetsu": "虎徹",
  "school.Sakakura Seki": "坂倉関",
  "school.Shitahara": "下原",
  "school.Taniyama": "谷山",
  "school.Tsuda": "津田",
  "school.Goami": "五阿弥",
  "school.Kurama Seki": "鞍馬関",
  "school.Koyama Munetsugu": "固山宗次",
  "school.Ko-Yamato": "古大和",
  "school.Yamato Shizu": "大和志津",
  "school.Ko-Kyo": "古京",
  "school.Ko-Kongobyoe": "古金剛兵衛",
  "school.Kato Tsunahide": "加藤綱英",
  "school.Sue-Sa": "末左",
  "school.Kaifu": "海部",
  "school.Kai Mihara": "甲斐三原",
  "school.Kagashiro": "加賀四郎",
  "school.Takagi": "高木",
  "school.Edo Ishido": "江戸石堂",
  "school.Tokujiro": "徳次郎",
  "school.Echizen Seki": "越前関",
  "school.Tsukushi Nobukuni": "筑紫信国",
  "school.Hashizume": "橋爪",
  "school.Hankei": "繁慶",
  "school.Yamamura": "山村",
  "school.Sanami": "佐波",
  "school.Ryumon": "龍門",
  "school.Osaka Gassan": "大阪月山",
  "school.Naomune": "直宗",
  "school.Shigezane": "重真",
```

### Tosogu Schools (additional missing)

These tosogu schools are not yet in `ja.json`:

```json
  "school.Waki-Goto": "脇後藤",
  "school.Ichijo": "一乗",
  "school.Otsuki": "大月",
  "school.Murakami": "村上",
  "school.Toryusai": "東龍斎",
  "school.Tetsugendo": "鉄元堂",
  "school.Ito": "伊藤",
  "school.Kikuoka": "菊岡",
  "school.Natsuo / Tokyo Fine Arts": "夏雄 / 東京美術学校",
  "school.Tsuchiya": "土屋",
  "school.Yanagawa": "柳川",
  "school.Egawa": "江川",
  "school.Ichinomiya": "一宮",
  "school.Kaga-Goto": "加賀後藤",
  "school.Kamiyoshi": "神吉",
  "school.Nagasone": "長曽禰",
  "school.Nishigaki": "西垣",
  "school.Ozaki": "尾崎",
  "school.Sonobe": "園部",
  "school.Hazama": "間",
  "school.Hayashi": "林",
  "school.Kaneie": "金家",
  "school.Yoshioka": "吉岡",
  "school.Tanaka": "田中",
  "school.Sano": "佐野",
  "school.Nomura": "野村",
  "school.Nanban": "南蛮",
  "school.Kanayama": "金山",
  "school.Furukawa": "古川",
  "school.Nobuie": "信家",
  "school.Oda": "小田",
  "school.Kamakura": "鎌倉",
  "school.Kagamishi": "鏡師",
  "school.Kaga zogan": "加賀象嵌",
  "school.Yasuda": "安田",
  "school.Shimizu": "志水",
  "school.Ezo": "蝦夷",
  "school.Takahashi": "高橋",
  "school.Hoan": "法安",
  "school.Heianjo-Zogan": "平安城象嵌",
  "school.Kikuchi": "菊池",
  "school.Kikugawa": "菊川",
  "school.Katsura": "桂",
  "school.Ko-Goto": "古後藤",
  "school.Ko-Hagi": "古萩",
  "school.Ko-kinko": "古金工",
  "school.Ko-Katchushi": "古甲冑師",
  "school.Ko-Mino": "古美濃",
  "school.Ko-tosho": "古刀匠",
  "school.Kyo-kanagushi": "京金具師",
  "school.Mito": "水戸",
  "school.Katchushi": "甲冑師",
  "school.Myochin": "明珍",
  "school.Yamakichi": "山吉",
```

### Province Keys to Add (6 new)

After migration 401 fixes the 3 truncated values, add these remaining new provinces:

```json
  "province.Iwaki": "磐城",
  "province.Iwashiro": "岩代",
  "province.Kyoto": "京都",
  "province.Osaka": "大阪",
  "province.Rikuchu": "陸中",
  "province.Tamba": "丹波",
```

Note: `province.Tanba` already exists in `ja.json` but some DB records use the spelling "Tamba". Add both to be safe — they map to the same kanji 丹波.

### en.json (identity mappings)

For `en.json`, add identity mappings for all new keys. Example format:

```json
  "school.Fukuoka Ichimonji": "Fukuoka Ichimonji",
  "school.Ko-Aoe": "Ko-Aoe",
  ...
```

This is needed so the `td()` fallback check (`r === k ? v : r`) works correctly — without an en.json entry, the English fallback returns the key string `"school.Fukuoka Ichimonji"` which doesn't equal the value `"Fukuoka Ichimonji"`, so it accidentally returns the key as the "translated" value.

Actually — looking at the `t()` function more carefully:
```typescript
let value = locales[locale]?.[key] ?? locales.en[key] ?? key;
```
If `en.json` doesn't have the key, it falls back to the raw key string (`"school.Fukuoka Ichimonji"`). The `td()` check then does `r === k` which is `"school.Fukuoka Ichimonji" === "school.Fukuoka Ichimonji"` → true, so it returns the raw value. **This means en.json entries are optional** — the fallback already works. But adding them is good practice for consistency.

---

## Files to Modify

1. **`/src/i18n/locales/ja.json`** — Add all `school.*` and `province.*` keys above
2. **`/src/i18n/locales/en.json`** — Add identity mappings (optional but recommended)

## Testing

After adding the keys:
1. Visit `/artists` in JA locale
2. School filter sidebar should show kanji (e.g., "古備前 75" not "Ko-Bizen 75")
3. Artist card subtitles should show kanji (e.g., "平安 · 備前" not "Heian · Bizen")
4. Province filter should show kanji
5. Switch to EN locale — should show romaji (unchanged behavior)

## Data Source

All kanji values were sourced from:
1. `artisan_schools.name_kanji` in the Yuhinkai database (after migration 401 fixes)
2. Standard nihonto terminology references for values not in the DB

## Related

- `docs/HANDOFF_ARTISTS_PAGE_LOCALIZATION.md` — Original localization handoff (Issues #1–#4)
- oshi-v2 migration 401 — DB-side kanji fixes
