import { describe, it, expect } from 'vitest';
import { removeMacrons, normalizeSearchText, prepareSearchQuery } from '@/lib/search';

describe('removeMacrons', () => {
  it('converts long vowels to short', () => {
    expect(removeMacrons('Juyo')).toBe('Juyo');
    expect(removeMacrons('Tanto')).toBe('Tanto');
    expect(removeMacrons('Goto')).toBe('Goto');
  });

  it('preserves text without macrons', () => {
    expect(removeMacrons('Katana')).toBe('Katana');
    expect(removeMacrons('Masamune')).toBe('Masamune');
  });

  it('handles uppercase macrons', () => {
    expect(removeMacrons('TOKYO')).toBe('TOKYO');
  });

  it('converts lowercase macron vowels', () => {
    expect(removeMacrons('a')).toBe('a');
    expect(removeMacrons('e')).toBe('e');
    expect(removeMacrons('i')).toBe('i');
    expect(removeMacrons('o')).toBe('o');
    expect(removeMacrons('u')).toBe('u');
  });

  it('converts uppercase macron vowels', () => {
    expect(removeMacrons('A')).toBe('A');
    expect(removeMacrons('E')).toBe('E');
    expect(removeMacrons('I')).toBe('I');
    expect(removeMacrons('O')).toBe('O');
    expect(removeMacrons('U')).toBe('U');
  });

  it('converts mixed text with macrons', () => {
    expect(removeMacrons('Tokyo')).toBe('Tokyo');
    expect(removeMacrons('Osaka')).toBe('Osaka');
    expect(removeMacrons('Kyushu')).toBe('Kyushu');
    expect(removeMacrons('Soshu-den')).toBe('Soshu-den');
  });

  it('handles empty string', () => {
    expect(removeMacrons('')).toBe('');
  });

  it('preserves special characters and punctuation', () => {
    expect(removeMacrons('Tokyo (Tokyo)')).toBe('Tokyo (Tokyo)');
    expect(removeMacrons('Osaka-shi, Japan')).toBe('Osaka-shi, Japan');
  });

  it('handles strings with only macrons', () => {
    expect(removeMacrons('ouaei')).toBe('ouaei');
  });
});

describe('normalizeSearchText', () => {
  it('lowercases and removes diacritics', () => {
    expect(normalizeSearchText('Goto')).toBe('goto');
    expect(normalizeSearchText('KATANA')).toBe('katana');
  });

  it('trims whitespace', () => {
    expect(normalizeSearchText('  katana  ')).toBe('katana');
  });

  it('handles empty string', () => {
    expect(normalizeSearchText('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(normalizeSearchText('   ')).toBe('');
  });

  it('normalizes mixed case with macrons', () => {
    expect(normalizeSearchText('MaSaMuNe')).toBe('masamune');
    expect(normalizeSearchText('  KATANA  ')).toBe('katana');
  });

  it('preserves kanji characters', () => {
    expect(normalizeSearchText('Tokyo (Tokyo)')).toBe('tokyo (tokyo)');
  });
});

describe('prepareSearchQuery', () => {
  it('adds prefix matching', () => {
    expect(prepareSearchQuery('masa')).toContain('masa:*');
  });

  it('joins terms with AND', () => {
    const result = prepareSearchQuery('katana soshu');
    expect(result).toContain('&');
    expect(result).toContain('katana:*');
    expect(result).toContain('soshu:*');
  });

  it('filters short terms', () => {
    // Only 'cd' should remain (length >= 2)
    expect(prepareSearchQuery('a b cd')).toBe('cd:*');
  });

  it('filters all terms if all too short', () => {
    expect(prepareSearchQuery('a b c')).toBe('');
  });

  it('escapes special characters safely', () => {
    // Special chars should be removed, not cause errors
    const result = prepareSearchQuery('test&special');
    expect(result).not.toContain('&&');
    expect(result).toContain('testspecial:*');
  });

  it('handles quotes and parentheses', () => {
    const result = prepareSearchQuery("test'ing (query)");
    expect(result).not.toContain("'");
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
  });

  it('normalizes whitespace between terms', () => {
    const result = prepareSearchQuery('katana    soshu');
    expect(result).toBe('katana:* & soshu:*');
  });

  it('handles empty string', () => {
    expect(prepareSearchQuery('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(prepareSearchQuery('   ')).toBe('');
  });

  it('lowercases and normalizes before processing', () => {
    const result = prepareSearchQuery('KATANA');
    expect(result).toBe('katana:*');
  });

  it('handles Japanese romanization with spaces', () => {
    const result = prepareSearchQuery('Muramasa tanto');
    expect(result).toBe('muramasa:* & tanto:*');
  });

  it('produces valid tsquery syntax', () => {
    const result = prepareSearchQuery('katana wakizashi tanto');
    expect(result).toBe('katana:* & wakizashi:* & tanto:*');
  });
});
