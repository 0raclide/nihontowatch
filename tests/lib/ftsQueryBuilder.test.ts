import { describe, it, expect } from 'vitest';
import {
  buildFTSQuery,
  buildPhraseQuery,
  buildTermsQuery,
  escapeForTsquery,
  extractPhrases,
  isValidTsquery,
} from '@/lib/search/ftsQueryBuilder';

describe('escapeForTsquery', () => {
  it('removes special tsquery characters', () => {
    expect(escapeForTsquery('test & query')).toBe('test query');
    expect(escapeForTsquery('test | query')).toBe('test query');
    expect(escapeForTsquery('!test')).toBe('test');
    expect(escapeForTsquery('(test)')).toBe('test');
  });

  it('removes quotes', () => {
    expect(escapeForTsquery('"quoted"')).toBe('quoted');
    expect(escapeForTsquery("'quoted'")).toBe('quoted');
  });

  it('removes colons and asterisks', () => {
    expect(escapeForTsquery('test:*')).toBe('test');
    expect(escapeForTsquery('prefix:word')).toBe('prefix word');
  });

  it('normalizes whitespace', () => {
    expect(escapeForTsquery('test   query')).toBe('test query');
    expect(escapeForTsquery('  test  ')).toBe('test');
  });

  it('handles empty string', () => {
    expect(escapeForTsquery('')).toBe('');
  });

  it('handles string with only special chars', () => {
    expect(escapeForTsquery('&|!()')).toBe('');
  });
});

describe('extractPhrases', () => {
  it('extracts double-quoted phrases', () => {
    const result = extractPhrases('"Rai Kunimitsu" katana');
    expect(result.phrases).toEqual(['Rai Kunimitsu']);
    expect(result.remaining).toBe('katana');
  });

  it('extracts single-quoted phrases', () => {
    const result = extractPhrases("'Goto Ichijo' tsuba");
    expect(result.phrases).toEqual(['Goto Ichijo']);
    expect(result.remaining).toBe('tsuba');
  });

  it('extracts multiple phrases', () => {
    const result = extractPhrases('"Rai Kunimitsu" "Bizen school"');
    expect(result.phrases).toEqual(['Rai Kunimitsu', 'Bizen school']);
    expect(result.remaining).toBe('');
  });

  it('handles no phrases', () => {
    const result = extractPhrases('katana bizen');
    expect(result.phrases).toEqual([]);
    expect(result.remaining).toBe('katana bizen');
  });

  it('handles empty input', () => {
    const result = extractPhrases('');
    expect(result.phrases).toEqual([]);
    expect(result.remaining).toBe('');
  });

  it('ignores short phrases', () => {
    const result = extractPhrases('"a" katana');
    expect(result.phrases).toEqual([]);
    expect(result.remaining).toBe('katana');
  });
});

describe('buildPhraseQuery', () => {
  it('builds adjacency query for multi-word phrase', () => {
    const result = buildPhraseQuery('Rai Kunimitsu');
    expect(result).toBe('rai <-> kunimitsu');
  });

  it('returns single term for single word', () => {
    const result = buildPhraseQuery('katana');
    expect(result).toBe('katana');
  });

  it('adds prefix match to single word when enabled', () => {
    const result = buildPhraseQuery('kata', { prefixMatch: true });
    expect(result).toBe('kata:*');
  });

  it('adds prefix match only to last word of phrase', () => {
    const result = buildPhraseQuery('Rai Kuni', { prefixMatch: true });
    expect(result).toBe('rai <-> kuni:*');
  });

  it('handles empty input', () => {
    const result = buildPhraseQuery('');
    expect(result).toBe('');
  });

  it('normalizes and lowercases', () => {
    const result = buildPhraseQuery('GOTO ICHIJO');
    expect(result).toBe('goto <-> ichijo');
  });
});

describe('buildTermsQuery', () => {
  it('joins terms with AND operator', () => {
    const result = buildTermsQuery('bizen katana');
    expect(result).toBe('bizen & katana');
  });

  it('adds prefix matching when enabled', () => {
    const result = buildTermsQuery('bizen katana', { prefixMatch: true });
    expect(result).toBe('bizen:* & katana:*');
  });

  it('filters short terms', () => {
    const result = buildTermsQuery('a b katana', { minTermLength: 2 });
    expect(result).toBe('katana');
  });

  it('handles single term', () => {
    const result = buildTermsQuery('katana');
    expect(result).toBe('katana');
  });

  it('handles empty input', () => {
    const result = buildTermsQuery('');
    expect(result).toBe('');
  });
});

