/**
 * Admin Scrapers Trigger API Unit Tests
 *
 * Tests the /api/admin/scrapers/trigger endpoint.
 * Verifies authentication, GitHub workflow triggering,
 * and critically: that it does NOT create scrape_run records
 * (which caused orphaned "running" records - see fix a7c126c).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Next.js cookies before importing the route handler
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: vi.fn(() => mockServiceClient),
}));

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { POST } from '@/app/api/admin/scrapers/trigger/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/scrapers/trigger', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  error: { message: string; code?: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.insert = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: data?.[0] ?? null, error }));

  return builder;
}

function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });

  const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
  profileBuilder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    return createMockQueryBuilder();
  });
}

function setupGitHubSuccess() {
  mockFetch.mockResolvedValue({
    status: 204,
    ok: true,
  });
}

function setupGitHubFailure(status: number = 500) {
  mockFetch.mockResolvedValue({
    status,
    ok: false,
    text: () => Promise.resolve('GitHub error'),
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('POST /api/admin/scrapers/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env vars
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.stubEnv('GITHUB_OWNER', 'testowner');
    vi.stubEnv('GITHUB_REPO', 'testrepo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const profileBuilder = createMockQueryBuilder([{ role: 'user' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });
  });

  // ===========================================================================
  // GITHUB WORKFLOW TRIGGER TESTS
  // ===========================================================================

  describe('GitHub workflow trigger', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('triggers GitHub Actions workflow on success', async () => {
      setupGitHubSuccess();

      const request = createMockRequest({ dealer: null });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('triggered');

      // Verify GitHub API was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('github.com/repos/testowner/testrepo/actions/workflows'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('passes dealer parameter to workflow inputs', async () => {
      setupGitHubSuccess();

      const request = createMockRequest({ dealer: 'Aoi Art' });
      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"dealer":"Aoi Art"'),
        })
      );
    });

    it('passes discoverOnly flag to workflow inputs', async () => {
      setupGitHubSuccess();

      const request = createMockRequest({ discoverOnly: true });
      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"discover_only":"true"'),
        })
      );
    });

    it('returns error when GITHUB_TOKEN is missing', async () => {
      vi.stubEnv('GITHUB_TOKEN', '');

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain('GitHub token not configured');
    });

    it('handles GitHub API 401 error', async () => {
      setupGitHubFailure(401);

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain('invalid or expired');
    });

    it('handles GitHub API 403 error', async () => {
      setupGitHubFailure(403);

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain('workflow permissions');
    });

    it('handles GitHub API 404 error', async () => {
      setupGitHubFailure(404);

      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain('Workflow not found');
    });
  });

  // ===========================================================================
  // CRITICAL: NO DUPLICATE SCRAPE_RUN CREATION
  // ===========================================================================

  describe('scrape_run record handling', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    /**
     * CRITICAL TEST: Verify we do NOT create scrape_run records.
     *
     * Background: The trigger endpoint used to create a scrape_run with
     * run_type='full' and status='running' before triggering the workflow.
     * But the Python script ALSO creates its own run, leaving the 'full'
     * run orphaned forever in 'running' state.
     *
     * Fix: a7c126c removed the duplicate record creation.
     * This test ensures we don't regress.
     */
    it('does NOT create scrape_run record on successful trigger', async () => {
      setupGitHubSuccess();

      // Track all insert calls to scrape_runs
      const scrapeRunsInsertSpy = vi.fn(() => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 999 }, error: null }),
        }),
      }));

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'scrape_runs') {
          return { insert: scrapeRunsInsertSpy };
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ dealer: null });
      const response = await POST(request);

      expect(response.status).toBe(200);

      // CRITICAL: scrape_runs.insert should NOT be called
      expect(scrapeRunsInsertSpy).not.toHaveBeenCalled();
    });

    it('returns null runId (no record created)', async () => {
      setupGitHubSuccess();

      const request = createMockRequest({ dealer: null });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.runId).toBeNull();
    });

    it('still creates failed record when GitHub trigger fails (for visibility)', async () => {
      setupGitHubFailure(500);

      const scrapeRunsInsertSpy = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'scrape_runs') {
          return { insert: scrapeRunsInsertSpy };
        }
        if (table === 'dealers') {
          return createMockQueryBuilder([{ id: 1 }]);
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ dealer: 'Aoi Art' });
      await POST(request);

      // On FAILURE, we do create a record for visibility
      expect(scrapeRunsInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          run_type: 'scrape',
        })
      );
    });
  });

  // ===========================================================================
  // RESPONSE FORMAT TESTS
  // ===========================================================================

  describe('response format', () => {
    beforeEach(() => {
      setupAdminAuth();
      setupGitHubSuccess();
    });

    it('returns workflowUrl in response', async () => {
      const request = createMockRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(json.workflowUrl).toContain('github.com');
      expect(json.workflowUrl).toContain('actions');
    });

    it('returns descriptive message for all dealers', async () => {
      const request = createMockRequest({ dealer: null });
      const response = await POST(request);
      const json = await response.json();

      expect(json.message).toContain('all dealers');
      expect(json.message).toContain('full run');
    });

    it('returns descriptive message for specific dealer', async () => {
      const request = createMockRequest({ dealer: 'Eirakudo' });
      const response = await POST(request);
      const json = await response.json();

      expect(json.message).toContain('Eirakudo');
    });

    it('returns descriptive message for discovery only', async () => {
      const request = createMockRequest({ discoverOnly: true });
      const response = await POST(request);
      const json = await response.json();

      expect(json.message).toContain('discovery only');
    });
  });
});
