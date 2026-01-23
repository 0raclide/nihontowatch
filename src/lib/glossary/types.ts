// Japanese Sword Terminology Glossary Types

export type GlossaryCategory =
  | 'blade_types'
  | 'sugata'
  | 'kitae'
  | 'hamon'
  | 'boshi'
  | 'nakago'
  | 'horimono'
  | 'koshirae'
  | 'tosogu'
  | 'metalwork'
  | 'lacquer'
  | 'assessment'
  | 'documentation'
  | 'schools'
  | 'general';

export interface GlossaryEntry {
  /** Romanized term with proper capitalization (e.g., "Ko-itame") */
  term: string;
  /** Original romaji from glossary (lowercase) */
  romaji: string;
  /** Japanese characters */
  kanji?: string;
  /** Clear, concise definition */
  definition: string;
  /** Term category */
  category: GlossaryCategory;
}

export interface GlossaryMetadata {
  title: string;
  description: string;
  version: string;
  created: string;
  updated: string;
  total_terms: number;
}

export interface GlossaryData {
  _metadata: GlossaryMetadata;
  categories: Record<string, string>;
  terms: Array<{
    romaji: string;
    kanji?: string;
    category: string;
    definition: string;
  }>;
}

// Category display names for UI
export const CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  blade_types: 'Blade Types',
  sugata: 'Sugata (Shape)',
  kitae: 'Kitae (Forging)',
  hamon: 'Hamon (Temper)',
  boshi: 'Boshi (Tip)',
  nakago: 'Nakago (Tang)',
  horimono: 'Horimono (Carvings)',
  koshirae: 'Koshirae (Mountings)',
  tosogu: 'Tosogu (Fittings)',
  metalwork: 'Metalwork',
  lacquer: 'Lacquer',
  assessment: 'Assessment',
  documentation: 'Documentation',
  schools: 'Schools',
  general: 'General',
};
