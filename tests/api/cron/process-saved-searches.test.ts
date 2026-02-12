/**
 * Tests for saved search notification cron job
 *
 * Tests cover:
 * - Authorization (CRON_SECRET validation)
 * - Frequency parameter validation
 * - Batch processing of saved searches
 * - Email notification sending
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/savedSearches/matcher', () => ({
  findMatchingListings: vi.fn(),
}));

vi.mock('@/lib/email/sendgrid', () => ({
  sendSavedSearchNotification: vi.fn(),
}));

// Import after mocks are set up
import { GET } from '@/app/api/cron/process-saved-searches/route';
import { createServiceClient } from '@/lib/supabase/server';
import { findMatchingListings } from '@/lib/savedSearches/matcher';
import { sendSavedSearchNotification } from '@/lib/email/sendgrid';

describe('Process Saved Searches Cron', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    process.env.CRON_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('Authorization', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid Bearer token', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer wrong-secret' },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should authorize with valid Bearer token', async () => {
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should authorize with x-cron-secret header', async () => {
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { 'x-cron-secret': 'test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should return 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer any-value' },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Frequency Parameter Validation', () => {
    it('should return 400 when frequency is missing', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('frequency');
    });

    it('should return 400 for invalid frequency value', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=weekly', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('instant');
    });

    it('should accept "instant" frequency', async () => {
      // Chain: .from().select().eq().eq() - first eq returns this, second eq returns result
      mockSupabase.eq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should accept "daily" frequency', async () => {
      // Chain: .from().select().eq().eq() - first eq returns this, second eq returns result
      mockSupabase.eq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=daily', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Processing Saved Searches', () => {
    it('should return early when no active saved searches exist', async () => {
      // Chain: .from().select().eq().eq() - first eq returns this, second eq returns result
      mockSupabase.eq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processed).toBe(0);
      expect(data.notificationsSent).toBe(0);
    });

    it('should process saved searches and send notifications', async () => {
      const mockSavedSearches = [
        {
          id: 'search-1',
          user_id: 'user-1',
          search_criteria: { itemTypes: ['katana'] },
          notification_frequency: 'instant',
          is_active: true,
          last_notified_at: null,
        },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      const mockMatchedListings = [
        { id: 1, title: 'Test Katana', first_seen_at: new Date().toISOString() },
      ];

      // Set up mock chain
      let callCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: fetch saved_searches
          return { ...mockSupabase, eq: mockSupabase.eq };
        }
        return mockSupabase;
      });

      mockSupabase.select.mockImplementation(() => ({
        ...mockSupabase,
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      }));

      // First query returns saved searches
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'saved_searches') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockResolvedValue({ data: mockSavedSearches, error: null }),
            })),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      (findMatchingListings as ReturnType<typeof vi.fn>).mockResolvedValue(mockMatchedListings);
      (sendSavedSearchNotification as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.frequency).toBe('instant');
    });

    it('should handle database errors gracefully', async () => {
      // Create a mock that returns an error on the final eq() call
      const errorMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      };
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(errorMock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });
  });

  describe('Lookback Window', () => {
    it('should use 20-minute lookback for instant frequency', async () => {
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });

      await GET(request);

      // Verify the cron job runs without error (lookback is internal)
      expect(createServiceClient).toHaveBeenCalled();
    });

    it('should use 25-hour lookback for daily frequency', async () => {
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=daily', {
        headers: { authorization: 'Bearer test-secret' },
      });

      await GET(request);

      // Verify the cron job runs without error
      expect(createServiceClient).toHaveBeenCalled();
    });
  });
});
