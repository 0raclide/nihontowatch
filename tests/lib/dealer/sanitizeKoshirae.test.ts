import { describe, it, expect } from 'vitest';
import { sanitizeKoshirae } from '@/lib/dealer/sanitizeKoshirae';

describe('sanitizeKoshirae', () => {
  it('returns null for falsy input', () => {
    expect(sanitizeKoshirae(null)).toBeNull();
    expect(sanitizeKoshirae(undefined)).toBeNull();
    expect(sanitizeKoshirae('')).toBeNull();
    expect(sanitizeKoshirae(0)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(sanitizeKoshirae('hello')).toBeNull();
    expect(sanitizeKoshirae(42)).toBeNull();
    expect(sanitizeKoshirae(true)).toBeNull();
  });

  it('produces a valid KoshiraeData from minimal input', () => {
    const result = sanitizeKoshirae({});
    expect(result).toEqual({
      cert_type: null,
      cert_in_blade_paper: false,
      cert_session: null,
      description: null,
      images: [],
      artisan_id: null,
      artisan_name: null,
      artisan_kanji: null,
      components: [],
      setsumei_text_en: null,
      setsumei_text_ja: null,
      catalog_object_uuid: null,
      era: null,
      province: null,
      school: null,
    });
  });

  it('passes through valid fields', () => {
    const result = sanitizeKoshirae({
      cert_type: 'juyo',
      cert_in_blade_paper: true,
      cert_session: 42,
      description: 'Fine condition',
      artisan_id: 'NOB123',
      artisan_name: 'Nobuie',
      artisan_kanji: '信家',
      era: 'Muromachi',
      province: 'Owari',
      school: 'Myochin',
    });
    expect(result!.cert_type).toBe('juyo');
    expect(result!.cert_in_blade_paper).toBe(true);
    expect(result!.cert_session).toBe(42);
    expect(result!.description).toBe('Fine condition');
    expect(result!.artisan_id).toBe('NOB123');
    expect(result!.era).toBe('Muromachi');
    expect(result!.province).toBe('Owari');
    expect(result!.school).toBe('Myochin');
  });

  it('strips blob: URLs from images', () => {
    const result = sanitizeKoshirae({
      images: [
        'https://example.com/photo.jpg',
        'blob:http://localhost:3000/abc123',
        'https://cdn.example.com/img2.webp',
      ],
    });
    expect(result!.images).toEqual([
      'https://example.com/photo.jpg',
      'https://cdn.example.com/img2.webp',
    ]);
  });

  it('strips non-string entries from images', () => {
    const result = sanitizeKoshirae({
      images: ['https://valid.jpg', 42, null, undefined, true],
    });
    expect(result!.images).toEqual(['https://valid.jpg']);
  });

  it('trims strings and enforces length limits', () => {
    const result = sanitizeKoshirae({
      era: '  Meiji  ',
      province: 'A'.repeat(200),
      school: '',
    });
    expect(result!.era).toBe('Meiji');
    expect(result!.province!.length).toBe(100);
    expect(result!.school).toBeNull(); // empty string → null
  });

  it('strips arbitrary injected fields', () => {
    const result = sanitizeKoshirae({
      cert_type: 'hozon',
      __proto__: { admin: true },
      evil_field: 'DROP TABLE listings',
      constructor: 'overwrite',
    });
    expect(result).toBeDefined();
    expect((result as any).evil_field).toBeUndefined();
    // constructor is a native property on all objects, so just verify the injected string didn't land
    expect(typeof result!.constructor).toBe('function');
    expect(result!.cert_type).toBe('hozon');
  });

  describe('component sanitization', () => {
    it('sanitizes component fields', () => {
      const result = sanitizeKoshirae({
        components: [{
          id: 'abc-123',
          component_type: 'tsuba',
          artisan_id: 'NOB123',
          artisan_name: 'Nobuie',
          artisan_kanji: '信家',
          description: 'Iron tsuba',
          signed: true,
          mei_text: '信家',
        }],
      });
      expect(result!.components).toHaveLength(1);
      const comp = result!.components[0];
      expect(comp.id).toBe('abc-123');
      expect(comp.component_type).toBe('tsuba');
      expect(comp.signed).toBe(true);
      expect(comp.mei_text).toBe('信家');
    });

    it('nulls mei_text when signed is false', () => {
      const result = sanitizeKoshirae({
        components: [{
          id: 'abc',
          component_type: 'tsuba',
          signed: false,
          mei_text: 'should be stripped',
        }],
      });
      expect(result!.components[0].signed).toBe(false);
      expect(result!.components[0].mei_text).toBeNull();
    });

    it('defaults invalid component_type to other', () => {
      const result = sanitizeKoshirae({
        components: [{
          id: 'abc',
          component_type: 'INVALID_TYPE',
        }],
      });
      expect(result!.components[0].component_type).toBe('other');
    });

    it('assigns UUID for missing component id', () => {
      const result = sanitizeKoshirae({
        components: [{ component_type: 'kozuka' }],
      });
      expect(result!.components[0].id).toBeTruthy();
      expect(typeof result!.components[0].id).toBe('string');
    });

    it('strips injected fields from components', () => {
      const result = sanitizeKoshirae({
        components: [{
          id: 'abc',
          component_type: 'tsuba',
          evil: 'payload',
          admin: true,
        }],
      });
      const comp = result!.components[0] as any;
      expect(comp.evil).toBeUndefined();
      expect(comp.admin).toBeUndefined();
    });

    it('enforces mei_text length limit', () => {
      const result = sanitizeKoshirae({
        components: [{
          id: 'abc',
          component_type: 'menuki',
          signed: true,
          mei_text: 'X'.repeat(300),
        }],
      });
      expect(result!.components[0].mei_text!.length).toBe(200);
    });

    it('handles non-object components gracefully', () => {
      const result = sanitizeKoshirae({
        components: [null, 'string', 42, { id: 'real', component_type: 'kogai' }],
      });
      expect(result!.components).toHaveLength(4);
      // Non-object entries get default values
      expect(result!.components[0].component_type).toBe('other');
      expect(result!.components[3].component_type).toBe('kogai');
    });
  });

  it('handles backward-compatible data (no era/province/school/signed)', () => {
    const legacyData = {
      cert_type: 'juyo',
      cert_in_blade_paper: false,
      cert_session: 10,
      description: null,
      images: [],
      artisan_id: 'GOT042',
      artisan_name: 'Goto Ichijo',
      artisan_kanji: '後藤一乗',
      components: [],
      setsumei_text_en: null,
      setsumei_text_ja: null,
      catalog_object_uuid: null,
      // No era, province, school, signed, mei_text
    };
    const result = sanitizeKoshirae(legacyData);
    expect(result!.era).toBeNull();
    expect(result!.province).toBeNull();
    expect(result!.school).toBeNull();
    expect(result!.artisan_id).toBe('GOT042');
  });
});
