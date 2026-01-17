/**
 * Comprehensive unit tests for search text normalization and alias expansion functions
 * Tests: removeMacrons, normalizeSearchText, expandSearchAliases, toTraditionalKanji, prepareSearchQuery
 */
import { describe, it, expect } from 'vitest';
import {
  removeMacrons,
  normalizeSearchText,
  expandSearchAliases,
  toTraditionalKanji,
  prepareSearchQuery,
  hasKanjiVariants,
  getSearchVariants,
} from '@/lib/search/textNormalization';

// =============================================================================
// removeMacrons
// =============================================================================

describe('removeMacrons', () => {
  describe('basic macron conversion', () => {
    it('converts lowercase macron o to o', () => {
      expect(removeMacrons('ō')).toBe('o');
    });

    it('converts lowercase macron u to u', () => {
      expect(removeMacrons('ū')).toBe('u');
    });

    it('converts lowercase macron a to a', () => {
      expect(removeMacrons('ā')).toBe('a');
    });

    it('converts lowercase macron e to e', () => {
      expect(removeMacrons('ē')).toBe('e');
    });

    it('converts lowercase macron i to i', () => {
      expect(removeMacrons('ī')).toBe('i');
    });

    it('converts uppercase macron O to O', () => {
      expect(removeMacrons('Ō')).toBe('O');
    });

    it('converts uppercase macron U to U', () => {
      expect(removeMacrons('Ū')).toBe('U');
    });

    it('converts uppercase macron A to A', () => {
      expect(removeMacrons('Ā')).toBe('A');
    });

    it('converts uppercase macron E to E', () => {
      expect(removeMacrons('Ē')).toBe('E');
    });

    it('converts uppercase macron I to I', () => {
      expect(removeMacrons('Ī')).toBe('I');
    });
  });

  describe('real-world Japanese romanization', () => {
    it('converts Gotō to Goto', () => {
      expect(removeMacrons('Gotō')).toBe('Goto');
    });

    it('converts Tōkyō to Tokyo', () => {
      expect(removeMacrons('Tōkyō')).toBe('Tokyo');
    });

    it('converts Ōsaka to Osaka', () => {
      expect(removeMacrons('Ōsaka')).toBe('Osaka');
    });

    it('converts Kyūshū to Kyushu', () => {
      expect(removeMacrons('Kyūshū')).toBe('Kyushu');
    });

    it('converts Sōshū-den to Soshu-den', () => {
      expect(removeMacrons('Sōshū-den')).toBe('Soshu-den');
    });

    it('converts Tantō to Tanto', () => {
      expect(removeMacrons('Tantō')).toBe('Tanto');
    });

    it('converts Jūyō to Juyo', () => {
      expect(removeMacrons('Jūyō')).toBe('Juyo');
    });

    it('converts Hōzon to Hozon', () => {
      expect(removeMacrons('Hōzon')).toBe('Hozon');
    });

    it('handles multiple macrons in succession', () => {
      expect(removeMacrons('ōōūū')).toBe('oouu');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(removeMacrons('')).toBe('');
    });

    it('handles null-like falsy value', () => {
      expect(removeMacrons(null as unknown as string)).toBe('');
      expect(removeMacrons(undefined as unknown as string)).toBe('');
    });

    it('returns already normalized text unchanged', () => {
      expect(removeMacrons('Katana')).toBe('Katana');
      expect(removeMacrons('Masamune')).toBe('Masamune');
      expect(removeMacrons('wakizashi')).toBe('wakizashi');
    });

    it('preserves special characters and punctuation', () => {
      expect(removeMacrons('Tōkyō (東京)')).toBe('Tokyo (東京)');
      expect(removeMacrons('Ōsaka-shi, Japan')).toBe('Osaka-shi, Japan');
    });

    it('preserves numbers', () => {
      expect(removeMacrons('Meiji 5 (1872)')).toBe('Meiji 5 (1872)');
    });

    it('handles strings with only macrons', () => {
      expect(removeMacrons('āēīōū')).toBe('aeiou');
      expect(removeMacrons('ĀĒĪŌŪ')).toBe('AEIOU');
    });

    it('preserves kanji characters', () => {
      expect(removeMacrons('国')).toBe('国');
      expect(removeMacrons('Kuniyoshi (国芳)')).toBe('Kuniyoshi (国芳)');
    });
  });

  describe('mixed case handling', () => {
    it('handles mixed uppercase and lowercase macrons', () => {
      expect(removeMacrons('ŌSAKA ōsaka')).toBe('OSAKA osaka');
    });

    it('preserves case for non-macron characters', () => {
      expect(removeMacrons('MaSaMuNe')).toBe('MaSaMuNe');
    });
  });
});

