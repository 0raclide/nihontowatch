/**
 * Tracking Consent Integration Tests
 *
 * Tests that tracking respects GDPR consent.
 * CRITICAL: Tracking without consent is a GDPR violation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  type ConsentRecord,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_PREFERENCES,
  ACCEPT_ALL_PREFERENCES,
  REJECT_NON_ESSENTIAL_PREFERENCES,
} from '@/lib/consent/types';

// =============================================================================
// ACTIVITY TRACKER CONSENT TESTS
// =============================================================================

describe('ActivityTracker Consent', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });
    vi.stubGlobal('window', {
      location: { pathname: '/test' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('hasOptedOutOfTracking', () => {
    it('returns true when no consent given (GDPR default)', async () => {
      const { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');

      // No consent = opted out (GDPR compliant)
      expect(hasOptedOutOfTracking()).toBe(true);
    });

    it('returns false when analytics consent given', async () => {
      const consent: ConsentRecord = {
        preferences: ACCEPT_ALL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');

      expect(hasOptedOutOfTracking()).toBe(false);
    });

    it('returns true when analytics consent rejected', async () => {
      const consent: ConsentRecord = {
        preferences: REJECT_NON_ESSENTIAL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');

      expect(hasOptedOutOfTracking()).toBe(true);
    });

    it('respects legacy tracking opt-out', async () => {
      // Even with consent, legacy opt-out should be respected
      const consent: ConsentRecord = {
        preferences: ACCEPT_ALL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);
      // Use correct key: nihontowatch_tracking_opt_out (not privacy_opt_out)
      localStorageMock['nihontowatch_tracking_opt_out'] = 'true';

      vi.resetModules();
      const { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');

      expect(hasOptedOutOfTracking()).toBe(true);
    });
  });
});

// =============================================================================
// VISITOR ID CONSENT TESTS
// =============================================================================

describe('Visitor ID Consent', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('getVisitorId', () => {
    it('returns session-only ID when no consent', async () => {
      vi.resetModules();
      const { getVisitorId } = await import('@/lib/activity/visitorId');

      const visitorId = getVisitorId();

      // Should return an ID (session-only)
      expect(visitorId).toBeDefined();
      expect(typeof visitorId).toBe('string');
      expect(visitorId.length).toBeGreaterThan(0);

      // Should NOT persist to localStorage without consent
      expect(localStorageMock['nihontowatch_visitor_id']).toBeUndefined();
    });

    it('persists visitor ID when analytics consent given', async () => {
      const consent: ConsentRecord = {
        preferences: ACCEPT_ALL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { getVisitorId } = await import('@/lib/activity/visitorId');

      const visitorId = getVisitorId();

      expect(visitorId).toBeDefined();
      // Should persist to localStorage with consent
      expect(localStorageMock['nihontowatch_visitor_id']).toBe(visitorId);
    });

    it('returns existing visitor ID if already stored', async () => {
      const existingId = 'existing-visitor-id-12345';
      localStorageMock['nihontowatch_visitor_id'] = existingId;

      vi.resetModules();
      const { getVisitorId } = await import('@/lib/activity/visitorId');

      const visitorId = getVisitorId();

      // Should return existing ID (consent was given when it was created)
      expect(visitorId).toBe(existingId);
    });

    it('does not persist new ID when consent rejected', async () => {
      const consent: ConsentRecord = {
        preferences: REJECT_NON_ESSENTIAL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { getVisitorId } = await import('@/lib/activity/visitorId');

      const visitorId = getVisitorId();

      expect(visitorId).toBeDefined();
      // Should NOT persist - consent rejected
      expect(localStorageMock['nihontowatch_visitor_id']).toBeUndefined();
    });
  });
});

// =============================================================================
// CONSENT STATE CHANGE TESTS
// =============================================================================

describe('Consent State Changes', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });
    vi.stubGlobal('window', {
      location: { pathname: '/test' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('tracking behavior changes after consent is given', async () => {
    // Initially no consent
    vi.resetModules();
    let { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');
    expect(hasOptedOutOfTracking()).toBe(true);

    // User gives consent
    const consent: ConsentRecord = {
      preferences: ACCEPT_ALL_PREFERENCES,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

    // Re-check (module needs reset to pick up localStorage change)
    vi.resetModules();
    ({ hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker'));
    expect(hasOptedOutOfTracking()).toBe(false);
  });

  it('tracking stops after consent is revoked', async () => {
    // Initially has consent
    const consent: ConsentRecord = {
      preferences: ACCEPT_ALL_PREFERENCES,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

    vi.resetModules();
    let { hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker');
    expect(hasOptedOutOfTracking()).toBe(false);

    // User revokes consent
    const revokedConsent: ConsentRecord = {
      preferences: REJECT_NON_ESSENTIAL_PREFERENCES,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(revokedConsent);

    // Re-check
    vi.resetModules();
    ({ hasOptedOutOfTracking } = await import('@/lib/tracking/ActivityTracker'));
    expect(hasOptedOutOfTracking()).toBe(true);
  });
});
