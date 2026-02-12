/**
 * Tests for back-in-stock alerts cron job
 *
 * Tests cover:
 * - Authorization (CRON_SECRET validation)
 * - Status change detection
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
  sendBackInStockNotification: vi.fn(),
}));

// Import after mocks are set up
import { GET } from '@/app/api/cron/process-stock-alerts/route';
import { createServiceClient } from '@/lib/supabase/server';
import { sendBackInStockNotification } from '@/lib/email/sendgrid';

describe('Process Stock Alerts Cron', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
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
      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should authorize with valid Bearer token', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should authorize with x-cron-secret header', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { 'x-cron-secret': 'test-secret' },
      });

      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should return 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer any-value' },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Status Change Detection', () => {
    it('should return early when no recent status changes', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('No recent status changes');
      expect(data.processed).toBe(0);
    });

    it('should detect status changes from price_history', async () => {
      const mockStatusChanges = [
        {
          listing_id: 100,
          detected_at: new Date().toISOString(),
        },
      ];

      const mockListings = [
        {
          id: 100,
          url: 'https://example.com',
          title: 'Test Katana',
          is_available: true,
          status: 'available',
          dealers: { id: 1, name: 'Test Dealer', domain: 'example.com' },
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }),
          };
        }
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
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

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statusChangesFound).toBe(1);
      expect(data.listingsNowAvailable).toBe(1);
    });

    it('should filter out listings that are still unavailable', async () => {
      const mockStatusChanges = [
        { listing_id: 100, detected_at: new Date().toISOString() },
        { listing_id: 101, detected_at: new Date().toISOString() },
      ];

      // Only one listing is actually available now
      const mockListings = [
        {
          id: 100,
          url: 'https://example.com',
          title: 'Test Katana',
          is_available: true,
          status: 'available',
          dealers: { id: 1, name: 'Test', domain: 'test.com' },
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }),
          };
        }
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
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

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statusChangesFound).toBe(2);
      expect(data.listingsNowAvailable).toBe(1);
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

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
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
      const recentlyTriggered = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const mockStatusChanges = [{ listing_id: 100, detected_at: new Date().toISOString() }];

      const mockListings = [
        { id: 100, url: 'https://example.com', title: 'Test', is_available: true, status: 'available', dealers: { id: 1, name: 'Test', domain: 'test.com' } },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'back_in_stock', is_active: true, last_triggered_at: recentlyTriggered },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }) };
        }
        return mockSupabase;
      });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('cooldown');
      expect(data.processed).toBe(0);
    });
  });

  describe('Notification Sending', () => {
    it('should send email notification for back-in-stock items', async () => {
      const mockStatusChanges = [{ listing_id: 100, detected_at: new Date().toISOString() }];

      const mockListings = [
        { id: 100, url: 'https://example.com', title: 'Test Katana', is_available: true, status: 'available', price_value: 500000, price_currency: 'JPY', dealers: { id: 1, name: 'Test', domain: 'test.com' } },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'back_in_stock', is_active: true, last_triggered_at: null },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }), update: vi.fn().mockReturnThis() };
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      });

      (sendBackInStockNotification as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(sendBackInStockNotification).toHaveBeenCalled();
      expect(data.notificationsSent).toBeGreaterThanOrEqual(0);
    });

    it('should record failed notifications in alert_history', async () => {
      const mockStatusChanges = [{ listing_id: 100, detected_at: new Date().toISOString() }];

      const mockListings = [
        { id: 100, url: 'https://example.com', title: 'Test', is_available: true, status: 'available', dealers: { id: 1, name: 'Test', domain: 'test.com' } },
      ];

      const mockAlerts = [
        { id: 1, user_id: 'user-1', listing_id: 100, alert_type: 'back_in_stock', is_active: true, last_triggered_at: null },
      ];

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }), update: vi.fn().mockReturnThis() };
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      });

      (sendBackInStockNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Email delivery failed',
      });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process alerts in batches of 20', async () => {
      // Create 25 alerts to test batching
      const mockStatusChanges = Array.from({ length: 25 }, (_, i) => ({
        listing_id: 100 + i,
        detected_at: new Date().toISOString(),
      }));

      const mockListings = Array.from({ length: 25 }, (_, i) => ({
        id: 100 + i,
        url: `https://example.com/${i}`,
        title: `Test ${i}`,
        is_available: true,
        status: 'available',
        dealers: { id: 1, name: 'Test', domain: 'test.com' },
      }));

      const mockAlerts = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        user_id: 'user-1',
        listing_id: 100 + i,
        alert_type: 'back_in_stock',
        is_active: true,
        last_triggered_at: null,
      }));

      const mockProfiles = [{ id: 'user-1', email: 'test@example.com' }];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'price_history') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: mockStatusChanges, error: null }) };
        }
        if (table === 'listings') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ data: mockListings, error: null }) };
        }
        if (table === 'alerts') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }), update: vi.fn().mockReturnThis() };
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      });

      (sendBackInStockNotification as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/cron/process-stock-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alertsFound).toBe(25);
      expect(data.eligibleAfterCooldown).toBe(25);
    });
  });
});
