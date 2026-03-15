/**
 * Tests for collection-context catalog match and generate-description endpoints.
 *
 * These endpoints mirror /api/dealer/catalog-match and /api/dealer/generate-description
 * but use checkCollectionAccess() instead of verifyDealer(), allowing inner_circle and
 * admin users to access catalog match and scholar's note generation from the vault.
 *
 * Bug context: CatalogMatchPanel and handleGenerateNote in DealerListingForm previously
 * hardcoded dealer-only API paths. Inner_circle/admin users got 403 errors when using
 * these features from the collection context. The fix passes `apiBase` from the form
 * context so collection mode hits /api/collection/* instead of /api/dealer/*.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Hoisted mocks — available inside vi.mock() factories
// =============================================================================

const {
  mockGetUser,
  mockCheckCollectionAccess,
  mockYuhinkaiConfigured,
  mockYuhinkaiRpc,
  mockGetArtisan,
  mockGetAiDescription,
  mockBuildArtistPageData,
  mockDistillArtistOverview,
  mockAssembleCuratorContextFromFormData,
  mockShouldSkipGeneration,
  mockGetDataRichness,
  mockGenerateCuratorNote,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckCollectionAccess: vi.fn(),
  mockYuhinkaiConfigured: { value: true },
  mockYuhinkaiRpc: vi.fn(),
  mockGetArtisan: vi.fn(),
  mockGetAiDescription: vi.fn(),
  mockBuildArtistPageData: vi.fn(),
  mockDistillArtistOverview: vi.fn(),
  mockAssembleCuratorContextFromFormData: vi.fn(),
  mockShouldSkipGeneration: vi.fn(),
  mockGetDataRichness: vi.fn(),
  mockGenerateCuratorNote: vi.fn(),
}));

// =============================================================================
// Module mocks
// =============================================================================

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock('@/lib/collection/access', () => ({
  checkCollectionAccess: (...args: unknown[]) => mockCheckCollectionAccess(...args),
}));

vi.mock('@/lib/supabase/yuhinkai', () => ({
  get yuhinkaiConfigured() {
    return mockYuhinkaiConfigured.value;
  },
  yuhinkaiClient: {
    rpc: (...args: unknown[]) => mockYuhinkaiRpc(...args),
  },
  IMAGE_STORAGE_BASE: 'https://example.supabase.co',
  buildStoragePaths: vi.fn((_col: string, vol: number, itemNum: number) => [
    { path: `test/${vol}_${itemNum}_oshigata.jpg` },
  ]),
  getArtisan: (...args: unknown[]) => mockGetArtisan(...args),
  getAiDescription: (...args: unknown[]) => mockGetAiDescription(...args),
}));

vi.mock('@/lib/listing/curatorNote', () => ({
  assembleCuratorContextFromFormData: (...args: unknown[]) => mockAssembleCuratorContextFromFormData(...args),
  shouldSkipGeneration: (...args: unknown[]) => mockShouldSkipGeneration(...args),
  getDataRichness: (...args: unknown[]) => mockGetDataRichness(...args),
}));

vi.mock('@/lib/listing/generateCuratorNote', () => ({
  generateCuratorNote: (...args: unknown[]) => mockGenerateCuratorNote(...args),
}));

vi.mock('@/lib/artisan/getArtistPageData', () => ({
  buildArtistPageData: (...args: unknown[]) => mockBuildArtistPageData(...args),
}));

vi.mock('@/lib/listing/distillArtistOverview', () => ({
  distillArtistOverview: (...args: unknown[]) => mockDistillArtistOverview(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  },
}));

// =============================================================================
// Import route handlers AFTER mocks
// =============================================================================

const { GET: catalogMatchGET } = await import('@/app/api/collection/catalog-match/route');
const { POST: generateDescriptionPOST } = await import('@/app/api/collection/generate-description/route');

// =============================================================================
// Helpers
// =============================================================================

const mockUser = { id: 'user-123', email: 'test@example.com' };

function makeCatalogMatchRequest(params: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(params);
  return new NextRequest(`http://localhost/api/collection/catalog-match?${searchParams}`);
}

function makeGenerateDescriptionRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/collection/generate-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Default: authenticated user
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

  // Default: access granted (inner_circle / admin)
  mockCheckCollectionAccess.mockResolvedValue(null);

  // Default: Yuhinkai configured
  mockYuhinkaiConfigured.value = true;

  // Default: curator note mocks for generate-description
  mockAssembleCuratorContextFromFormData.mockReturnValue({ sword: {}, artisan: null });
  mockShouldSkipGeneration.mockReturnValue(false);
  mockGetDataRichness.mockReturnValue('medium');
  mockGenerateCuratorNote.mockResolvedValue({ note: 'Test scholar note.', headline: 'Test Headline' });
  mockGetArtisan.mockResolvedValue(null);
  mockGetAiDescription.mockResolvedValue(null);
  mockBuildArtistPageData.mockResolvedValue(null);
  mockDistillArtistOverview.mockReturnValue(null);
});

// =============================================================================
// CATALOG MATCH ENDPOINT (/api/collection/catalog-match)
// =============================================================================

describe('GET /api/collection/catalog-match', () => {

  // ── Auth ──────────────────────────────────────────────────────────

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Not authenticated');
  });

  it('returns 403 for free tier users (no collection access)', async () => {
    mockCheckCollectionAccess.mockResolvedValueOnce(
      NextResponse.json({ error: 'Collection access requires an eligible subscription' }, { status: 403 })
    );

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('eligible subscription');
  });

  // ── Validation ────────────────────────────────────────────────────

  it('returns 400 when artisan_code is missing', async () => {
    const res = await catalogMatchGET(makeCatalogMatchRequest({ collection: 'Juyo' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('artisan_code');
  });

  it('returns 400 when collection is missing', async () => {
    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('collection');
  });

  it('returns 400 when both params are missing', async () => {
    const res = await catalogMatchGET(makeCatalogMatchRequest({}));
    expect(res.status).toBe(400);
  });

  // ── Yuhinkai not configured ───────────────────────────────────────

  it('returns 503 when Yuhinkai is not configured', async () => {
    mockYuhinkaiConfigured.value = false;

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain('unavailable');
  });

  // ── Access allowed (inner_circle) ─────────────────────────────────

  it('allows inner_circle users and returns catalog results', async () => {
    mockYuhinkaiRpc.mockResolvedValueOnce({
      data: {
        total: 1,
        items: [{
          object_uuid: 'uuid-1',
          collection: 'Juyo',
          volume: 45,
          item_number: 12,
          gold_form_type: 'Katana',
          gold_nagasa: 71.5,
          gold_sori: 1.8,
          gold_motohaba: null,
          gold_sakihaba: null,
          gold_mei_status: 'signed',
          gold_mei_kanji: null,
          gold_period: 'Kamakura',
          gold_artisan_kanji: null,
          gold_item_type: null,
          gold_school: null,
          gold_province: null,
          gold_nakago_condition: null,
          translation_md: null,
          japanese_txt: null,
        }],
        volumes: [{ volume: 45, count: 1 }],
      },
      error: null,
    });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(1);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].object_uuid).toBe('uuid-1');
    expect(json.items[0].volume).toBe(45);
    expect(json.items[0].item_number).toBe(12);
    expect(json.items[0].form_type).toBe('Katana');
    expect(json.items[0].nagasa_cm).toBe(71.5);
    expect(json.items[0].sori_cm).toBe(1.8);
    expect(json.items[0].motohaba_cm).toBeNull();
    expect(json.volumes).toHaveLength(1);
  });

  it('allows admin users (checkCollectionAccess returns null for admins)', async () => {
    // checkCollectionAccess returns null for admins — already the default mock
    mockYuhinkaiRpc.mockResolvedValueOnce({
      data: { total: 0, items: [], volumes: [] },
      error: null,
    });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'OWA009', collection: 'Juyo' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(0);
    expect(json.items).toEqual([]);
  });

  // ── RPC calls with correct params ─────────────────────────────────

  it('calls Yuhinkai RPC with correct parameters', async () => {
    mockYuhinkaiRpc.mockResolvedValueOnce({
      data: { total: 0, items: [], volumes: [] },
      error: null,
    });

    await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'KUN232', collection: 'Tokuju' }));

    expect(mockYuhinkaiRpc).toHaveBeenCalledWith('search_catalog', {
      p_artisan_code: 'KUN232',
      p_collection: 'Tokuju',
      p_limit: 100,
    });
  });

  // ── Empty / null RPC result ───────────────────────────────────────

  it('returns empty result when RPC returns null data', async () => {
    mockYuhinkaiRpc.mockResolvedValueOnce({ data: null, error: null });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.total).toBe(0);
    expect(json.items).toEqual([]);
    expect(json.volumes).toEqual([]);
  });

  // ── RPC error ─────────────────────────────────────────────────────

  it('returns 500 when RPC call fails', async () => {
    mockYuhinkaiRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC failure' },
    });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('failed');
  });

  // ── Image URL construction ────────────────────────────────────────

  it('constructs image URLs from buildStoragePaths', async () => {
    mockYuhinkaiRpc.mockResolvedValueOnce({
      data: {
        total: 1,
        items: [{
          object_uuid: 'uuid-1',
          collection: 'Juyo',
          volume: 10,
          item_number: 3,
          gold_form_type: null,
          gold_nagasa: null,
          gold_sori: null,
          gold_motohaba: null,
          gold_sakihaba: null,
          gold_mei_status: null,
          gold_mei_kanji: null,
          gold_period: null,
          gold_artisan_kanji: null,
          gold_item_type: null,
          gold_school: null,
          gold_province: null,
          gold_nakago_condition: null,
          translation_md: null,
          japanese_txt: null,
        }],
        volumes: [{ volume: 10, count: 1 }],
      },
      error: null,
    });

    const res = await catalogMatchGET(makeCatalogMatchRequest({ artisan_code: 'MAS590', collection: 'Juyo' }));
    const json = await res.json();

    expect(json.items[0].image_urls).toEqual([
      'https://example.supabase.co/storage/v1/object/public/images/test/10_3_oshigata.jpg',
    ]);
  });
});

// =============================================================================
// GENERATE DESCRIPTION ENDPOINT (/api/collection/generate-description)
// =============================================================================

describe('POST /api/collection/generate-description', () => {

  const validBody = {
    cert_type: 'Juyo',
    item_type: 'katana',
    artisan_id: 'MAS590',
  };

  // ── Auth ──────────────────────────────────────────────────────────

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Not authenticated');
  });

  it('returns 403 for free tier users (no collection access)', async () => {
    mockCheckCollectionAccess.mockResolvedValueOnce(
      NextResponse.json({ error: 'Collection access requires an eligible subscription' }, { status: 403 })
    );

    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('eligible subscription');
  });

  // ── Cert type validation ──────────────────────────────────────────

  it('returns 400 for non-Juyo cert types (Hozon)', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'Hozon',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Scholar's notes are only available for Juyo");
    expect(json.error).toContain('Hozon');
  });

  it('returns 400 for Tokubetsu Hozon cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'Tokubetsu Hozon',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      item_type: 'katana',
      artisan_id: 'MAS590',
    }));
    expect(res.status).toBe(400);
  });

  it('accepts Juyo cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(200);
  });

  it('accepts Tokuju cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'Tokuju',
    }));
    expect(res.status).toBe(200);
  });

  it('accepts Tokubetsu Juyo cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'Tokubetsu Juyo',
    }));
    expect(res.status).toBe(200);
  });

  it('accepts lowercase juyo cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'juyo',
    }));
    expect(res.status).toBe(200);
  });

  it('accepts lowercase tokuju cert type', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest({
      ...validBody,
      cert_type: 'tokuju',
    }));
    expect(res.status).toBe(200);
  });

  // ── Access allowed ────────────────────────────────────────────────

  it('allows inner_circle users and returns generated description', async () => {
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.description).toBe('Test scholar note.');
    expect(json.headline).toBe('Test Headline');
    expect(json.data_richness).toBe('medium');
  });

  it('allows admin users', async () => {
    // checkCollectionAccess returns null — default mock behavior
    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(200);
  });

  // ── Artisan data fetching ─────────────────────────────────────────

  it('fetches artisan data when artisan_id is provided', async () => {
    await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));

    expect(mockGetArtisan).toHaveBeenCalledWith('MAS590');
    expect(mockGetAiDescription).toHaveBeenCalledWith('MAS590');
  });

  it('skips artisan fetch when artisan_id is not provided', async () => {
    await generateDescriptionPOST(makeGenerateDescriptionRequest({
      cert_type: 'Juyo',
      item_type: 'katana',
    }));

    expect(mockGetArtisan).not.toHaveBeenCalled();
    expect(mockGetAiDescription).not.toHaveBeenCalled();
  });

  it('attempts to build artist page data for context enrichment', async () => {
    await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));

    expect(mockBuildArtistPageData).toHaveBeenCalledWith('MAS590');
  });

  it('handles buildArtistPageData failure gracefully (non-fatal)', async () => {
    mockBuildArtistPageData.mockRejectedValueOnce(new Error('Yuhinkai unavailable'));

    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    // Should still succeed — artist overview is supplementary
    expect(res.status).toBe(200);
  });

  // ── Skip generation check ─────────────────────────────────────────

  it('returns 400 when shouldSkipGeneration returns true (not enough data)', async () => {
    mockShouldSkipGeneration.mockReturnValueOnce(true);

    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Not enough data');
  });

  // ── Generation failure ────────────────────────────────────────────

  it('returns 500 when generation fails (null note)', async () => {
    mockGenerateCuratorNote.mockResolvedValueOnce({ note: null, headline: null });

    const res = await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('Generation failed');
  });

  // ── Form data passthrough ─────────────────────────────────────────

  it('passes form fields through to assembleCuratorContextFromFormData', async () => {
    const fullBody = {
      cert_type: 'Juyo',
      item_type: 'katana',
      artisan_id: 'MAS590',
      nagasa_cm: 71.5,
      sori_cm: 1.8,
      motohaba_cm: 3.1,
      sakihaba_cm: null,
      kasane_cm: 0.7,
      mei_type: 'zaimei',
      mei_text: 'some kanji',
      era: 'Kamakura',
      province: 'Sagami',
      school: 'Soshu',
      cert_session: 45,
      setsumei_text_en: 'English setsumei',
      setsumei_text_ja: null,
      sayagaki: null,
      hakogaki: null,
      provenance: null,
      kiwame: null,
      koshirae: null,
      research_notes: 'Some research notes',
    };

    await generateDescriptionPOST(makeGenerateDescriptionRequest(fullBody));

    expect(mockAssembleCuratorContextFromFormData).toHaveBeenCalledTimes(1);
    const formData = mockAssembleCuratorContextFromFormData.mock.calls[0][0];
    expect(formData.item_type).toBe('katana');
    expect(formData.nagasa_cm).toBe(71.5);
    expect(formData.sori_cm).toBe(1.8);
    expect(formData.motohaba_cm).toBe(3.1);
    expect(formData.sakihaba_cm).toBeNull();
    expect(formData.kasane_cm).toBe(0.7);
    expect(formData.cert_type).toBe('Juyo');
    expect(formData.cert_session).toBe(45);
    expect(formData.setsumei_text_en).toBe('English setsumei');
    expect(formData.research_notes).toBe('Some research notes');
  });

  it('calls generateCuratorNote with en locale', async () => {
    await generateDescriptionPOST(makeGenerateDescriptionRequest(validBody));

    expect(mockGenerateCuratorNote).toHaveBeenCalledTimes(1);
    expect(mockGenerateCuratorNote.mock.calls[0][1]).toBe('en');
  });
});

// =============================================================================
// CatalogMatchPanel apiBase prop rendering tests are in:
// tests/components/dealer/CatalogMatchPanel.test.tsx (apiBase prop section)
// =============================================================================
