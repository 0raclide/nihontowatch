import { describe, it, expect } from 'vitest';
import {
  getArtisanDisplayParts,
  getArtisanDisplayName,
  getArtisanAlias,
  norm,
} from '@/lib/artisan/displayName';

// ---------------------------------------------------------------------------
// norm() — macron normalisation
// ---------------------------------------------------------------------------

describe('norm()', () => {
  it('lowercases and strips macrons', () => {
    expect(norm('Gotō')).toBe('goto');
    expect(norm('Ichijō')).toBe('ichijo');
    expect(norm('ŌSAFUNE')).toBe('osafune');
  });

  it('handles plain ASCII', () => {
    expect(norm('Kanemitsu')).toBe('kanemitsu');
  });
});

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

describe('getArtisanAlias()', () => {
  it('returns alias for known codes', () => {
    expect(getArtisanAlias('KAN1670')).toBe('Kencho');
    expect(getArtisanAlias('KUN539')).toBe('Shintogo Kunimitsu');
    expect(getArtisanAlias('KUN636')).toBe('Saburo Kunimune');
    expect(getArtisanAlias('GOT042')).toBe('Goto Ichijo');
  });

  it('returns null for unknown codes', () => {
    expect(getArtisanAlias('MAS590')).toBeNull();
    expect(getArtisanAlias('UNKNOWN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rule 1: exact match
// ---------------------------------------------------------------------------

describe('Rule 1 — exact match', () => {
  it('school equals name (same case)', () => {
    expect(getArtisanDisplayParts('Gotō', 'Gotō')).toEqual({ prefix: null, name: 'Gotō' });
  });

  it('school equals name (macron mismatch)', () => {
    expect(getArtisanDisplayParts('Goto', 'Gotō')).toEqual({ prefix: null, name: 'Goto' });
  });
});

// ---------------------------------------------------------------------------
// Rule 2: name starts with school
// ---------------------------------------------------------------------------

describe('Rule 2 — name starts with school', () => {
  it('school="Gotō", name="Gotō Renjō" → "Gotō Renjō"', () => {
    expect(getArtisanDisplayParts('Gotō Renjō', 'Gotō')).toEqual({ prefix: null, name: 'Gotō Renjō' });
  });

  it('school="Gotō", name="Gotōbe" should NOT match (no word boundary)', () => {
    const result = getArtisanDisplayParts('Gotōbe', 'Gotō');
    // "Gotōbe" normalises to "gotobe", school "Gotō" → "goto"
    // "gotobe".startsWith("goto") → true, but afterSchool = "be" (not space)
    // So Rule 2 does NOT match — falls through
    expect(result.prefix).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rule 2b: school starts with name
// ---------------------------------------------------------------------------

describe('Rule 2b — school starts with name', () => {
  it('school="Oishi Sa", name="Oishi" → "Oishi Sa"', () => {
    expect(getArtisanDisplayParts('Oishi', 'Oishi Sa')).toEqual({ prefix: null, name: 'Oishi Sa' });
  });
});

// ---------------------------------------------------------------------------
// Rule 3: school ends with name (space/hyphen)
// ---------------------------------------------------------------------------

describe('Rule 3 — school ends with name', () => {
  it('school="Sue-Naminohira", name="Naminohira" → "Sue-Naminohira"', () => {
    expect(getArtisanDisplayParts('Naminohira', 'Sue-Naminohira')).toEqual({ prefix: null, name: 'Sue-Naminohira' });
  });

  it('school="Hizen Tadayoshi", name="Tadayoshi" → "Hizen Tadayoshi"', () => {
    expect(getArtisanDisplayParts('Tadayoshi', 'Hizen Tadayoshi')).toEqual({ prefix: null, name: 'Hizen Tadayoshi' });
  });
});

// ---------------------------------------------------------------------------
// Rule 3b: name as token in school
// ---------------------------------------------------------------------------

describe('Rule 3b — name as token in school', () => {
  it('school="Bizen Osafune", name="Osafune" → "Bizen Osafune"', () => {
    expect(getArtisanDisplayParts('Osafune', 'Bizen Osafune')).toEqual({ prefix: null, name: 'Bizen Osafune' });
  });
});

// ---------------------------------------------------------------------------
// Rule 3c: school as token in name (GOTO ICHIJO FIX)
// ---------------------------------------------------------------------------

describe('Rule 3c — school as token in name', () => {
  it('school="Ichijō", name="Gotō Ichijō" → "Gotō Ichijō" (no prefix)', () => {
    expect(getArtisanDisplayParts('Gotō Ichijō', 'Ichijō')).toEqual({ prefix: null, name: 'Gotō Ichijō' });
  });

  it('school="Ichijo", name="Goto Ichijo" → "Goto Ichijo" (ASCII variant)', () => {
    expect(getArtisanDisplayParts('Goto Ichijo', 'Ichijo')).toEqual({ prefix: null, name: 'Goto Ichijo' });
  });

  it('does not fire for non-matching tokens', () => {
    // school="Osafune", name="Kanemitsu" — "osafune" not in ["kanemitsu"]
    const result = getArtisanDisplayParts('Kanemitsu', 'Osafune');
    expect(result.prefix).toBe('Osafune');
    expect(result.name).toBe('Kanemitsu');
  });
});

// ---------------------------------------------------------------------------
// Rule 4: lineage substitution
// ---------------------------------------------------------------------------

describe('Rule 4 — lineage substitution', () => {
  it('school="Horikawa Kunihiro", name="Kunitomo" → "Horikawa Kunitomo"', () => {
    expect(getArtisanDisplayParts('Kunitomo', 'Horikawa Kunihiro')).toEqual({
      prefix: 'Horikawa',
      name: 'Kunitomo',
    });
  });

  it('school="Hizen Tadayoshi", name="Tadahiro" → "Hizen Tadahiro"', () => {
    expect(getArtisanDisplayParts('Tadahiro', 'Hizen Tadayoshi')).toEqual({
      prefix: 'Hizen',
      name: 'Tadahiro',
    });
  });
});

// ---------------------------------------------------------------------------
// Rule 5: geographic prefix stripping
// ---------------------------------------------------------------------------

describe('Rule 5 — geographic prefix', () => {
  it('school="Osaka Gassan", name="Sadakazu" → "Gassan Sadakazu"', () => {
    expect(getArtisanDisplayParts('Sadakazu', 'Osaka Gassan')).toEqual({
      prefix: 'Gassan',
      name: 'Sadakazu',
    });
  });

  it('strips province prefix (school="Bizen Ichimonji", name="Sukemitsu")', () => {
    expect(getArtisanDisplayParts('Sukemitsu', 'Bizen Ichimonji')).toEqual({
      prefix: 'Ichimonji',
      name: 'Sukemitsu',
    });
  });
});

// ---------------------------------------------------------------------------
// Rule 6: default
// ---------------------------------------------------------------------------

describe('Rule 6 — default', () => {
  it('school="Osafune", name="Kanemitsu" → "Osafune Kanemitsu"', () => {
    expect(getArtisanDisplayParts('Kanemitsu', 'Osafune')).toEqual({
      prefix: 'Osafune',
      name: 'Kanemitsu',
    });
  });
});

// ---------------------------------------------------------------------------
// Slash separator — "/" schools
// ---------------------------------------------------------------------------

describe('Slash school separator', () => {
  it('school with "/" → no prefix, just name', () => {
    expect(getArtisanDisplayParts('Shomin', 'Natsuo / Tokyo Fine Arts')).toEqual({
      prefix: null,
      name: 'Shomin',
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('null school → just name', () => {
    expect(getArtisanDisplayParts('Masamune', null)).toEqual({ prefix: null, name: 'Masamune' });
  });

  it('null name → school as prefix, empty name', () => {
    expect(getArtisanDisplayParts(null, 'Osafune')).toEqual({ prefix: 'Osafune', name: '' });
  });

  it('both null → no prefix, empty name', () => {
    expect(getArtisanDisplayParts(null, null)).toEqual({ prefix: null, name: '' });
  });
});

// ---------------------------------------------------------------------------
// getArtisanDisplayName() convenience
// ---------------------------------------------------------------------------

describe('getArtisanDisplayName()', () => {
  it('joins prefix and name', () => {
    expect(getArtisanDisplayName('Kanemitsu', 'Osafune')).toBe('Osafune Kanemitsu');
  });

  it('returns just name when no prefix', () => {
    expect(getArtisanDisplayName('Gotō Renjō', 'Gotō')).toBe('Gotō Renjō');
  });

  it('handles Goto Ichijo correctly', () => {
    expect(getArtisanDisplayName('Gotō Ichijō', 'Ichijō')).toBe('Gotō Ichijō');
  });
});

// ---------------------------------------------------------------------------
// GOLDEN TESTS — regressions that MUST NOT break
// ---------------------------------------------------------------------------

describe('GOLDEN — display name regressions', () => {
  it('GOT042: "Ichijō" + "Gotō Ichijō" → "Gotō Ichijō" (not "Ichijō Gotō Ichijō")', () => {
    // This was the Goto Ichijo bug — school as last token of name
    expect(getArtisanDisplayName('Gotō Ichijō', 'Ichijō')).toBe('Gotō Ichijō');
  });

  it('Waki-Goto variant: "Waki-Goto" + "Goto Ichijo" → "Waki-Goto Goto Ichijo"', () => {
    // This falls through to Rule 6 (default) — fixed by ARTISAN_ALIASES, not dedup rules
    // The dedup rules intentionally don't catch this (Waki-Goto and Goto share "Goto"
    // but the hyphenated school is treated as one token)
    expect(getArtisanDisplayName('Goto Ichijo', 'Waki-Goto')).toBe('Waki-Goto Goto Ichijo');
  });
});