// =============================================================================
// normalizeSearchText
// =============================================================================

describe('normalizeSearchText', () => {
  describe('basic normalization', () => {
    it('converts to lowercase', () => {
      expect(normalizeSearchText('KATANA')).toBe('katana');
      expect(normalizeSearchText('Wakizashi')).toBe('wakizashi');
    });

    it('removes macrons and lowercases', () => {
      expect(normalizeSearchText('Gotō')).toBe('goto');
      expect(normalizeSearchText('TŌKYŌ')).toBe('tokyo');
    });

    it('trims leading whitespace', () => {
      expect(normalizeSearchText('   katana')).toBe('katana');
    });

    it('trims trailing whitespace', () => {
      expect(normalizeSearchText('katana   ')).toBe('katana');
    });

    it('trims both leading and trailing whitespace', () => {
      expect(normalizeSearchText('  katana  ')).toBe('katana');
    });

    it('collapses multiple internal whitespace to single space', () => {
      expect(normalizeSearchText('katana    wakizashi')).toBe('katana wakizashi');
      expect(normalizeSearchText('a   b   c')).toBe('a b c');
    });
  });

  describe('diacritics removal', () => {
    it('removes accents from letters', () => {
      expect(normalizeSearchText('café')).toBe('cafe');
      expect(normalizeSearchText('résumé')).toBe('resume');
    });

    it('removes umlauts', () => {
      expect(normalizeSearchText('Müller')).toBe('muller');
    });

    it('handles combined diacritics and macrons', () => {
      expect(normalizeSearchText('Tōkyō café')).toBe('tokyo cafe');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeSearchText('')).toBe('');
    });

    it('handles null-like falsy values', () => {
      expect(normalizeSearchText(null as unknown as string)).toBe('');
      expect(normalizeSearchText(undefined as unknown as string)).toBe('');
    });

    it('handles whitespace-only string', () => {
      expect(normalizeSearchText('   ')).toBe('');
      expect(normalizeSearchText('\t\n  ')).toBe('');
    });

    it('returns already normalized text', () => {
      expect(normalizeSearchText('katana')).toBe('katana');
      expect(normalizeSearchText('already normalized')).toBe('already normalized');
    });

    it('preserves kanji characters', () => {
      expect(normalizeSearchText('国')).toBe('国');
      expect(normalizeSearchText('Tōkyō (東京)')).toBe('tokyo (東京)');
    });

    it('preserves numbers', () => {
      expect(normalizeSearchText('Meiji 5')).toBe('meiji 5');
    });

    it('handles mixed content', () => {
      expect(normalizeSearchText('  GOTŌ Katana  123  ')).toBe('goto katana 123');
    });
  });

  describe('mixed case normalization', () => {
    it('handles all caps with macrons', () => {
      expect(normalizeSearchText('ŌSAKA TŌKYŌ')).toBe('osaka tokyo');
    });

    it('handles alternating case', () => {
      expect(normalizeSearchText('KaTaNa')).toBe('katana');
    });
  });
});

// =============================================================================
// expandSearchAliases
// =============================================================================

