/**
 * Tests for pipeline health alert cron job
 *
 * Tests cover:
 * 1. Authorization (CRON_SECRET validation)
 * 2. Healthy pipeline — no alert sent, alert state cleared
 * 3. Critical pipeline (>12h) — alert sent to admin(s)
 * 4. Dedup — second run during same outage does NOT re-send
 * 5. No scrape_runs — still alerts
 * 6. No admin users — graceful failure
 * 7. SendGrid failure — does not mark as alerted
 * 8. Uses completed_at over started_at when available
 * 9. Email content — subject line includes hours
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock setup ───

const mockSendPipelineAlert = vi.fn();
const mockGetUserById = vi.fn();

// Configurable per-test responses
let scrapeRunsResponse: { data: any; error: any };
let systemStateResponse: { data: any; error: any };
let profilesResponse: { data: any; error: any };

// Track calls to system_state for assertions
let systemStateUpsertCalls: any[] = [];
let systemStateDeleteCalled = false;

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => {
    const mockFrom = (table: string) => {
      const chain: Record<string, any> = {};
      chain.select = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;

      chain.eq = (_col: string, _val: string) => {
        if (table === 'profiles') {
          return Promise.resolve(profilesResponse);
        }
        return chain;
      };

      chain.single = () => {
        if (table === 'scrape_runs') return Promise.resolve(scrapeRunsResponse);
        if (table === 'system_state') return Promise.resolve(systemStateResponse);
        return Promise.resolve({ data: null, error: null });
      };

      chain.upsert = (row: any) => {
        systemStateUpsertCalls.push(row);
        return Promise.resolve({ data: null, error: null });
      };

      chain.delete = () => {
        systemStateDeleteCalled = true;
        return chain;
      };

      return chain;
    };

    return {
      from: mockFrom,
      auth: { admin: { getUserById: mockGetUserById } },
    };
  },
}));

vi.mock('@/lib/email/pipeline-alert', () => ({
  sendPipelineAlert: (...args: any[]) => mockSendPipelineAlert(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '@/app/api/cron/pipeline-health-alert/route';

// ─── Helpers ───

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function authedRequest() {
  return new NextRequest('http://localhost/api/cron/pipeline-health-alert', {
    headers: { authorization: 'Bearer test-secret' },
  });
}

function unauthRequest() {
  return new NextRequest('http://localhost/api/cron/pipeline-health-alert');
}

// Default "admin exists" setup
function setupAdmin(email = 'admin@example.com') {
  profilesResponse = { data: [{ id: 'admin-1' }], error: null };
  mockGetUserById.mockResolvedValue({
    data: { user: { id: 'admin-1', email } },
  });
}

function setupMultipleAdmins() {
  profilesResponse = { data: [{ id: 'admin-1' }, { id: 'admin-2' }], error: null };
  mockGetUserById
    .mockResolvedValueOnce({ data: { user: { id: 'admin-1', email: 'a@test.com' } } })
    .mockResolvedValueOnce({ data: { user: { id: 'admin-2', email: 'b@test.com' } } });
}

// ─── Tests ───

describe('Pipeline Health Alert Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    systemStateUpsertCalls = [];
    systemStateDeleteCalled = false;

    // Defaults
    scrapeRunsResponse = { data: { started_at: hoursAgo(1), completed_at: hoursAgo(1) }, error: null };
    systemStateResponse = { data: null, error: null }; // No prior alert
    profilesResponse = { data: [], error: null };       // No admins by default
    mockSendPipelineAlert.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  // ─── 1. Authorization ───

  describe('Authorization', () => {
    it('returns 401 without credentials', async () => {
      const res = await GET(unauthRequest());
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });

    it('accepts Bearer token', async () => {
      const res = await GET(authedRequest());
      expect(res.status).not.toBe(401);
    });

    it('accepts x-cron-secret header', async () => {
      const req = new NextRequest('http://localhost/api/cron/pipeline-health-alert', {
        headers: { 'x-cron-secret': 'test-secret' },
      });
      const res = await GET(req);
      expect(res.status).not.toBe(401);
    });
  });

  // ─── 2. Healthy pipeline ───

  describe('Healthy pipeline (<12h since last run)', () => {
    it('returns healthy status and does NOT send email', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(2), completed_at: hoursAgo(1) }, error: null };

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('healthy');
      expect(body.hoursSince).toBeLessThanOrEqual(2);
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });

    it('clears alert state on healthy check (enables future re-alert)', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(2), completed_at: hoursAgo(2) }, error: null };

      await GET(authedRequest());

      expect(systemStateDeleteCalled).toBe(true);
    });
  });

  // ─── 3. Critical pipeline (>12h) ───

  describe('Critical pipeline (>12h since last run)', () => {
    beforeEach(() => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(25), completed_at: hoursAgo(24) }, error: null };
      setupAdmin();
    });

    it('sends alert email to admin', async () => {
      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
      expect(body.alertSent).toBe(true);
      expect(mockSendPipelineAlert).toHaveBeenCalledWith(
        ['admin@example.com'],
        expect.any(Number),
        expect.stringContaining('No pipeline activity'),
      );
    });

    it('sends to multiple admins', async () => {
      setupMultipleAdmins();

      await GET(authedRequest());

      expect(mockSendPipelineAlert).toHaveBeenCalledWith(
        ['a@test.com', 'b@test.com'],
        expect.any(Number),
        expect.any(String),
      );
    });

    it('marks alert as sent in system_state after successful send', async () => {
      await GET(authedRequest());

      expect(systemStateUpsertCalls).toHaveLength(1);
      expect(systemStateUpsertCalls[0].key).toBe('pipeline_alert_last_sent');
      expect(systemStateUpsertCalls[0].value).toBeTruthy(); // ISO timestamp
    });

    it('includes hours in the alert message', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(50), completed_at: hoursAgo(48) }, error: null };

      await GET(authedRequest());

      const callArgs = mockSendPipelineAlert.mock.calls[0];
      expect(callArgs[1]).toBe(48); // ~48 hours
      expect(callArgs[2]).toContain('~48h');
    });
  });

  // ─── 4. Dedup — no re-send during same outage ───

  describe('Dedup', () => {
    it('does NOT re-send if alert already sent for this incident', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(30), completed_at: hoursAgo(28) }, error: null };
      systemStateResponse = { data: { value: hoursAgo(4) }, error: null }; // Already alerted 4h ago

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
      expect(body.alertSent).toBe(false);
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });
  });

  // ─── 5. Recovery cycle ───

  describe('Recovery and re-alert cycle', () => {
    it('clears state on recovery so future outage triggers new alert', async () => {
      // Pipeline recovered — last run 1h ago
      scrapeRunsResponse = { data: { started_at: hoursAgo(1), completed_at: hoursAgo(1) }, error: null };

      await GET(authedRequest());

      expect(systemStateDeleteCalled).toBe(true);
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });
  });

  // ─── 6. No scrape_runs at all ───

  describe('No scrape_runs found', () => {
    it('sends alert when no pipeline runs exist', async () => {
      scrapeRunsResponse = { data: null, error: { code: 'PGRST116' } };
      setupAdmin();

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('alert_sent');
      expect(body.reason).toBe('no_runs_found');
      expect(mockSendPipelineAlert).toHaveBeenCalledWith(
        ['admin@example.com'],
        -1,
        'No pipeline runs found in the database.',
      );
    });
  });

  // ─── 7. No admin users ───

  describe('No admin users', () => {
    it('does not send email when no admins exist', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(24), completed_at: hoursAgo(24) }, error: null };
      profilesResponse = { data: [], error: null };

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
      expect(body.alertSent).toBe(false);
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });

    it('does not send email when admin has no email', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(24), completed_at: hoursAgo(24) }, error: null };
      profilesResponse = { data: [{ id: 'admin-1' }], error: null };
      mockGetUserById.mockResolvedValue({ data: { user: { id: 'admin-1', email: null } } });

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.alertSent).toBe(false);
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });
  });

  // ─── 8. SendGrid failure ───

  describe('SendGrid failure', () => {
    it('does NOT mark as alerted when email fails', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(24), completed_at: hoursAgo(24) }, error: null };
      setupAdmin();
      mockSendPipelineAlert.mockResolvedValue({ success: false, error: 'SendGrid timeout' });

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
      expect(body.alertSent).toBe(false);
      // Must NOT upsert system_state — so next cron run can retry
      expect(systemStateUpsertCalls).toHaveLength(0);
    });
  });

  // ─── 9. Timestamp selection ───

  describe('Timestamp selection', () => {
    it('uses completed_at when available (not started_at)', async () => {
      // started_at = 20h ago (critical), but completed_at = 5h ago (healthy)
      scrapeRunsResponse = { data: { started_at: hoursAgo(20), completed_at: hoursAgo(5) }, error: null };

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('healthy');
      expect(mockSendPipelineAlert).not.toHaveBeenCalled();
    });

    it('falls back to started_at when completed_at is null', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(2), completed_at: null }, error: null };

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('healthy');
    });

    it('treats null completed_at + old started_at as critical', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(20), completed_at: null }, error: null };
      setupAdmin();

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
      expect(body.alertSent).toBe(true);
    });
  });

  // ─── 10. Boundary: exactly 12h ───

  describe('Boundary conditions', () => {
    it('treats exactly 12h as healthy (<=12)', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(12), completed_at: hoursAgo(12) }, error: null };

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('healthy');
    });

    it('treats 12.1h as critical', async () => {
      scrapeRunsResponse = { data: { started_at: hoursAgo(12.1), completed_at: hoursAgo(12.1) }, error: null };
      setupAdmin();

      const res = await GET(authedRequest());
      const body = await res.json();

      expect(body.status).toBe('critical');
    });
  });
});

// ─── Email template unit tests ───

describe('sendPipelineAlert (email template)', () => {
  const originalEnv = process.env.SENDGRID_API_KEY;

  afterEach(() => {
    if (originalEnv) {
      process.env.SENDGRID_API_KEY = originalEnv;
    } else {
      delete process.env.SENDGRID_API_KEY;
    }
    vi.restoreAllMocks();
  });

  it('returns error when SENDGRID_API_KEY is not set', async () => {
    delete process.env.SENDGRID_API_KEY;

    // Use the real module (not mocked)
    vi.doUnmock('@/lib/email/pipeline-alert');
    const { sendPipelineAlert: realSend } = await import('@/lib/email/pipeline-alert');
    const result = await realSend(['test@test.com'], 24, 'Pipeline down');

    expect(result.success).toBe(false);
    expect(result.error).toBe('SendGrid not configured');
  });

  it('formats subject with hours for positive values', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';

    vi.doUnmock('@/lib/email/pipeline-alert');
    const sgMail = await import('@sendgrid/mail');
    const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202, headers: {} }, {}]);
    sgMail.default.send = mockSend;
    sgMail.default.setApiKey = vi.fn();

    const { sendPipelineAlert: realSend } = await import('@/lib/email/pipeline-alert');
    await realSend(['admin@test.com'], 72, 'Details here');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[P0] NihontoWatch scraper pipeline DOWN (~72h)',
        to: ['admin@test.com'],
      }),
    );
  });

  it('uses "unknown duration" when hoursSince is negative', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';

    vi.doUnmock('@/lib/email/pipeline-alert');
    const sgMail = await import('@sendgrid/mail');
    const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202, headers: {} }, {}]);
    sgMail.default.send = mockSend;
    sgMail.default.setApiKey = vi.fn();

    const { sendPipelineAlert: realSend } = await import('@/lib/email/pipeline-alert');
    await realSend(['admin@test.com'], -1, 'No runs found');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[P0] NihontoWatch scraper pipeline DOWN (unknown duration)',
      }),
    );
  });

  it('includes action items in email text', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';

    vi.doUnmock('@/lib/email/pipeline-alert');
    const sgMail = await import('@sendgrid/mail');
    const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202, headers: {} }, {}]);
    sgMail.default.send = mockSend;
    sgMail.default.setApiKey = vi.fn();

    const { sendPipelineAlert: realSend } = await import('@/lib/email/pipeline-alert');
    await realSend(['admin@test.com'], 24, 'Some details');

    const sentMsg = mockSend.mock.calls[0][0];
    expect(sentMsg.text).toContain('GitHub Actions');
    expect(sentMsg.text).toContain('Supabase');
    expect(sentMsg.text).toContain('Oshi-scrapper');
    expect(sentMsg.html).toContain('Pipeline DOWN');
  });
});
