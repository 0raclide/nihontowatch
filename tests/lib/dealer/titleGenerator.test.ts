import { describe, it, expect } from 'vitest';
import { generateListingTitle } from '@/lib/dealer/titleGenerator';

// =============================================================================
// Title Generator — Golden Tests
//
// The title generator creates bilingual (EN/JA) titles from structured fields.
// Pattern: {cert} {type} — {artisan}
// =============================================================================

describe('generateListingTitle', () => {
  // -------------------------------------------------------------------------
  // Full title with all parts
  // -------------------------------------------------------------------------

  it('generates full EN title: cert + type + artisan', () => {
    const { en } = generateListingTitle('Juyo', 'katana', 'Kanemitsu', '兼光');
    expect(en).toBe('Juyo Katana — Kanemitsu');
  });

  it('generates full JA title: cert + type + artisan kanji', () => {
    const { ja } = generateListingTitle('Juyo', 'katana', 'Kanemitsu', '兼光');
    expect(ja).toBe('重要刀剣 刀 — 兼光');
  });

  // -------------------------------------------------------------------------
  // All cert types map correctly
  // -------------------------------------------------------------------------

  it('maps Tokubetsu Juyo cert in EN', () => {
    const { en } = generateListingTitle('Tokubetsu Juyo', 'katana', null, null);
    expect(en).toBe('Tokubetsu Juyo Katana');
  });

  it('maps Tokubetsu Juyo cert in JA', () => {
    const { ja } = generateListingTitle('Tokubetsu Juyo', 'katana', null, null);
    expect(ja).toBe('特別重要刀剣 刀');
  });

  it('maps Tokubetsu Hozon cert', () => {
    const { en, ja } = generateListingTitle('Tokubetsu Hozon', 'wakizashi', null, null);
    expect(en).toBe('Tokubetsu Hozon Wakizashi');
    expect(ja).toBe('特別保存刀剣 脇差');
  });

  it('maps Hozon cert', () => {
    const { en, ja } = generateListingTitle('Hozon', 'tanto', null, null);
    expect(en).toBe('Hozon Tanto');
    expect(ja).toBe('保存刀剣 短刀');
  });

  // -------------------------------------------------------------------------
  // All item types map correctly
  // -------------------------------------------------------------------------

  it('maps all nihonto types in JA', () => {
    const types: Record<string, string> = {
      katana: '刀', wakizashi: '脇差', tanto: '短刀',
      tachi: '太刀', naginata: '薙刀', yari: '槍',
    };
    for (const [en, ja] of Object.entries(types)) {
      const result = generateListingTitle(null, en, null, null);
      expect(result.ja).toBe(ja);
    }
  });

  it('maps all tosogu types in JA', () => {
    const types: Record<string, string> = {
      tsuba: '鍔', fuchi_kashira: '縁頭', menuki: '目貫',
      kozuka: '小柄', kogai: '笄',
    };
    for (const [en, ja] of Object.entries(types)) {
      const result = generateListingTitle(null, en, null, null);
      expect(result.ja).toBe(ja);
    }
  });

  it('maps fuchi_kashira to Fuchi-Kashira in EN', () => {
    const { en } = generateListingTitle(null, 'fuchi_kashira', null, null);
    expect(en).toBe('Fuchi-Kashira');
  });

  // -------------------------------------------------------------------------
  // Partial titles — missing fields
  // -------------------------------------------------------------------------

  it('generates title with only artisan name (no cert, no type)', () => {
    const { en, ja } = generateListingTitle(null, null, 'Masamune', '正宗');
    expect(en).toBe('— Masamune');
    expect(ja).toBe('— 正宗');
  });

  it('generates title with cert only', () => {
    const { en, ja } = generateListingTitle('Juyo', null, null, null);
    expect(en).toBe('Juyo');
    expect(ja).toBe('重要刀剣');
  });

  it('generates title with type only', () => {
    const { en, ja } = generateListingTitle(null, 'katana', null, null);
    expect(en).toBe('Katana');
    expect(ja).toBe('刀');
  });

  it('generates title with cert + artisan (no type)', () => {
    const { en } = generateListingTitle('Juyo', null, 'Tadayoshi', '忠吉');
    expect(en).toBe('Juyo — Tadayoshi');
  });

  it('generates title with type + artisan (no cert)', () => {
    const { en, ja } = generateListingTitle(null, 'tsuba', 'Nobuie', '信家');
    expect(en).toBe('Tsuba — Nobuie');
    expect(ja).toBe('鍔 — 信家');
  });

  // -------------------------------------------------------------------------
  // JA artisan fallback — uses romaji when kanji unavailable
  // -------------------------------------------------------------------------

  it('JA falls back to romaji artisan name when kanji is null', () => {
    const { ja } = generateListingTitle('Juyo', 'katana', 'Kanemitsu', null);
    expect(ja).toBe('重要刀剣 刀 — Kanemitsu');
  });

  it('JA prefers kanji over romaji when both provided', () => {
    const { ja } = generateListingTitle(null, 'katana', 'Kanemitsu', '兼光');
    expect(ja).toBe('刀 — 兼光');
  });

  // -------------------------------------------------------------------------
  // Empty / all-null — returns "Untitled" / "無題"
  // -------------------------------------------------------------------------

  it('returns "Untitled" / "無題" when all fields are null', () => {
    const { en, ja } = generateListingTitle(null, null, null, null);
    expect(en).toBe('Untitled');
    expect(ja).toBe('無題');
  });

  // -------------------------------------------------------------------------
  // Unknown cert / type — passthrough
  // -------------------------------------------------------------------------

  it('passes through unknown cert type as-is (no map entry)', () => {
    const { en, ja } = generateListingTitle('NTHK', 'katana', null, null);
    // NTHK not in CERT_EN_MAP → omitted from title, type still maps
    expect(en).toBe('Katana');
    expect(ja).toBe('刀');
  });

  it('passes through unknown item type raw when not in map', () => {
    const { en, ja } = generateListingTitle(null, 'jutte', null, null);
    // Not in TYPE_EN_MAP → raw value used
    expect(en).toBe('jutte');
    expect(ja).toBe('jutte');
  });

  // -------------------------------------------------------------------------
  // Case insensitivity — type lookup lowercases
  // -------------------------------------------------------------------------

  it('handles uppercase item type via lowercase lookup', () => {
    const { en, ja } = generateListingTitle(null, 'KATANA', null, null);
    expect(en).toBe('Katana');
    expect(ja).toBe('刀');
  });

  it('handles mixed-case item type', () => {
    const { en } = generateListingTitle(null, 'Wakizashi', null, null);
    expect(en).toBe('Wakizashi');
  });
});