describe('expandSearchAliases', () => {
  describe('certification aliases', () => {
    it('expands tokuju to tokubetsu juyo variants', () => {
      const result = expandSearchAliases('tokuju');
      expect(result).toContain('tokuju');
      expect(result).toContain('tokubetsu juyo');
      expect(result).toContain('tokubetsu_juyo');
    });

    it('expands tokuho to tokubetsu hozon variants', () => {
      const result = expandSearchAliases('tokuho');
      expect(result).toContain('tokuho');
      expect(result).toContain('tokubetsu hozon');
      expect(result).toContain('tokubetsu_hozon');
    });

    it('expands tokukicho to tokubetsu kicho variants', () => {
      const result = expandSearchAliases('tokukicho');
      expect(result).toContain('tokukicho');
      expect(result).toContain('tokubetsu kicho');
      expect(result).toContain('tokubetsu_kicho');
    });

    it('expands nbthk to certification terms', () => {
      const result = expandSearchAliases('nbthk');
      expect(result).toContain('nbthk');
      expect(result).toContain('juyo');
      expect(result).toContain('hozon');
      expect(result).toContain('tokubetsu');
    });

    it('expands nthk to nthk', () => {
      const result = expandSearchAliases('nthk');
      expect(result).toContain('nthk');
    });
  });

  describe('item type aliases', () => {
    it('expands waki to wakizashi', () => {
      const result = expandSearchAliases('waki');
      expect(result).toContain('waki');
      expect(result).toContain('wakizashi');
    });

    it('expands nagi to naginata', () => {
      const result = expandSearchAliases('nagi');
      expect(result).toContain('nagi');
      expect(result).toContain('naginata');
    });

    it('expands sword to blade types', () => {
      const result = expandSearchAliases('sword');
      expect(result).toContain('sword');
      expect(result).toContain('katana');
      expect(result).toContain('wakizashi');
      expect(result).toContain('tanto');
      expect(result).toContain('tachi');
    });

    it('expands blade to blade types', () => {
      const result = expandSearchAliases('blade');
      expect(result).toContain('blade');
      expect(result).toContain('katana');
      expect(result).toContain('wakizashi');
      expect(result).toContain('tanto');
      expect(result).toContain('tachi');
    });

    it('expands fitting to fitting types', () => {
      const result = expandSearchAliases('fitting');
      expect(result).toContain('fitting');
      expect(result).toContain('tsuba');
      expect(result).toContain('fuchi');
      expect(result).toContain('kashira');
      expect(result).toContain('menuki');
      expect(result).toContain('kozuka');
    });

    it('expands tosogu to fitting types', () => {
      const result = expandSearchAliases('tosogu');
      expect(result).toContain('tosogu');
      expect(result).toContain('tsuba');
      expect(result).toContain('fuchi');
      expect(result).toContain('kashira');
      expect(result).toContain('menuki');
      expect(result).toContain('kozuka');
    });

    it('expands fuchikashira to variants', () => {
      const result = expandSearchAliases('fuchikashira');
      expect(result).toContain('fuchikashira');
      expect(result).toContain('fuchi_kashira');
      expect(result).toContain('fuchi-kashira');
      expect(result).toContain('fuchi kashira');
    });

    it('expands tuba to tsuba (romanization variant)', () => {
      const result = expandSearchAliases('tuba');
      expect(result).toContain('tuba');
      expect(result).toContain('tsuba');
    });

    it('expands tanto to romanization variants', () => {
      const result = expandSearchAliases('tanto');
      expect(result).toContain('tanto');
      expect(result).toContain('tantou');
      expect(result).toContain('tantō');
    });
  });

  describe('province aliases', () => {
    it('expands bizen to province variants', () => {
      const result = expandSearchAliases('bizen');
      expect(result).toContain('bizen');
      expect(result).toContain('bishu');
    });

    it('expands yamashiro', () => {
      const result = expandSearchAliases('yamashiro');
      expect(result).toContain('yamashiro');
    });

    it('expands yamato', () => {
      const result = expandSearchAliases('yamato');
      expect(result).toContain('yamato');
    });

    it('expands sagami to soshu', () => {
      const result = expandSearchAliases('sagami');
      expect(result).toContain('sagami');
      expect(result).toContain('soshu');
    });

    it('expands soshu to sagami', () => {
      const result = expandSearchAliases('soshu');
      expect(result).toContain('soshu');
      expect(result).toContain('sagami');
    });

    it('expands mino to noshu', () => {
      const result = expandSearchAliases('mino');
      expect(result).toContain('mino');
      expect(result).toContain('noshu');
    });

    it('expands seki to mino', () => {
      const result = expandSearchAliases('seki');
      expect(result).toContain('seki');
      expect(result).toContain('mino');
    });

    it('expands hizen', () => {
      const result = expandSearchAliases('hizen');
      expect(result).toContain('hizen');
    });

    it('expands satsuma', () => {
      const result = expandSearchAliases('satsuma');
      expect(result).toContain('satsuma');
    });

    it('expands echizen', () => {
      const result = expandSearchAliases('echizen');
      expect(result).toContain('echizen');
    });

    it('expands kaga', () => {
      const result = expandSearchAliases('kaga');
      expect(result).toContain('kaga');
    });
  });

  describe('era/period aliases', () => {
    it('expands koto to era terms', () => {
      const result = expandSearchAliases('koto');
      expect(result).toContain('koto');
      expect(result).toContain('old sword');
    });

    it('expands shinto to era terms', () => {
      const result = expandSearchAliases('shinto');
      expect(result).toContain('shinto');
      expect(result).toContain('new sword');
    });

    it('expands shinshinto to variants', () => {
      const result = expandSearchAliases('shinshinto');
      expect(result).toContain('shinshinto');
      expect(result).toContain('shin-shinto');
    });

    it('expands gendaito to modern terms', () => {
      const result = expandSearchAliases('gendaito');
      expect(result).toContain('gendaito');
      expect(result).toContain('gendai');
      expect(result).toContain('modern');
    });

    it('expands muromachi', () => {
      const result = expandSearchAliases('muromachi');
      expect(result).toContain('muromachi');
    });

    it('expands kamakura', () => {
      const result = expandSearchAliases('kamakura');
      expect(result).toContain('kamakura');
    });

    it('expands edo to tokugawa', () => {
      const result = expandSearchAliases('edo');
      expect(result).toContain('edo');
      expect(result).toContain('tokugawa');
    });

    it('expands meiji', () => {
      const result = expandSearchAliases('meiji');
      expect(result).toContain('meiji');
    });
  });

  describe('mei (signature) aliases', () => {
    it('expands mumei to unsigned', () => {
      const result = expandSearchAliases('mumei');
      expect(result).toContain('mumei');
      expect(result).toContain('unsigned');
    });

    it('expands signed to mei', () => {
      const result = expandSearchAliases('signed');
      expect(result).toContain('signed');
      expect(result).toContain('mei');
    });

    it('expands gimei to false signature', () => {
      const result = expandSearchAliases('gimei');
      expect(result).toContain('gimei');
      expect(result).toContain('false signature');
    });
  });

  describe('material aliases (for tosogu)', () => {
    it('expands iron to tetsu', () => {
      const result = expandSearchAliases('iron');
      expect(result).toContain('iron');
      expect(result).toContain('tetsu');
    });

    it('expands shakudo', () => {
      const result = expandSearchAliases('shakudo');
      expect(result).toContain('shakudo');
    });

    it('expands shibuichi', () => {
      const result = expandSearchAliases('shibuichi');
      expect(result).toContain('shibuichi');
    });

    it('expands gold to kin', () => {
      const result = expandSearchAliases('gold');
      expect(result).toContain('gold');
      expect(result).toContain('kin');
    });

    it('expands silver to gin', () => {
      const result = expandSearchAliases('silver');
      expect(result).toContain('silver');
      expect(result).toContain('gin');
    });

    it('expands copper to akagane', () => {
      const result = expandSearchAliases('copper');
      expect(result).toContain('copper');
      expect(result).toContain('akagane');
    });
  });

  describe('edge cases', () => {
    it('returns original word when no alias exists', () => {
      const result = expandSearchAliases('masamune');
      expect(result).toEqual(['masamune']);
    });

    it('returns original word for unknown terms', () => {
      const result = expandSearchAliases('unknownterm123');
      expect(result).toEqual(['unknownterm123']);
    });

    it('handles empty string', () => {
      const result = expandSearchAliases('');
      expect(result).toEqual(['']);
    });

    it('handles whitespace-only string (normalizes to empty)', () => {
      const result = expandSearchAliases('   ');
      expect(result).toEqual(['']);
    });

    it('normalizes input to lowercase before lookup', () => {
      const result = expandSearchAliases('TOKUJU');
      expect(result).toContain('tokuju');
      expect(result).toContain('tokubetsu juyo');
    });

    it('trims input before lookup', () => {
      const result = expandSearchAliases('  waki  ');
      expect(result).toContain('waki');
      expect(result).toContain('wakizashi');
    });

    it('returns array with original always first', () => {
      const result = expandSearchAliases('tokuju');
      expect(result[0]).toBe('tokuju');
    });
  });
});

