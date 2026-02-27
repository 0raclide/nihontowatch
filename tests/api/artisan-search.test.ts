/**
 * Artisan Search API Tests
 *
 * Tests for /api/artisan/search endpoint.
 * Verifies that both artisan_makers and artisan_schools tables are searched,
 * school codes (NS-*) are returned, and results are properly merged.
 *
 * GOLDEN TEST: Before this fix, searching "NS-Sue-Sa" returned zero results
 * because the API only queried artisan_makers, not artisan_schools.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------- Mock data ----------

const MOCK_MAKER = {
  maker_id: 'SAM123',
  name_romaji: 'Samonji',
  name_kanji: '左文字',
  name_romaji_normalized: 'samonji',
  display_name: 'Samonji',
  legacy_school_text: 'Sa',
  province: 'Chikuzen',
  era: 'Nanbokucho',
  generation: '1st',
  domain: 'sword',
  hawley: 300,
  fujishiro: 'Sai-jo saku',
  elite_factor: 0.35,
  juyo_count: 47,
  tokuju_count: 3,
  total_items: 156,
  teacher_text: 'Masamune',
  period: '1334-1369',
};

const MOCK_TOSOGU_MAKER = {
  maker_id: 'GOT001',
  name_romaji: 'Goto Yujo',
  name_kanji: '後藤祐乗',
  name_romaji_normalized: 'goto yujo',
  display_name: 'Goto Yujo',
  legacy_school_text: 'Goto',
  province: 'Yamashiro',
  era: 'Muromachi',
  generation: '1st',
  domain: 'tosogu',
  hawley: 350,
  fujishiro: null,
  elite_factor: 0.12,
  juyo_count: 8,
  tokuju_count: 0,
  total_items: 42,
  teacher_text: null,
  period: '1440-1512',
};

const MOCK_SCHOOL = {
  school_id: 'NS-Sue-Sa',
  name_romaji: 'Sue-Sa',
  name_kanji: '末左',
  domain: 'sword',
  tradition: 'Soshu-den',
  province: 'Chikuzen',
  era_start: 'Muromachi',
  era_end: 'Shinto',
  characteristics: 'Late Sa school works',
  elite_factor: 0.04,
  juyo_count: 12,
  tokuju_count: 0,
  total_items: 89,
};

// ---------- Mutable mock state (read by mock factories at call time) ----------

const mockState = {
  makersData: [MOCK_MAKER] as Record<string, unknown>[],
  makersError: null as { message: string } | null,
  schoolsData: [MOCK_SCHOOL] as Record<string, unknown>[],
  schoolsError: null as { message: string } | null,
  makersCalls: { or: [] as string[], inDomain: [] as string[][] },
  schoolsCalls: { or: [] as string[], inDomain: [] as string[][] },
};

function createChainedBuilder(target: 'makers' | 'schools') {
  const calls = target === 'makers' ? mockState.makersCalls : mockState.schoolsCalls;
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    or: vi.fn((pattern: string) => { calls.or.push(pattern); return builder; }),
    in: vi.fn((_col: string, vals: string[]) => { calls.inDomain.push(vals); return builder; }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => {
      const data = target === 'makers' ? mockState.makersData : mockState.schoolsData;
      const error = target === 'makers' ? mockState.makersError : mockState.schoolsError;
      return Promise.resolve({ data, error });
    }),
  };
  return builder;
}

// ---------- Env vars must be set BEFORE module evaluation (isYuhinkaiConfigured) ----------

vi.hoisted(() => {
  process.env.YUHINKAI_SUPABASE_URL = 'https://test.supabase.co';
  process.env.YUHINKAI_SUPABASE_KEY = 'test-key';
});

// ---------- Mocks ----------

vi.mock('@/lib/supabase/yuhinkai', () => ({
  yuhinkaiClient: {
    from: vi.fn((table: string) => {
      if (table === 'artisan_makers') return createChainedBuilder('makers');
      if (table === 'artisan_schools') return createChainedBuilder('schools');
      throw new Error(`Unexpected table: ${table}`);
    }),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveSchoolName: (row: any) => {
    const joined = row?.artisan_schools;
    if (joined && !Array.isArray(joined) && joined.name_romaji) return joined.name_romaji;
    return row?.legacy_school_text ?? null;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/lib/admin/auth', () => ({
  verifyAdmin: vi.fn(() => Promise.resolve({ isAdmin: true, user: { id: 'admin-1' } })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), logError: vi.fn(), info: vi.fn() },
}));

import { GET } from '@/app/api/artisan/search/route';

// ---------- Helpers ----------

function createRequest(query: string, type?: string, limit?: number): NextRequest {
  const params = new URLSearchParams({ q: query });
  if (type) params.set('type', type);
  if (limit) params.set('limit', String(limit));
  return new NextRequest(`http://localhost:3000/api/artisan/search?${params.toString()}`);
}

async function getResults(query: string, type?: string, limit?: number) {
  const req = createRequest(query, type, limit);
  const res = await GET(req);
  return res.json();
}

// ---------- Tests ----------

describe('Artisan Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.makersData = [MOCK_MAKER];
    mockState.makersError = null;
    mockState.schoolsData = [MOCK_SCHOOL];
    mockState.schoolsError = null;
    mockState.makersCalls = { or: [], inDomain: [] };
    mockState.schoolsCalls = { or: [], inDomain: [] };
  });

  // ---- GOLDEN TEST: School codes must be findable ----
  it('finds school codes like NS-Sue-Sa in artisan_schools table', async () => {
    mockState.makersData = [];
    mockState.schoolsData = [MOCK_SCHOOL];

    const data = await getResults('NS-Sue-Sa');

    expect(data.results).toHaveLength(1);
    expect(data.results[0].code).toBe('NS-Sue-Sa');
    expect(data.results[0].type).toBe('school');
    expect(data.results[0].name_romaji).toBe('Sue-Sa');
    expect(data.results[0].province).toBe('Chikuzen');
  });

  it('queries both artisan_makers and artisan_schools in parallel', async () => {
    const { yuhinkaiClient } = await import('@/lib/supabase/yuhinkai');

    await getResults('Samonji');

    expect(yuhinkaiClient.from).toHaveBeenCalledWith('artisan_makers');
    expect(yuhinkaiClient.from).toHaveBeenCalledWith('artisan_schools');
  });

  it('returns school results before maker results', async () => {
    mockState.makersData = [MOCK_MAKER];
    mockState.schoolsData = [MOCK_SCHOOL];

    const data = await getResults('Sa');

    expect(data.results.length).toBeGreaterThanOrEqual(2);
    expect(data.results[0].type).toBe('school');
    expect(data.results[0].code).toBe('NS-Sue-Sa');
    expect(data.results[1].type).toBe('smith');
    expect(data.results[1].code).toBe('SAM123');
  });

  it('maps school fields correctly', async () => {
    mockState.makersData = [];
    mockState.schoolsData = [MOCK_SCHOOL];

    const data = await getResults('Sue-Sa');
    const school = data.results[0];

    expect(school.code).toBe('NS-Sue-Sa');
    expect(school.type).toBe('school');
    expect(school.name_kanji).toBe('末左');
    expect(school.display_name).toBe('Sue-Sa');
    expect(school.school).toBe('Soshu-den');
    expect(school.province).toBe('Chikuzen');
    expect(school.era).toBe('Muromachi – Shinto');
    expect(school.generation).toBeNull();
    expect(school.hawley).toBeNull();
    expect(school.fujishiro).toBeNull();
    expect(school.elite_factor).toBe(0.04);
    expect(school.juyo_count).toBe(12);
    expect(school.tokuju_count).toBe(0);
    expect(school.total_items).toBe(89);
    expect(school.teacher_text).toBeNull();
    expect(school.period).toBeNull();
  });

  it('maps maker fields correctly (unchanged behavior)', async () => {
    mockState.makersData = [MOCK_MAKER];
    mockState.schoolsData = [];

    const data = await getResults('Samonji');
    const maker = data.results[0];

    expect(maker.code).toBe('SAM123');
    expect(maker.type).toBe('smith');
    expect(maker.name_kanji).toBe('左文字');
    expect(maker.display_name).toBe('Samonji');
    expect(maker.school).toBe('Sa');
    expect(maker.province).toBe('Chikuzen');
    expect(maker.era).toBe('Nanbokucho');
    expect(maker.generation).toBe('1st');
    expect(maker.hawley).toBe(300);
    expect(maker.fujishiro).toBe('Sai-jo saku');
    expect(maker.elite_factor).toBe(0.35);
    expect(maker.juyo_count).toBe(47);
    expect(maker.tokuju_count).toBe(3);
    expect(maker.total_items).toBe(156);
    expect(maker.teacher_text).toBe('Masamune');
    expect(maker.period).toBe('1334-1369');
  });

  it('maps tosogu maker with correct type', async () => {
    mockState.makersData = [MOCK_TOSOGU_MAKER];
    mockState.schoolsData = [];

    const data = await getResults('Goto');
    expect(data.results[0].type).toBe('tosogu');
  });

  // ---- Domain filtering ----
  it('applies domain filter for smith type to both tables', async () => {
    await getResults('test', 'smith');

    expect(mockState.makersCalls.inDomain).toEqual([['sword', 'both']]);
    expect(mockState.schoolsCalls.inDomain).toEqual([['sword', 'both']]);
  });

  it('applies domain filter for tosogu type to both tables', async () => {
    await getResults('test', 'tosogu');

    expect(mockState.makersCalls.inDomain).toEqual([['tosogu', 'both']]);
    expect(mockState.schoolsCalls.inDomain).toEqual([['tosogu', 'both']]);
  });

  it('does not apply domain filter for "all" type', async () => {
    await getResults('test', 'all');

    expect(mockState.makersCalls.inDomain).toEqual([]);
    expect(mockState.schoolsCalls.inDomain).toEqual([]);
  });

  // ---- Limit ----
  it('respects limit parameter across merged results', async () => {
    mockState.makersData = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_MAKER, maker_id: `SAM${i}`,
    }));
    mockState.schoolsData = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_SCHOOL, school_id: `NS-School${i}`,
    }));

    const data = await getResults('test', 'all', 3);
    expect(data.results).toHaveLength(3);
  });

  // ---- Error handling ----
  it('returns maker results when schools query fails', async () => {
    mockState.makersData = [MOCK_MAKER];
    mockState.makersError = null;
    mockState.schoolsData = []; // Supabase returns null data on error
    mockState.schoolsError = { message: 'schools table error' };

    const data = await getResults('Samonji');

    expect(data.results).toHaveLength(1);
    expect(data.results[0].code).toBe('SAM123');
  });

  it('returns school results when makers query fails', async () => {
    mockState.makersData = []; // Supabase returns null data on error
    mockState.makersError = { message: 'makers table error' };
    mockState.schoolsData = [MOCK_SCHOOL];
    mockState.schoolsError = null;

    const data = await getResults('Sue-Sa');

    expect(data.results).toHaveLength(1);
    expect(data.results[0].code).toBe('NS-Sue-Sa');
  });

  it('returns 500 when both queries fail', async () => {
    mockState.makersError = { message: 'makers fail' };
    mockState.schoolsError = { message: 'schools fail' };

    const req = createRequest('test');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Search query failed');
  });

  // ---- Input validation ----
  it('rejects queries shorter than 2 characters', async () => {
    const req = createRequest('a');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('escapes special ilike characters in query', async () => {
    await getResults('test%name');

    expect(mockState.makersCalls.or.length).toBe(1);
    expect(mockState.makersCalls.or[0]).toContain('test\\%name');
    expect(mockState.schoolsCalls.or.length).toBe(1);
    expect(mockState.schoolsCalls.or[0]).toContain('test\\%name');
  });

  // ---- School era formatting ----
  it('formats school era from era_start and era_end', async () => {
    mockState.makersData = [];
    mockState.schoolsData = [MOCK_SCHOOL];

    const data = await getResults('Sue-Sa');
    expect(data.results[0].era).toBe('Muromachi – Shinto');
  });

  it('handles school with only era_start', async () => {
    mockState.makersData = [];
    mockState.schoolsData = [{ ...MOCK_SCHOOL, era_end: null }];

    const data = await getResults('Sue-Sa');
    expect(data.results[0].era).toBe('Muromachi');
  });

  it('handles school with no era fields', async () => {
    mockState.makersData = [];
    mockState.schoolsData = [{ ...MOCK_SCHOOL, era_start: null, era_end: null }];

    const data = await getResults('Sue-Sa');
    expect(data.results[0].era).toBeNull();
  });
});
