import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for /api/dealer/profile (GET + PATCH)
 *
 * These tests mock Supabase and verifyDealer to test the API route logic
 * in isolation, without hitting the real database.
 */

const mockVerifyDealer = vi.fn();
const mockServiceSelect = vi.fn();
const mockServiceUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockServiceSelect,
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockServiceUpdate,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/dealer/auth', () => ({
  verifyDealer: (...args: unknown[]) => mockVerifyDealer(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  },
}));

// Dynamic import AFTER mocks are set up
const { GET, PATCH } = await import('@/app/api/dealer/profile/route');

function makeRequest(body?: object): NextRequest {
  return new NextRequest('http://localhost/api/dealer/profile', {
    method: body ? 'PATCH' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

const SAMPLE_DEALER = {
  id: 42,
  name: 'Test Shop',
  domain: 'testshop.com',
  country: 'JP',
  is_active: true,
  logo_url: null,
  banner_url: null,
  bio_en: null,
  bio_ja: null,
  contact_email: 'test@shop.com',
  specializations: [],
  memberships: [],
};

describe('/api/dealer/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 for unauthenticated user', async () => {
      mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'unauthorized' });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-dealer user', async () => {
      mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'forbidden' });
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it('returns dealer data with completeness score', async () => {
      mockVerifyDealer.mockResolvedValue({ isDealer: true, dealerId: 42 });
      mockServiceSelect.mockResolvedValue({ data: SAMPLE_DEALER, error: null });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.dealer.id).toBe(42);
      expect(json.profileCompleteness).toBeDefined();
      expect(typeof json.profileCompleteness.score).toBe('number');
      expect(Array.isArray(json.profileCompleteness.missing)).toBe(true);
    });
  });

  describe('PATCH', () => {
    beforeEach(() => {
      mockVerifyDealer.mockResolvedValue({ isDealer: true, dealerId: 42 });
    });

    it('updates allowed fields', async () => {
      const updated = { ...SAMPLE_DEALER, bio_en: 'Hello collectors!' };
      mockServiceUpdate.mockResolvedValue({ data: updated, error: null });

      const res = await PATCH(makeRequest({ bio_en: 'Hello collectors!' }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.dealer.bio_en).toBe('Hello collectors!');
    });

    it('rejects disallowed fields (id, name, domain)', async () => {
      const res = await PATCH(makeRequest({ id: 99, name: 'Hacked', domain: 'evil.com' }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('No valid fields');
    });

    it('validates accent_color as hex', async () => {
      const res = await PATCH(makeRequest({ accent_color: 'not-a-hex' }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('hex color');
    });

    it('accepts valid accent_color', async () => {
      mockServiceUpdate.mockResolvedValue({ data: { ...SAMPLE_DEALER, accent_color: '#ff5500' }, error: null });
      const res = await PATCH(makeRequest({ accent_color: '#ff5500' }));
      expect(res.status).toBe(200);
    });

    it('validates founded_year range', async () => {
      const res = await PATCH(makeRequest({ founded_year: 1500 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('1600');
    });

    it('validates specializations values', async () => {
      const res = await PATCH(makeRequest({ specializations: ['invalid'] }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Invalid specialization');
    });

    it('accepts valid specializations', async () => {
      mockServiceUpdate.mockResolvedValue({ data: { ...SAMPLE_DEALER, specializations: ['koto', 'bizen'] }, error: null });
      const res = await PATCH(makeRequest({ specializations: ['koto', 'bizen'] }));
      expect(res.status).toBe(200);
    });

    it('validates deposit_percentage range', async () => {
      const res = await PATCH(makeRequest({ deposit_percentage: 150 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('0-100');
    });

    it('normalizes bare instagram handle to full URL', async () => {
      mockServiceUpdate.mockResolvedValue({ data: { ...SAMPLE_DEALER, instagram_url: 'https://www.instagram.com/myshop' }, error: null });
      const res = await PATCH(makeRequest({ instagram_url: '@myshop' }));
      expect(res.status).toBe(200);
    });
  });
});