// =============================================================================
// toTraditionalKanji
// =============================================================================

describe('toTraditionalKanji', () => {
  describe('common kanji conversions', () => {
    it('converts 国 to 國 (kuni)', () => {
      expect(toTraditionalKanji('国')).toBe('國');
    });

    it('converts 広 to 廣 (hiro)', () => {
      expect(toTraditionalKanji('広')).toBe('廣');
    });

    it('converts 竜 to 龍 (ryuu/tatsu)', () => {
      expect(toTraditionalKanji('竜')).toBe('龍');
    });

    it('converts 剣 to 劍 (ken - sword)', () => {
      expect(toTraditionalKanji('剣')).toBe('劍');
    });

    it('converts 鉄 to 鐵 (tetsu - iron)', () => {
      expect(toTraditionalKanji('鉄')).toBe('鐵');
    });

    it('converts 宝 to 寶 (takara - treasure)', () => {
      expect(toTraditionalKanji('宝')).toBe('寶');
    });

    it('converts 関 to 關 (kan - barrier)', () => {
      expect(toTraditionalKanji('関')).toBe('關');
    });

    it('converts 黒 to 黑 (kuro - black)', () => {
      expect(toTraditionalKanji('黒')).toBe('黑');
    });
  });

  describe('smith name conversions', () => {
    it('converts 国広 to 國廣 (Kunihiro)', () => {
      expect(toTraditionalKanji('国広')).toBe('國廣');
    });

    it('converts 国芳 to 國芳 (Kuniyoshi)', () => {
      expect(toTraditionalKanji('国芳')).toBe('國芳');
    });

    it('converts multiple simplified kanji in a name', () => {
      expect(toTraditionalKanji('関鉄')).toBe('關鐵');
    });
  });

  describe('additional kanji mappings', () => {
    it('converts 沢 to 澤 (sawa)', () => {
      expect(toTraditionalKanji('沢')).toBe('澤');
    });

    it('converts 桜 to 櫻 (sakura)', () => {
      expect(toTraditionalKanji('桜')).toBe('櫻');
    });

    it('converts 円 to 圓 (en)', () => {
      expect(toTraditionalKanji('円')).toBe('圓');
    });

    it('converts 真 to 眞 (ma/shin)', () => {
      expect(toTraditionalKanji('真')).toBe('眞');
    });

    it('converts 斎 to 齋 (sai)', () => {
      expect(toTraditionalKanji('斎')).toBe('齋');
    });

    it('converts 万 to 萬 (man)', () => {
      expect(toTraditionalKanji('万')).toBe('萬');
    });

    it('converts 実 to 實 (jitsu/mi)', () => {
      expect(toTraditionalKanji('実')).toBe('實');
    });

    it('converts 豊 to 豐 (yutaka)', () => {
      expect(toTraditionalKanji('豊')).toBe('豐');
    });

    it('converts 蔵 to 藏 (kura)', () => {
      expect(toTraditionalKanji('蔵')).toBe('藏');
    });

    it('converts 浜 to 濱 (hama)', () => {
      expect(toTraditionalKanji('浜')).toBe('濱');
    });

    it('converts 辺 to 邊 (be/hen)', () => {
      expect(toTraditionalKanji('辺')).toBe('邊');
    });

    it('converts 栄 to 榮 (ei)', () => {
      expect(toTraditionalKanji('栄')).toBe('榮');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(toTraditionalKanji('')).toBe('');
    });

    it('handles null-like falsy values', () => {
      expect(toTraditionalKanji(null as unknown as string)).toBe('');
      expect(toTraditionalKanji(undefined as unknown as string)).toBe('');
    });

    it('returns string unchanged if no variants exist', () => {
      expect(toTraditionalKanji('刀')).toBe('刀');
      expect(toTraditionalKanji('Katana')).toBe('Katana');
    });

    it('preserves romaji and numbers', () => {
      expect(toTraditionalKanji('国 Kunihiro 1600')).toBe('國 Kunihiro 1600');
    });

    it('handles mixed kanji with no variants', () => {
      expect(toTraditionalKanji('刀剣')).toBe('刀劍');
    });

    it('handles already traditional kanji', () => {
      expect(toTraditionalKanji('國廣')).toBe('國廣');
    });

    it('handles repeated simplified kanji', () => {
      expect(toTraditionalKanji('国国国')).toBe('國國國');
    });
  });
});

