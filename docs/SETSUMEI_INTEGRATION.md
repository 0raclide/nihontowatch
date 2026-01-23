# Setsumei Translation Integration Guide

**For:** Front-end integration
**Pipeline Version:** 3.6.0
**Last Updated:** January 2026

---

## Overview

The setsumei pipeline extracts and translates NBTHK certification papers (説明付図 / setsumei zufu) for Juyo and Tokubetsu Juyo items. This document describes the database fields and their structure for front-end integration.

---

## Database Fields

All setsumei data is stored in the `listings` table:

| Field | Type | Description |
|-------|------|-------------|
| `setsumei_image_url` | `text` | URL to the original setsumei image |
| `setsumei_text_ja` | `text` | Corrected Japanese OCR text |
| `setsumei_text_en` | `text` | English translation (Markdown) |
| `setsumei_metadata` | `jsonb` | Structured metadata (see below) |
| `setsumei_processed_at` | `timestamp` | When processing completed |
| `setsumei_pipeline_version` | `text` | Pipeline version (e.g., "3.6.0") |
| `setsumei_error` | `text` | Error message if processing failed |

---

## Checking for Setsumei Data

```sql
-- Items with setsumei translations
SELECT * FROM listings
WHERE setsumei_processed_at IS NOT NULL
  AND setsumei_text_en IS NOT NULL;

-- Items processed with latest pipeline
SELECT * FROM listings
WHERE setsumei_pipeline_version = '3.6.0';
```

**TypeScript check:**
```typescript
const hasSetsumei = (listing: Listing): boolean => {
  return !!listing.setsumei_text_en && !!listing.setsumei_metadata;
};
```

---

## English Translation Format (`setsumei_text_en`)

The translation is formatted as **Markdown** following NBTHK paper structure:

```markdown
## Juyo-Token, 68th Session — Designated November 2, 2022

Tachi, *mei*: Hidetsugu (秀次)

**Measurements**
Nagasa 70.9 cm, sori 1.3 cm

**Description**
*Keijo:* *shinogi-zukuri*, *iori-mune*; wide *mihaba*...
*Kitae:* *itame-hada* tightly forged; thick *ji-nie*...
*Hamon:* Based on *chu-suguha* with *ko-gunome* mixed in...
*Boshi:* In a *sugu* manner, turning back in a rounded shape.
*Horimono:* None.
*Nakago:* The file marks on the upper part have deteriorated...

**Artisan**
Hidetsugu, Saemon-no-jō, resident of Bitchū Province.

**Era**
Karyaku 2 (1327), late Kamakura period.

**Explanation**
Item No. 14936. This blade is a tachi signed...
```

**Rendering notes:**
- Use a Markdown renderer (e.g., `react-markdown`)
- Japanese terms are italicized: `*shinogi-zukuri*`
- Section headers use `**bold**`
- Kanji included in parentheses for key terms

---

## Metadata Structure (`setsumei_metadata`)

### Top-Level Fields

```typescript
interface SetsumeiMetadata {
  // Item classification
  item_type: "token" | "tosogu" | "ensemble";
  blade_type?: string;  // katana, wakizashi, tanto, tachi, etc.

  // Core data
  smith: SmithInfo;
  designation: DesignationInfo;
  measurements: MeasurementsInfo;
  attribution: AttributionInfo;
  era: EraInfo;
  mei: MeiInfo;

  // Assessment
  assessment: AssessmentInfo;
  condition: ConditionInfo;

  // Pipeline metadata
  pipeline_info: PipelineInfo;
}
```

### Smith Info

```typescript
interface SmithInfo {
  name_romaji: string | null;     // "Hidetsugu"
  name_kanji: string | null;      // "秀次"
  school: string | null;          // "Aoe"
  tradition: string | null;       // "Bizen"
  generation: string | null;      // "shodai", "nidai"
  active_period: string | null;   // "late Kamakura"
  residence: string | null;       // "Bitchu"
  genealogy?: {
    rank_title: string | null;    // "Saemon-no-jo"
    common_name: string | null;
  };
}
```

### Designation Info

```typescript
interface DesignationInfo {
  classification: "juyo" | "tokubetsu-juyo";
  session_number: number;         // 68
  date: {
    western: string;              // "2022-11-02"
    nengo: string;                // "Reiwa"
    nengo_year: number;           // 4
    _original?: string;           // "令和四年十一月二日"
  };
}
```

### Measurements Info

```typescript
interface MeasurementsInfo {
  nagasa: number | null;          // cm
  sori: number | null;            // cm
  motohaba: number | null;        // cm
  sakihaba: number | null;        // cm
  kissaki_nagasa: number | null;  // cm
  nakago_nagasa: number | null;   // cm
  kasane: number | null;          // cm (thickness)
}
```

### Attribution Info

```typescript
interface AttributionInfo {
  basis: "signed" | "kinzogan" | "kiwame" | "stylistic" | "school-attribution";
  confidence: "certain" | "strong" | "probable" | "suggested";
  kiwame_contradicted?: boolean;
  scholarly_consensus?: string;
  notes?: string;
}
```

