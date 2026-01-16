import { describe, it, expect } from 'vitest';

// Item type normalization - mirrors FilterSidebar.tsx
const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi'];
const TOSOGU_TYPES = ['tsuba', 'fuchi-kashira', 'kozuka', 'menuki', 'koshirae'];

const ITEM_TYPE_NORMALIZE: Record<string, string> = {
  // Japanese kanji
  '甲冑': 'armor',
  '兜': 'kabuto',
  '刀': 'katana',
  '脇差': 'wakizashi',
  '短刀': 'tanto',
  '太刀': 'tachi',
  '槍': 'yari',
  '薙刀': 'naginata',
  '鍔': 'tsuba',
  '小柄': 'kozuka',
  '目貫': 'menuki',
  // Variant spellings
  'Tachi': 'tachi',
  'Katana': 'katana',
  'Wakizashi': 'wakizashi',
  'Tanto': 'tanto',
  'fuchi_kashira': 'fuchi-kashira',
  'tanegashima': 'other',
  'books': 'other',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  kodachi: 'Kodachi',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  armor: 'Armor',
  kabuto: 'Kabuto',
  other: 'Other',
};

const CERT_LABELS: Record<string, string> = {
  Juyo: 'Jūyō',
  juyo: 'Jūyō',
  Tokuju: 'Tokubetsu Jūyō',
  tokuju: 'Tokubetsu Jūyō',
  Hozon: 'Hozon',
  hozon: 'Hozon',
  TokuHozon: 'Tokubetsu Hozon',
  tokubetsu_hozon: 'Tokubetsu Hozon',
  TokuKicho: 'Tokubetsu Kichō',
  nbthk: 'NBTHK',
  nthk: 'NTHK',
};

const CERT_ORDER = ['Tokuju', 'tokuju', 'Juyo', 'juyo', 'TokuHozon', 'tokubetsu_hozon', 'Hozon', 'hozon', 'TokuKicho', 'nbthk', 'nthk'];

function normalizeItemType(value: string): string {
  return ITEM_TYPE_NORMALIZE[value] || value.toLowerCase();
}

function categorizeItemType(normalizedType: string): 'nihonto' | 'tosogu' | 'other' {
  if (NIHONTO_TYPES.includes(normalizedType)) return 'nihonto';
  if (TOSOGU_TYPES.includes(normalizedType)) return 'tosogu';
  return 'other';
}

describe('Item Type Normalization', () => {
  describe('Japanese kanji normalization', () => {
    it('should normalize 刀 to katana', () => {
      expect(normalizeItemType('刀')).toBe('katana');
    });

    it('should normalize 脇差 to wakizashi', () => {
      expect(normalizeItemType('脇差')).toBe('wakizashi');
    });

    it('should normalize 短刀 to tanto', () => {
      expect(normalizeItemType('短刀')).toBe('tanto');
    });

    it('should normalize 太刀 to tachi', () => {
      expect(normalizeItemType('太刀')).toBe('tachi');
    });

    it('should normalize 鍔 to tsuba', () => {
      expect(normalizeItemType('鍔')).toBe('tsuba');
    });

    it('should normalize 小柄 to kozuka', () => {
      expect(normalizeItemType('小柄')).toBe('kozuka');
    });

    it('should normalize 目貫 to menuki', () => {
      expect(normalizeItemType('目貫')).toBe('menuki');
    });

    it('should normalize 甲冑 to armor', () => {
      expect(normalizeItemType('甲冑')).toBe('armor');
    });

    it('should normalize 兜 to kabuto', () => {
      expect(normalizeItemType('兜')).toBe('kabuto');
    });
  });

  describe('Case variant normalization', () => {
    it('should normalize Tachi to tachi', () => {
      expect(normalizeItemType('Tachi')).toBe('tachi');
    });

    it('should normalize Katana to katana', () => {
      expect(normalizeItemType('Katana')).toBe('katana');
    });

    it('should normalize Wakizashi to wakizashi', () => {
      expect(normalizeItemType('Wakizashi')).toBe('wakizashi');
    });

    it('should normalize Tanto to tanto', () => {
      expect(normalizeItemType('Tanto')).toBe('tanto');
    });
  });

  describe('Special cases', () => {
    it('should normalize fuchi_kashira to fuchi-kashira', () => {
      expect(normalizeItemType('fuchi_kashira')).toBe('fuchi-kashira');
    });

    it('should normalize tanegashima to other', () => {
      expect(normalizeItemType('tanegashima')).toBe('other');
    });

    it('should normalize books to other', () => {
      expect(normalizeItemType('books')).toBe('other');
    });
  });

  describe('Lowercase fallback', () => {
    it('should lowercase unknown types', () => {
      expect(normalizeItemType('YARI')).toBe('yari');
      expect(normalizeItemType('Naginata')).toBe('naginata');
    });
  });
});

