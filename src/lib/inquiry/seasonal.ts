/**
 * Japanese Seasonal Greetings (時候の挨拶)
 *
 * In Japanese business correspondence, it's customary to begin
 * with a seasonal greeting that acknowledges the time of year.
 * This creates a sense of shared experience and cultural awareness.
 */

// =============================================================================
// Types
// =============================================================================

export interface SeasonalGreeting {
  /** Season name in English */
  season: string;
  /** Japanese month name */
  monthName: string;
  /** Formal seasonal phrase (for business letters) */
  formalPhrase: string;
  /** Casual seasonal phrase (optional) */
  casualPhrase: string;
  /** English translation of the formal phrase */
  translation: string;
}

// =============================================================================
// Seasonal Greetings by Month
// =============================================================================

/**
 * Japanese seasonal greetings for each month
 * These follow traditional Japanese business letter conventions
 */
const MONTHLY_GREETINGS: Record<number, SeasonalGreeting> = {
  1: {
    season: 'New Year',
    monthName: '一月 (Ichigatsu)',
    formalPhrase: '新春の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '新年あけましておめでとうございます',
    translation: 'In this season of the new year, I hope your business continues to prosper.',
  },
  2: {
    season: 'Late Winter',
    monthName: '二月 (Nigatsu)',
    formalPhrase: '余寒の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: 'まだまだ寒い日が続きますが',
    translation: 'In this season of lingering cold, I hope your business continues to prosper.',
  },
  3: {
    season: 'Early Spring',
    monthName: '三月 (Sangatsu)',
    formalPhrase: '早春の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '春の気配を感じる頃となりました',
    translation: 'In this early spring season, I hope your business continues to prosper.',
  },
  4: {
    season: 'Spring',
    monthName: '四月 (Shigatsu)',
    formalPhrase: '陽春の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '桜の美しい季節となりました',
    translation: 'In this warm spring season, I hope your business continues to prosper.',
  },
  5: {
    season: 'Late Spring',
    monthName: '五月 (Gogatsu)',
    formalPhrase: '新緑の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '新緑の美しい季節となりました',
    translation: 'In this season of fresh greenery, I hope your business continues to prosper.',
  },
  6: {
    season: 'Early Summer',
    monthName: '六月 (Rokugatsu)',
    formalPhrase: '初夏の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '梅雨の季節となりました',
    translation: 'In this early summer season, I hope your business continues to prosper.',
  },
  7: {
    season: 'Summer',
    monthName: '七月 (Shichigatsu)',
    formalPhrase: '盛夏の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '暑い日が続いておりますが',
    translation: 'In this midsummer season, I hope your business continues to prosper.',
  },
  8: {
    season: 'Late Summer',
    monthName: '八月 (Hachigatsu)',
    formalPhrase: '残暑の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '暑さ厳しい折',
    translation: 'In this season of lingering summer heat, I hope your business continues to prosper.',
  },
  9: {
    season: 'Early Autumn',
    monthName: '九月 (Kugatsu)',
    formalPhrase: '初秋の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '秋の気配を感じる頃となりました',
    translation: 'In this early autumn season, I hope your business continues to prosper.',
  },
  10: {
    season: 'Autumn',
    monthName: '十月 (Jugatsu)',
    formalPhrase: '秋冷の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '秋も深まってまいりました',
    translation: 'In this cool autumn season, I hope your business continues to prosper.',
  },
  11: {
    season: 'Late Autumn',
    monthName: '十一月 (Juichigatsu)',
    formalPhrase: '晩秋の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '朝夕冷え込む季節となりました',
    translation: 'In this late autumn season, I hope your business continues to prosper.',
  },
  12: {
    season: 'Winter',
    monthName: '十二月 (Junigatsu)',
    formalPhrase: '師走の候、貴社ますますご清栄のこととお慶び申し上げます',
    casualPhrase: '年の瀬も押し迫ってまいりました',
    translation: 'In this year-end season, I hope your business continues to prosper.',
  },
};

// =============================================================================
// Functions
// =============================================================================

/**
 * Get the seasonal greeting for the current month
 *
 * @param date - Optional date to use (defaults to current date)
 * @returns Seasonal greeting data for the month
 */
export function getSeasonalGreeting(date: Date = new Date()): SeasonalGreeting {
  const month = date.getMonth() + 1; // JS months are 0-indexed
  return MONTHLY_GREETINGS[month] || MONTHLY_GREETINGS[1];
}

/**
 * Get the formal seasonal phrase for the current month
 *
 * @param date - Optional date to use
 * @returns The formal Japanese greeting phrase
 */
export function getFormalGreeting(date: Date = new Date()): string {
  return getSeasonalGreeting(date).formalPhrase;
}

/**
 * Get all seasonal greetings (for reference/testing)
 *
 * @returns All monthly greetings
 */
export function getAllGreetings(): Record<number, SeasonalGreeting> {
  return { ...MONTHLY_GREETINGS };
}

/**
 * Get greeting context for AI prompt
 *
 * @param date - Optional date to use
 * @returns Formatted context string for AI prompt
 */
export function getGreetingContext(date: Date = new Date()): string {
  const greeting = getSeasonalGreeting(date);
  return `Current season: ${greeting.season} (${greeting.monthName})
Suggested seasonal greeting: ${greeting.formalPhrase}
Translation: ${greeting.translation}`;
}
