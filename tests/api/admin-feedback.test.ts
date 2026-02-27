/**
 * Admin Feedback API Unit Tests
 *
 * Tests the admin feedback endpoints:
 * - GET /api/admin/feedback — list with pagination, filters, summary counts
 * - PATCH /api/admin/feedback/[id] — update status/notes, resolved_by auto-set
 *
 * Uses vitest with mocking - no live server required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js headers before imports
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Admin auth mock
let mockIsAdmin = true;
let mockAuthError: string | null = null;
const mockAdminUser = { id: 'admin-001' };

vi.mock('@/lib/admin/auth', () => ({
  verifyAdmin: vi.fn(() => {
    if (mockAuthError === 'unauthorized') {
      return Promise.resolve({ isAdmin: false, error: 'unauthorized' });
    }
    if (mockAuthError === 'forbidden') {
      return Promise.resolve({ isAdmin: false, error: 'forbidden' });
    }
    if (mockIsAdmin) {
      return Promise.resolve({ isAdmin: true, user: mockAdminUser });
    }
    return Promise.resolve({ isAdmin: false, error: 'forbidden' });
  }),
}));

// Track Supabase operations
interface QueryTracker {
  fromCalls: string[];
  selectCalls: Array<{ columns: string; options?: Record<string, unknown> }>;
  eqCalls: Array<{ column: string; value: unknown }>;
  orderCalls: Array<{ column: string; options: Record<string, unknown> }>;
  rangeCalls: Array<{ from: number; to: number }>;
  updateCalls: Array<{ data: Record<string, unknown> }>;
  inCalls: Array<{ column: string; values: unknown[] }>;
}

let tracker: QueryTracker;

// Mock data
let mockFeedbackData: Record<string, unknown>[] = [];
let mockFeedbackCount = 0;
let mockProfilesData: Array<{ id: string; display_name: string | null }> = [];
let mockCountResults = { open: 5, data_report: 3, bug: 2, feature_request: 1 };
let mockUpdateResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: { id: 1, status: 'acknowledged' },
  error: null,
};

// Count query tracker — parallel count queries return different counts
let countQueryIndex = 0;

function createMockQueryBuilder(tableName: string) {
  tracker.fromCalls.push(tableName);
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  let isCountQuery = false;
  let isUpdateQuery = false;

  builder.select = vi.fn((columns: string, options?: Record<string, unknown>) => {
    tracker.selectCalls.push({ columns, options });
    if (options?.head) isCountQuery = true;
    return builder;
  });

  builder.update = vi.fn((data: Record<string, unknown>) => {
    tracker.updateCalls.push({ data });
    isUpdateQuery = true;
    return builder;
  });

  builder.eq = vi.fn((column: string, value: unknown) => {
    tracker.eqCalls.push({ column, value });

    // For count queries, resolve immediately
    if (isCountQuery) {
      let count = 0;
      if (column === 'status' && value === 'open') count = mockCountResults.open;
      if (column === 'feedback_type' && value === 'data_report') count = mockCountResults.data_report;
      if (column === 'feedback_type' && value === 'bug') count = mockCountResults.bug;
      if (column === 'feedback_type' && value === 'feature_request') count = mockCountResults.feature_request;
      return Promise.resolve({ count, error: null });
    }

    // For update queries needing .select().single()
    if (isUpdateQuery) {
      return builder;
    }

    return builder;
  });

  builder.order = vi.fn((column: string, options: Record<string, unknown>) => {
    tracker.orderCalls.push({ column, options });
    return builder;
  });

  builder.range = vi.fn((from: number, to: number) => {
    tracker.rangeCalls.push({ from, to });
    return Promise.resolve({
      data: mockFeedbackData,
      error: null,
      count: mockFeedbackCount,
    });
  });

  builder.in = vi.fn((column: string, values: unknown[]) => {
    tracker.inCalls.push({ column, values });
    // This is the profiles query
    return Promise.resolve({
      data: mockProfilesData,
      error: null,
    });
  });

  builder.single = vi.fn(() => {
    return Promise.resolve(mockUpdateResult);
  });

  return builder;
}

const mockAnonClient = {
  auth: { getUser: vi.fn() },
};

const mockServiceClient = {
  from: vi.fn((table: string) => createMockQueryBuilder(table)),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockAnonClient)),
  createServiceClient: vi.fn(() => mockServiceClient),
}));

// Helper to create GET request with query params
function createGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/admin/feedback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

// Helper to create PATCH request
function createPatchRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/admin/feedback/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Import route handlers AFTER mocks
import { GET } from '@/app/api/admin/feedback/route';
import { PATCH } from '@/app/api/admin/feedback/[id]/route';

beforeEach(() => {
  vi.clearAllMocks();
  tracker = {
    fromCalls: [],
    selectCalls: [],
    eqCalls: [],
    orderCalls: [],
    rangeCalls: [],
    updateCalls: [],
    inCalls: [],
  };
  mockIsAdmin = true;
  mockAuthError = null;
  mockFeedbackData = [
    { id: 1, user_id: 'u1', feedback_type: 'bug', message: 'Bug!', status: 'open', created_at: new Date().toISOString() },
    { id: 2, user_id: 'u2', feedback_type: 'data_report', message: 'Wrong', status: 'open', created_at: new Date().toISOString() },
  ];
  mockFeedbackCount = 2;
  mockProfilesData = [
    { id: 'u1', display_name: 'Alice' },
    { id: 'u2', display_name: 'Bob' },
  ];
  mockCountResults = { open: 5, data_report: 3, bug: 2, feature_request: 1 };
  mockUpdateResult = { data: { id: 1, status: 'acknowledged' }, error: null };
  countQueryIndex = 0;

  mockServiceClient.from.mockImplementation((table: string) => createMockQueryBuilder(table));
});

// =============================================================================
// GET — AUTH TESTS
// =============================================================================

describe('Admin Feedback GET - Authentication', () => {
  it('returns 401 for unauthenticated users', async () => {
    mockAuthError = 'unauthorized';

    const request = createGetRequest();
    const response = await GET(request as never);

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    mockAuthError = 'forbidden';

    const request = createGetRequest();
    const response = await GET(request as never);

    expect(response.status).toBe(403);
  });

  it('succeeds for admin users', async () => {
    const request = createGetRequest();
    const response = await GET(request as never);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// GET — DATA & ENRICHMENT TESTS
// =============================================================================

describe('Admin Feedback GET - Data', () => {
  it('returns enriched feedback with user display names', async () => {
    const request = createGetRequest();
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.data).toHaveLength(2);
    expect(json.data[0].user_display_name).toBe('Alice');
    expect(json.data[1].user_display_name).toBe('Bob');
  });

  it('returns "Unknown" for users without display_name', async () => {
    mockProfilesData = [{ id: 'u1', display_name: null }];

    const request = createGetRequest();
    const response = await GET(request as never);

    const json = await response.json();
    expect(json.data[0].user_display_name).toBe('Unknown');
  });

  it('returns total count', async () => {
    mockFeedbackCount = 42;

    const request = createGetRequest();
    const response = await GET(request as never);

    const json = await response.json();
    expect(json.total).toBe(42);
  });

  it('returns summary with true DB totals', async () => {
    const request = createGetRequest();
    const response = await GET(request as never);

    const json = await response.json();
    expect(json.summary).toEqual({
      open: 5,
      data_reports: 3,
      bugs: 2,
      features: 1,
    });
  });
});

// =============================================================================
// GET — FILTER TESTS
// =============================================================================

describe('Admin Feedback GET - Filters', () => {
  it('filters by status when provided', async () => {
    const request = createGetRequest({ status: 'open' });
    await GET(request as never);

    const statusEq = tracker.eqCalls.find(c => c.column === 'status' && c.value === 'open');
    expect(statusEq).toBeDefined();
  });

  it('filters by feedback type when provided', async () => {
    const request = createGetRequest({ type: 'bug' });
    await GET(request as never);

    const typeEq = tracker.eqCalls.find(c => c.column === 'feedback_type' && c.value === 'bug');
    expect(typeEq).toBeDefined();
  });

  it('paginates correctly', async () => {
    const request = createGetRequest({ page: '2', limit: '10' });
    await GET(request as never);

    // Page 2 with limit 10 = range(10, 19)
    const rangeCall = tracker.rangeCalls.find(c => c.from === 10 && c.to === 19);
    expect(rangeCall).toBeDefined();
  });

  it('caps limit at 100', async () => {
    const request = createGetRequest({ limit: '500' });
    await GET(request as never);

    // Should cap at 100, so range(0, 99)
    const rangeCall = tracker.rangeCalls[0];
    expect(rangeCall.to - rangeCall.from).toBeLessThanOrEqual(99);
  });

  it('orders by created_at descending', async () => {
    const request = createGetRequest();
    await GET(request as never);

    const orderCall = tracker.orderCalls.find(c => c.column === 'created_at');
    expect(orderCall).toBeDefined();
    expect(orderCall!.options.ascending).toBe(false);
  });
});

// =============================================================================
// PATCH — AUTH TESTS
// =============================================================================

describe('Admin Feedback PATCH - Authentication', () => {
  it('returns 401 for unauthenticated users', async () => {
    mockAuthError = 'unauthorized';

    const request = createPatchRequest({ status: 'acknowledged' });
    const response = await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    mockAuthError = 'forbidden';

    const request = createPatchRequest({ status: 'acknowledged' });
    const response = await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    expect(response.status).toBe(403);
  });
});

// =============================================================================
// PATCH — VALIDATION TESTS
// =============================================================================

describe('Admin Feedback PATCH - Validation', () => {
  it('returns 400 for non-numeric ID', async () => {
    const request = createPatchRequest({ status: 'acknowledged' });
    const response = await PATCH(request as never, { params: Promise.resolve({ id: 'abc' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Invalid');
  });

  it('returns 400 for invalid status', async () => {
    const request = createPatchRequest({ status: 'invalid_status' });
    const response = await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 400 when no fields to update', async () => {
    const request = createPatchRequest({});
    const response = await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('No fields');
  });
});

// =============================================================================
// PATCH — STATUS UPDATE TESTS
// =============================================================================

describe('Admin Feedback PATCH - Status Updates', () => {
  it('updates status to acknowledged', async () => {
    const request = createPatchRequest({ status: 'acknowledged' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls.find(c => c.data.status === 'acknowledged');
    expect(updateCall).toBeDefined();
  });

  it('sets resolved_by and resolved_at when status is resolved', async () => {
    const request = createPatchRequest({ status: 'resolved' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls[0];
    expect(updateCall.data.status).toBe('resolved');
    expect(updateCall.data.resolved_by).toBe('admin-001');
    expect(updateCall.data.resolved_at).toBeDefined();
  });

  it('sets resolved_by and resolved_at when status is dismissed', async () => {
    const request = createPatchRequest({ status: 'dismissed' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls[0];
    expect(updateCall.data.resolved_by).toBe('admin-001');
    expect(updateCall.data.resolved_at).toBeDefined();
  });

  it('clears resolved_by when reopening', async () => {
    const request = createPatchRequest({ status: 'open' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls[0];
    expect(updateCall.data.status).toBe('open');
    expect(updateCall.data.resolved_by).toBeNull();
    expect(updateCall.data.resolved_at).toBeNull();
  });

  it('updates admin_notes', async () => {
    const request = createPatchRequest({ admin_notes: 'Fixed in v2.1' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls[0];
    expect(updateCall.data.admin_notes).toBe('Fixed in v2.1');
  });

  it('updates both status and notes simultaneously', async () => {
    const request = createPatchRequest({ status: 'resolved', admin_notes: 'Done' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    const updateCall = tracker.updateCalls[0];
    expect(updateCall.data.status).toBe('resolved');
    expect(updateCall.data.admin_notes).toBe('Done');
    expect(updateCall.data.resolved_by).toBe('admin-001');
  });

  it('uses service client for updates', async () => {
    const request = createPatchRequest({ status: 'acknowledged' });
    await PATCH(request as never, { params: Promise.resolve({ id: '1' }) });

    // Service client's .from should have been called
    expect(mockServiceClient.from).toHaveBeenCalledWith('user_feedback');
  });
});