// =============================================================================
// hasKanjiVariants
// =============================================================================

describe('hasKanjiVariants', () => {
  it('returns true for string with simplified kanji', () => {
    expect(hasKanjiVariants('国')).toBe(true);
    expect(hasKanjiVariants('広')).toBe(true);
  });

  it('returns false for string without variants', () => {
    expect(hasKanjiVariants('刀')).toBe(false);
    expect(hasKanjiVariants('Katana')).toBe(false);
  });

  it('returns true for mixed content with variants', () => {
    expect(hasKanjiVariants('Kunihiro 国広')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasKanjiVariants('')).toBe(false);
  });

  it('returns false for null-like values', () => {
    expect(hasKanjiVariants(null as unknown as string)).toBe(false);
    expect(hasKanjiVariants(undefined as unknown as string)).toBe(false);
  });

  it('returns false for already traditional kanji', () => {
    expect(hasKanjiVariants('國廣')).toBe(false);
  });
});

// =============================================================================
// prepareSearchQuery
// =============================================================================

describe('prepareSearchQuery', () => {
  describe('basic query preparation', () => {
    it('adds prefix matching with :*', () => {
      expect(prepareSearchQuery('katana')).toBe('katana:*');
    });

    it('joins multiple terms with AND', () => {
      expect(prepareSearchQuery('katana goto')).toBe('katana:* & goto:*');
    });

    it('lowercases and normalizes terms', () => {
      expect(prepareSearchQuery('KATANA')).toBe('katana:*');
      expect(prepareSearchQuery('Gotō')).toBe('goto:*');
    });

    it('handles multiple spaces between terms', () => {
      expect(prepareSearchQuery('katana    wakizashi')).toBe('katana:* & wakizashi:*');
    });
  });

  describe('short term filtering', () => {
    it('filters single-character terms', () => {
      expect(prepareSearchQuery('a katana')).toBe('katana:*');
    });

    it('keeps two-character terms', () => {
      expect(prepareSearchQuery('go katana')).toBe('go:* & katana:*');
    });

    it('returns empty for all single-character terms', () => {
      expect(prepareSearchQuery('a b c')).toBe('');
    });

    it('returns the only valid term when others filtered', () => {
      expect(prepareSearchQuery('a b cd')).toBe('cd:*');
    });
  });

  describe('special character escaping', () => {
    // Note: This module replaces FTS special characters with spaces,
    // which results in separate search terms

    it('escapes ampersand by replacing with space (creates separate terms)', () => {
      const result = prepareSearchQuery('test&other');
      expect(result).not.toContain('&&');
      // & is replaced with space, creating two terms
      expect(result).toBe('test:* & other:*');
    });

    it('escapes pipe by replacing with space', () => {
      const result = prepareSearchQuery('test|other');
      expect(result).toBe('test:* & other:*');
    });

    it('escapes exclamation by replacing with space', () => {
      const result = prepareSearchQuery('test!other');
      expect(result).toBe('test:* & other:*');
    });

    it('escapes parentheses by replacing with space', () => {
      const result = prepareSearchQuery('test(other)');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
      expect(result).toBe('test:* & other:*');
    });

    it('escapes colon by replacing with space', () => {
      const result = prepareSearchQuery('test:other');
      expect(result).toBe('test:* & other:*');
    });

    it('escapes angle brackets by replacing with space', () => {
      const result = prepareSearchQuery('test<other>');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toBe('test:* & other:*');
    });

    it('escapes asterisk by replacing with space', () => {
      const result = prepareSearchQuery('test*other');
      expect(result).toBe('test:* & other:*');
    });

    it('preserves single quotes (not in FTS_SPECIAL_CHARS)', () => {
      const result = prepareSearchQuery("test'ing");
      // Single quotes are NOT in the FTS_SPECIAL_CHARS regex
      expect(result).toBe("test'ing:*");
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(prepareSearchQuery('')).toBe('');
    });

    it('handles null-like falsy values', () => {
      expect(prepareSearchQuery(null as unknown as string)).toBe('');
      expect(prepareSearchQuery(undefined as unknown as string)).toBe('');
    });

    it('handles whitespace-only string', () => {
      expect(prepareSearchQuery('   ')).toBe('');
      expect(prepareSearchQuery('\t\n')).toBe('');
    });

    it('handles string with only special characters', () => {
      expect(prepareSearchQuery('&|!()')).toBe('');
    });

    it('handles already valid tsquery-like input', () => {
      expect(prepareSearchQuery('katana:*')).toBe('katana:*');
    });
  });

  describe('real-world search queries', () => {
    it('handles Japanese romanization with spaces', () => {
      expect(prepareSearchQuery('Muramasa tanto')).toBe('muramasa:* & tanto:*');
    });

    it('handles smith name search', () => {
      expect(prepareSearchQuery('Gotō Ichijō')).toBe('goto:* & ichijo:*');
    });

    it('handles certification search', () => {
      expect(prepareSearchQuery('juyo katana')).toBe('juyo:* & katana:*');
    });

    it('handles dealer name search', () => {
      expect(prepareSearchQuery('Aoi Art')).toBe('aoi:* & art:*');
    });

    it('handles province search', () => {
      expect(prepareSearchQuery('bizen osafune')).toBe('bizen:* & osafune:*');
    });

    it('handles era search', () => {
      expect(prepareSearchQuery('muromachi katana')).toBe('muromachi:* & katana:*');
    });

    it('produces valid tsquery syntax for multiple terms', () => {
      const result = prepareSearchQuery('katana wakizashi tanto');
      expect(result).toBe('katana:* & wakizashi:* & tanto:*');
    });

    it('handles mixed macrons and diacritics', () => {
      expect(prepareSearchQuery('Tōkyō café')).toBe('tokyo:* & cafe:*');
    });
  });
});