### Mei (Signature) Info

```typescript
interface MeiInfo {
  status: "signed" | "signed and dated" | "mumei" | "orikaeshi-mei" | "kinzogan-mei";
  inscription_omote?: string;     // Front inscription
  inscription_ura?: string;       // Back inscription
}
```

### Assessment Info

```typescript
interface AssessmentInfo {
  praise_tags: string[];          // ["tight ko-itame", "deep nioi", "sunagashi"]
  significance?: string;          // "excellent", "representative"
}
```

### Pipeline Info

```typescript
interface PipelineInfo {
  version: string;                // "3.6.0"
  ocr_source: "corrected" | "raw_fallback";
  refusal_detected: boolean;
  processing_time_ms: number;
}
```

---

## Example: Full Metadata Object

```json
{
  "item_type": "token",
  "blade_type": "tachi",
  "smith": {
    "name_romaji": "Hidetsugu",
    "name_kanji": "秀次",
    "school": null,
    "tradition": null,
    "generation": null,
    "active_period": null,
    "residence": "Bitchu",
    "genealogy": {
      "rank_title": "Saemon-no-jo",
      "common_name": null
    }
  },
  "designation": {
    "classification": "juyo",
    "session_number": 68,
    "date": {
      "western": "2022-11-02",
      "nengo": "Reiwa",
      "nengo_year": 4,
      "_original": "令和四年十一月二日"
    }
  },
  "measurements": {
    "nagasa": 70.9,
    "sori": 1.3,
    "motohaba": null,
    "sakihaba": null,
    "kissaki_nagasa": null,
    "nakago_nagasa": null,
    "kasane": null
  },
  "attribution": {
    "confidence": "certain",
    "basis": "signed",
    "kiwame_contradicted": false,
    "scholarly_consensus": "Widely accepted",
    "notes": "Signed and dated inscription present on the nakago."
  },
  "mei": {
    "status": "signed and dated"
  },
  "assessment": {
    "praise_tags": ["signed", "dated"],
    "significance": null
  },
  "era": {
    "nengo": "Karyaku",
    "nengo_year": 2,
    "period": "Kamakura",
    "sub_period": "late",
    "western_year": 1327
  },
  "pipeline_info": {
    "version": "3.6.0",
    "ocr_source": "corrected",
    "refusal_detected": false,
    "processing_time_ms": 70576
  }
}
```

---

## Front-End Display Recommendations

### 1. Setsumei Badge

Show a badge on listing cards when setsumei is available:

```tsx
{listing.setsumei_text_en && (
  <Badge variant="outline">説明付図 EN</Badge>
)}
```

### 2. Translation Tab/Section

Add a "Setsumei Translation" tab on listing detail pages:

```tsx
<Tabs>
  <Tab label="Details">...</Tab>
  <Tab label="Setsumei Translation" disabled={!hasSetsumei}>
    <ReactMarkdown>{listing.setsumei_text_en}</ReactMarkdown>
  </Tab>
</Tabs>
```

### 3. Metadata Display

Use structured metadata for key facts:

```tsx
<dl>
  <dt>Smith</dt>
  <dd>{metadata.smith?.name_romaji} ({metadata.smith?.name_kanji})</dd>

  <dt>Designation</dt>
  <dd>Juyo Session {metadata.designation?.session_number}</dd>

  <dt>Nagasa</dt>
  <dd>{metadata.measurements?.nagasa} cm</dd>

  <dt>Attribution</dt>
  <dd>{metadata.attribution?.basis} ({metadata.attribution?.confidence})</dd>
</dl>
```

### 4. Praise Tags

Display as chips/badges:

```tsx
{metadata.assessment?.praise_tags?.map(tag => (
  <Chip key={tag} size="sm">{tag}</Chip>
))}
```

---

## Querying Examples

### Get all Juyo items with setsumei translations

```typescript
const { data } = await supabase
  .from('listings')
  .select('*')
  .not('setsumei_text_en', 'is', null)
  .in('cert_type', ['Juyo', 'Tokubetsu Juyo']);
```

### Filter by session number (from metadata)

```typescript
const { data } = await supabase
  .from('listings')
  .select('*')
  .not('setsumei_metadata', 'is', null)
  .filter('setsumei_metadata->designation->session_number', 'gte', 50);
```

### Get items by smith school

```typescript
const { data } = await supabase
  .from('listings')
  .select('*')
  .ilike('setsumei_metadata->smith->school', '%Bizen%');
```

---

## Statistics (as of January 2026)

| Metric | Value |
|--------|-------|
| Total items with setsumei | 195 |
| Pipeline version | 3.6.0 |
| OCR correction rate | 99% |
| Refusal rate | 0% |
| Avg processing time | ~70s |

---

## Related Files

- **Pipeline source:** `/Oshi-scrapper/setsumei/`
- **Type definitions:** `/Oshi-scrapper/setsumei/types.py`
- **Reprocessing script:** `/Oshi-scrapper/scripts/reprocess_setsumei.py`
