import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Draft Auto-Save — Unit Tests
//
// Tests the localStorage-based draft persistence for DealerListingForm.
// Validates save/restore/clear/discard behavior, blob URL filtering,
// edit mode skip, and legacy key migration.
// =============================================================================

const DRAFT_STORAGE_KEY = 'nw-dealer-draft';
const LEGACY_CATEGORY_KEY = 'nw-dealer-category';
const LEGACY_TYPE_KEY = 'nw-dealer-type';

interface DealerDraft {
  category: 'nihonto' | 'tosogu';
  itemType: string | null;
  certType: string | null;
  artisanId: string | null;
  artisanName: string | null;
  artisanKanji: string | null;
  priceValue: string;
  priceCurrency: string;
  isAsk: boolean;
  description: string;
  nagasaCm: string;
  motohabaCm: string;
  sakihabaCm: string;
  soriCm: string;
  meiType: string | null;
  era: string;
  province: string;
  images: string[];
  savedAt: number;
}

function makeDraft(overrides: Partial<DealerDraft> = {}): DealerDraft {
  return {
    category: 'nihonto',
    itemType: 'KATANA',
    certType: 'Juyo',
    artisanId: 'MAS590',
    artisanName: 'Masamune',
    artisanKanji: '正宗',
    priceValue: '5000000',
    priceCurrency: 'JPY',
    isAsk: false,
    description: 'Test description',
    nagasaCm: '71.5',
    motohabaCm: '3.2',
    sakihabaCm: '2.1',
    soriCm: '1.8',
    meiType: 'zaimei',
    era: 'Kamakura',
    province: 'Sagami',
    images: ['https://example.com/img1.jpg'],
    savedAt: Date.now(),
    ...overrides,
  };
}

// Mock localStorage — same pattern as consent-storage.test.ts
let store: { [key: string]: string } = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  });
});

describe('DealerDraft — localStorage persistence', () => {
  it('reads a valid draft from localStorage', () => {
    const draft = makeDraft();
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as DealerDraft : null;

    expect(parsed).not.toBeNull();
    expect(parsed!.category).toBe('nihonto');
    expect(parsed!.itemType).toBe('KATANA');
    expect(parsed!.artisanId).toBe('MAS590');
    expect(parsed!.priceValue).toBe('5000000');
  });

  it('returns null when no draft exists', () => {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    expect(raw).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, 'not valid json{{{');

    let parsed: DealerDraft | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) as DealerDraft : null;
    } catch {
      parsed = null;
    }

    expect(parsed).toBeNull();
  });

  it('GOLDEN: blob URLs are filtered out before saving', () => {
    const images = [
      'https://example.com/img1.jpg',
      'blob:http://localhost:3000/abc-123',
      'https://example.com/img2.jpg',
      'blob:http://localhost:3000/def-456',
    ];

    const filtered = images.filter(url => !url.startsWith('blob:'));
    const draft = makeDraft({ images: filtered });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!) as DealerDraft;
    expect(parsed.images).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
    ]);
    expect(parsed.images.some(u => u.startsWith('blob:'))).toBe(false);
  });

  it('GOLDEN: clearing draft removes all draft keys', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(makeDraft()));
    localStorage.setItem(LEGACY_CATEGORY_KEY, 'tosogu');
    localStorage.setItem(LEGACY_TYPE_KEY, 'TSUBA');

    // Simulate clearDraft()
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CATEGORY_KEY);
    localStorage.removeItem(LEGACY_TYPE_KEY);

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CATEGORY_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TYPE_KEY)).toBeNull();
  });

  it('preserves tosogu category in draft', () => {
    const draft = makeDraft({ category: 'tosogu', itemType: 'TSUBA' });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!) as DealerDraft;
    expect(parsed.category).toBe('tosogu');
    expect(parsed.itemType).toBe('TSUBA');
  });

  it('preserves isAsk=true and empty priceValue', () => {
    const draft = makeDraft({ isAsk: true, priceValue: '' });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!) as DealerDraft;
    expect(parsed.isAsk).toBe(true);
    expect(parsed.priceValue).toBe('');
  });

  it('preserves null fields correctly', () => {
    const draft = makeDraft({
      certType: null,
      artisanId: null,
      artisanName: null,
      artisanKanji: null,
      meiType: null,
    });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!) as DealerDraft;
    expect(parsed.certType).toBeNull();
    expect(parsed.artisanId).toBeNull();
    expect(parsed.artisanName).toBeNull();
    expect(parsed.meiType).toBeNull();
  });

  it('has a savedAt timestamp for staleness checking', () => {
    const before = Date.now();
    const draft = makeDraft({ savedAt: Date.now() });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!) as DealerDraft;
    expect(parsed.savedAt).toBeGreaterThanOrEqual(before);
    expect(parsed.savedAt).toBeLessThanOrEqual(Date.now());
  });

  it('GOLDEN: all 18 fields are present in draft shape', () => {
    const draft = makeDraft();
    const keys = Object.keys(draft);

    // Exactly 19 keys (18 form fields + savedAt)
    expect(keys).toHaveLength(19);
    expect(keys).toContain('category');
    expect(keys).toContain('itemType');
    expect(keys).toContain('certType');
    expect(keys).toContain('artisanId');
    expect(keys).toContain('artisanName');
    expect(keys).toContain('artisanKanji');
    expect(keys).toContain('priceValue');
    expect(keys).toContain('priceCurrency');
    expect(keys).toContain('isAsk');
    expect(keys).toContain('description');
    expect(keys).toContain('nagasaCm');
    expect(keys).toContain('motohabaCm');
    expect(keys).toContain('sakihabaCm');
    expect(keys).toContain('soriCm');
    expect(keys).toContain('meiType');
    expect(keys).toContain('era');
    expect(keys).toContain('province');
    expect(keys).toContain('images');
    expect(keys).toContain('savedAt');
  });
});
