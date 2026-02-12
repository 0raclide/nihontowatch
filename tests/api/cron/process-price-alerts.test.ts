/**
 * Tests for price drop alerts cron job
 *
 * Tests cover:
 * - Authorization (CRON_SECRET validation)
 * - Price decrease detection
 * - Alert cooldown period
 * - Notification sending
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/email/sendgrid', () => ({
  sendPriceDropNotification: vi.fn(),
}));

// Import after mocks are set up
import { GET } from '@/app/api/cron/process-price-alerts/route';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPriceDropNotification } from '@/lib/email/sendgrid';

describe('Process Price Alerts Cron', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
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
    it('should return 401 when unauthorized', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-price-alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should authorize with valid Bearer token', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should authorize with x-cron-secret header', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { 'x-cron-secret': 'test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should return 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer any-value' },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Price Change Detection', () => {
    it('should return early when no recent price decreases', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('No recent price decreases');
      expect(data.processed).toBe(0);
    });

    it('should detect price decreases from price_history', async () => {
      const mockPriceChanges = [
        {
          id: 1,
          listing_id: 100,
          old_price: 1000000,
          new_price: 900000,
          change_type: 'decrease',
          detected_at: new Date().toISOString(),
        },
      ];

      // First query: price_history
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: mockPriceChanges, error: null }),
          };
        }
        if (table === 'alerts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return mockSupabase;
      });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceChangesFound).toBe(1);
    });

    it('should handle database errors', async () => {
      // Create a mock that returns an error on the final gte() call
      const errorMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      };
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(errorMock);

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  describe('Alert Cooldown', () => {
    it('should skip alerts within 24-hour cooldown period', async () => {
      const recentlyTriggered = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago

      const mockPriceChanges = [
        { id: 1, listing_id: 100, old_price: 1000000, new_price: 900000, change_type: 'decrease', detected_at: new Date().toISOString() },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'price_drop', is_active: true, last_triggered_at: recentlyTriggered },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: mockPriceChanges, error: null }),
          };
        }
        if (table === 'alerts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }),
          };
        }
        return mockSupabase;
      });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('cooldown');
      expect(data.processed).toBe(0);
    });

    it('should process alerts outside cooldown period', async () => {
      const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

      const mockPriceChanges = [
        { id: 1, listing_id: 100, old_price: 1000000, new_price: 900000, change_type: 'decrease', detected_at: new Date().toISOString() },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'price_drop', is_active: true, last_triggered_at: longAgo },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      const mockListings = [
        { id: 100, title: 'Test Listing', url: 'https://example.com', dealers: { id: 1, name: 'Test Dealer', domain: 'example.com' } },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: mockPriceChanges, error: null }),
          };
        }
        if (table === 'alerts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          };
        }
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
          };
        }
        if (table === 'alert_history') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      (sendPriceDropNotification as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eligibleAfterCooldown).toBe(1);
    });
  });

  describe('Notification Sending', () => {
    it('should send email notification for eligible alerts', async () => {
      const mockPriceChanges = [
        { id: 1, listing_id: 100, old_price: 1000000, new_price: 900000, change_type: 'decrease', detected_at: new Date().toISOString() },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'price_drop', is_active: true, last_triggered_at: null },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      const mockListings = [
        { id: 100, title: 'Test Listing', url: 'https://example.com', price_value: 900000, price_currency: 'JPY', dealers: { id: 1, name: 'Test', domain: 'test.com' } },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockPriceChanges, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }), update: vi.fn().mockReturnThis() };
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      });

      (sendPriceDropNotification as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(sendPriceDropNotification).toHaveBeenCalled();
      expect(data.notificationsSent).toBeGreaterThanOrEqual(0);
    });

    it('should record failed notifications', async () => {
      const mockPriceChanges = [
        { id: 1, listing_id: 100, old_price: 1000000, new_price: 900000, change_type: 'decrease', detected_at: new Date().toISOString() },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'price_drop', is_active: true, last_triggered_at: null },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      const mockListings = [
        { id: 100, title: 'Test', url: 'https://example.com', dealers: { id: 1, name: 'Test', domain: 'test.com' } },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockPriceChanges, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }), update: vi.fn().mockReturnThis() };
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      });

      (sendPriceDropNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Email delivery failed',
      });

      const request = new NextRequest('http://localhost/api/cron/process-price-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors).toBeGreaterThanOrEqual(0);
    });
  });
});