// =============================================================================
// getSearchVariants
// =============================================================================

describe('getSearchVariants', () => {
  it('returns normalized query for basic input', () => {
    const result = getSearchVariants('Katana');
    expect(result).toContain('katana');
  });

  it('includes traditional kanji variant when applicable', () => {
    const result = getSearchVariants('国');
    expect(result).toContain('国');
    expect(result).toContain('國');
  });

  it('returns only one variant when no kanji variants exist', () => {
    const result = getSearchVariants('刀');
    expect(result).toEqual(['刀']);
  });

  it('handles empty string', () => {
    expect(getSearchVariants('')).toEqual([]);
  });

  it('handles null-like falsy values', () => {
    expect(getSearchVariants(null as unknown as string)).toEqual([]);
    expect(getSearchVariants(undefined as unknown as string)).toEqual([]);
  });

  it('normalizes before generating variants', () => {
    const result = getSearchVariants('  国  ');
    expect(result).toContain('国');
    expect(result).toContain('國');
  });

  it('returns unique variants only', () => {
    const result = getSearchVariants('katana');
    const uniqueResults = new Set(result);
    expect(result.length).toBe(uniqueResults.size);
  });

  it('handles complex smith names with variants', () => {
    const result = getSearchVariants('国広');
    expect(result).toContain('国広');
    expect(result).toContain('國廣');
  });
});