describe('buildFTSQuery', () => {
  describe('basic queries', () => {
    it('builds simple single-word query', () => {
      const result = buildFTSQuery('katana');
      expect(result.tsquery).toBe('katana');
      expect(result.isPhraseSearch).toBe(false);
      expect(result.isEmpty).toBe(false);
    });

    it('builds multi-word query with AND', () => {
      const result = buildFTSQuery('bizen katana');
      expect(result.tsquery).toBe('bizen & katana');
      expect(result.isPhraseSearch).toBe(false);
    });

    it('adds prefix matching when enabled', () => {
      const result = buildFTSQuery('bizen katana', { prefixMatch: true });
      expect(result.tsquery).toBe('bizen:* & katana:*');
    });
  });

  describe('phrase matching', () => {
    it('detects quoted phrases', () => {
      const result = buildFTSQuery('"Rai Kunimitsu"');
      expect(result.isPhraseSearch).toBe(true);
      expect(result.tsquery).toContain('<->');
    });

    it('builds phrase with adjacency operator', () => {
      const result = buildFTSQuery('"Rai Kunimitsu"');
      expect(result.tsquery).toBe('(rai <-> kunimitsu)');
    });

    it('combines phrase and regular terms', () => {
      const result = buildFTSQuery('"Rai Kunimitsu" katana', { prefixMatch: true });
      expect(result.tsquery).toBe('(rai <-> kunimitsu) & katana:*');
      expect(result.isPhraseSearch).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = buildFTSQuery('');
      expect(result.isEmpty).toBe(true);
      expect(result.tsquery).toBe('');
    });

    it('handles null/undefined', () => {
      // @ts-expect-error Testing invalid input
      expect(buildFTSQuery(null).isEmpty).toBe(true);
      // @ts-expect-error Testing invalid input
      expect(buildFTSQuery(undefined).isEmpty).toBe(true);
    });

    it('handles input shorter than minTermLength', () => {
      const result = buildFTSQuery('a');
      expect(result.isEmpty).toBe(true);
    });

    it('handles special characters gracefully', () => {
      // Input special chars are escaped, then words are joined with &
      const result = buildFTSQuery('test & query | !term');
      // The & and | from input are removed, but words are joined with tsquery's &
      // So "test & query | !term" becomes "test query term" which becomes "test & query & term"
      expect(result.tsquery).toBe('test & query & term');
      expect(result.terms).toEqual(['test', 'query', 'term']);
      expect(result.isEmpty).toBe(false);
    });

    it('handles macrons in input', () => {
      const result = buildFTSQuery('Gotō');
      expect(result.tsquery).toBe('goto');
    });

    it('preserves terms array for debugging', () => {
      const result = buildFTSQuery('bizen katana');
      expect(result.terms).toContain('bizen');
      expect(result.terms).toContain('katana');
    });
  });

  describe('word boundary matching (the core fix)', () => {
    it('produces tsquery for "rai" that will NOT match "grained"', () => {
      // This is the core fix - "rai" should produce a tsquery that
      // uses word boundary matching, not substring matching
      const result = buildFTSQuery('rai', { prefixMatch: true });

      // The tsquery should be "rai:*" which PostgreSQL will match
      // against whole words starting with "rai", not substrings
      expect(result.tsquery).toBe('rai:*');

      // The key is that PostgreSQL's @@ operator with tsquery
      // does word-level matching, not substring matching like ILIKE
      // So "grained" won't match because "rai" is not a word in it
    });

    it('produces tsquery for "Rai Kunimitsu" with proper word boundaries', () => {
      const result = buildFTSQuery('Rai Kunimitsu', { prefixMatch: true });

      // Should produce AND query with word-level matching
      expect(result.tsquery).toBe('rai:* & kunimitsu:*');

      // This will NOT match documents where:
      // - "rai" only appears as substring in "grained"
      // - "kunimitsu" appears as a reference, not the actual smith
    });
  });
});

describe('isValidTsquery', () => {
  it('validates simple queries', () => {
    expect(isValidTsquery('katana')).toBe(true);
    expect(isValidTsquery('bizen:*')).toBe(true);
    expect(isValidTsquery('rai & kunimitsu')).toBe(true);
  });

  it('validates phrase queries', () => {
    expect(isValidTsquery('rai <-> kunimitsu')).toBe(true);
    expect(isValidTsquery('(rai <-> kunimitsu) & katana')).toBe(true);
  });

  it('rejects empty queries', () => {
    expect(isValidTsquery('')).toBe(false);
    expect(isValidTsquery('   ')).toBe(false);
  });

  it('rejects unbalanced parentheses', () => {
    expect(isValidTsquery('(rai')).toBe(false);
    expect(isValidTsquery('rai)')).toBe(false);
    expect(isValidTsquery('((rai)')).toBe(false);
  });

  it('rejects dangling operators', () => {
    expect(isValidTsquery('& rai')).toBe(false);
    expect(isValidTsquery('rai &')).toBe(false);
    expect(isValidTsquery('rai && kunimitsu')).toBe(false);
  });
});