describe('Item Type Categorization', () => {
  describe('Nihonto types', () => {
    NIHONTO_TYPES.forEach(type => {
      it(`should categorize ${type} as nihonto`, () => {
        expect(categorizeItemType(type)).toBe('nihonto');
      });
    });
  });

  describe('Tosogu types', () => {
    TOSOGU_TYPES.forEach(type => {
      it(`should categorize ${type} as tosogu`, () => {
        expect(categorizeItemType(type)).toBe('tosogu');
      });
    });
  });

  describe('Other types', () => {
    it('should categorize armor as other', () => {
      expect(categorizeItemType('armor')).toBe('other');
    });

    it('should categorize kabuto as other', () => {
      expect(categorizeItemType('kabuto')).toBe('other');
    });

    it('should categorize unknown types as other', () => {
      expect(categorizeItemType('unknown')).toBe('other');
    });
  });
});

describe('Item Type Labels', () => {
  it('should have labels for all nihonto types', () => {
    NIHONTO_TYPES.forEach(type => {
      expect(ITEM_TYPE_LABELS[type]).toBeDefined();
    });
  });

  it('should have labels for all tosogu types', () => {
    TOSOGU_TYPES.forEach(type => {
      expect(ITEM_TYPE_LABELS[type]).toBeDefined();
    });
  });

  it('should use proper Japanese macrons', () => {
    expect(ITEM_TYPE_LABELS['tanto']).toBe('Tantō');
  });
});

describe('Certification Labels', () => {
  it('should format Juyo with macron', () => {
    expect(CERT_LABELS['Juyo']).toBe('Jūyō');
    expect(CERT_LABELS['juyo']).toBe('Jūyō');
  });

  it('should format Tokuju as Tokubetsu Jūyō', () => {
    expect(CERT_LABELS['Tokuju']).toBe('Tokubetsu Jūyō');
    expect(CERT_LABELS['tokuju']).toBe('Tokubetsu Jūyō');
  });

  it('should format TokuHozon as Tokubetsu Hozon', () => {
    expect(CERT_LABELS['TokuHozon']).toBe('Tokubetsu Hozon');
    expect(CERT_LABELS['tokubetsu_hozon']).toBe('Tokubetsu Hozon');
  });

  it('should format TokuKicho with macron', () => {
    expect(CERT_LABELS['TokuKicho']).toBe('Tokubetsu Kichō');
  });
});

describe('Certification Ordering', () => {
  it('should have Tokuju ranked higher than Juyo', () => {
    const tokujuIndex = CERT_ORDER.indexOf('Tokuju');
    const juyoIndex = CERT_ORDER.indexOf('Juyo');
    expect(tokujuIndex).toBeLessThan(juyoIndex);
  });

  it('should have Juyo ranked higher than TokuHozon', () => {
    const juyoIndex = CERT_ORDER.indexOf('Juyo');
    const tokuHozonIndex = CERT_ORDER.indexOf('TokuHozon');
    expect(juyoIndex).toBeLessThan(tokuHozonIndex);
  });

  it('should have TokuHozon ranked higher than Hozon', () => {
    const tokuHozonIndex = CERT_ORDER.indexOf('TokuHozon');
    const hozonIndex = CERT_ORDER.indexOf('Hozon');
    expect(tokuHozonIndex).toBeLessThan(hozonIndex);
  });
});

describe('Full Normalization Pipeline', () => {
  const testCases = [
    { input: '刀', normalized: 'katana', category: 'nihonto', label: 'Katana' },
    { input: 'Tachi', normalized: 'tachi', category: 'nihonto', label: 'Tachi' },
    { input: '鍔', normalized: 'tsuba', category: 'tosogu', label: 'Tsuba' },
    { input: 'fuchi_kashira', normalized: 'fuchi-kashira', category: 'tosogu', label: 'Fuchi-Kashira' },
    { input: '甲冑', normalized: 'armor', category: 'other', label: 'Armor' },
  ];

  testCases.forEach(({ input, normalized, category, label }) => {
    it(`should correctly process ${input}`, () => {
      const normalizedResult = normalizeItemType(input);
      expect(normalizedResult).toBe(normalized);
      expect(categorizeItemType(normalizedResult)).toBe(category);
      expect(ITEM_TYPE_LABELS[normalizedResult]).toBe(label);
    });
  });
});