// =============================================================================
// Integration tests
// =============================================================================

describe('integration: full search pipeline', () => {
  it('normalizes, expands aliases, and prepares query', () => {
    // Simulate a search pipeline
    const input = 'TOKUJU katana';
    const normalized = normalizeSearchText(input);
    expect(normalized).toBe('tokuju katana');

    const terms = normalized.split(' ');
    const expanded = terms.flatMap(term => expandSearchAliases(term));
    expect(expanded).toContain('tokuju');
    expect(expanded).toContain('tokubetsu juyo');
    expect(expanded).toContain('katana');

    const query = prepareSearchQuery(input);
    expect(query).toBe('tokuju:* & katana:*');
  });

  it('handles complex macron + alias combination', () => {
    const input = 'Sōshū tantō';
    const normalized = normalizeSearchText(input);
    expect(normalized).toBe('soshu tanto');

    const query = prepareSearchQuery(input);
    expect(query).toBe('soshu:* & tanto:*');
  });

  it('handles kanji variant + normalization', () => {
    const input = '国広 KATANA';
    const variants = getSearchVariants(input);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.some(v => v.includes('國廣'))).toBe(true);
  });

  it('filters special chars while preserving meaningful content', () => {
    const input = 'katana & wakizashi (tanto)';
    const query = prepareSearchQuery(input);
    expect(query).toContain('katana:*');
    expect(query).toContain('wakizashi:*');
    expect(query).toContain('tanto:*');
    expect(query).not.toContain('&&');
  });
});
