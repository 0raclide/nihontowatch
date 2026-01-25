/**
 * Consent Storage Tests
 *
 * Tests for consent storage helpers and type definitions.
 * These ensure proper localStorage handling and consent state management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  type ConsentPreferences,
  type ConsentRecord,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_PREFERENCES,
  ACCEPT_ALL_PREFERENCES,
  REJECT_NON_ESSENTIAL_PREFERENCES,
} from '@/lib/consent/types';

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('Consent Constants', () => {
  it('has correct storage key', () => {
    expect(CONSENT_STORAGE_KEY).toBe('nihontowatch_consent');
  });

  it('has version string', () => {
    expect(CONSENT_VERSION).toBeDefined();
    expect(typeof CONSENT_VERSION).toBe('string');
  });

  it('DEFAULT_PREFERENCES has essential always true', () => {
    expect(DEFAULT_PREFERENCES.essential).toBe(true);
  });

  it('DEFAULT_PREFERENCES has all non-essential as false', () => {
    expect(DEFAULT_PREFERENCES.functional).toBe(false);
    expect(DEFAULT_PREFERENCES.analytics).toBe(false);
    expect(DEFAULT_PREFERENCES.marketing).toBe(false);
  });

  it('ACCEPT_ALL_PREFERENCES has all categories true', () => {
    expect(ACCEPT_ALL_PREFERENCES.essential).toBe(true);
    expect(ACCEPT_ALL_PREFERENCES.functional).toBe(true);
    expect(ACCEPT_ALL_PREFERENCES.analytics).toBe(true);
    expect(ACCEPT_ALL_PREFERENCES.marketing).toBe(true);
  });

  it('REJECT_NON_ESSENTIAL_PREFERENCES has only essential true', () => {
    expect(REJECT_NON_ESSENTIAL_PREFERENCES.essential).toBe(true);
    expect(REJECT_NON_ESSENTIAL_PREFERENCES.functional).toBe(false);
    expect(REJECT_NON_ESSENTIAL_PREFERENCES.analytics).toBe(false);
    expect(REJECT_NON_ESSENTIAL_PREFERENCES.marketing).toBe(false);
  });
});

// =============================================================================
// CONSENT HELPERS TESTS
// =============================================================================

describe('Consent Helpers', () => {
  // Mock localStorage
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
  });

  describe('hasConsentFor', () => {
    it('returns false when no consent stored', async () => {
      const { hasConsentFor } = await import('@/lib/consent/helpers');
      expect(hasConsentFor('analytics')).toBe(false);
    });

    it('returns true for essential even without stored consent', async () => {
      // Re-import to get fresh module
      vi.resetModules();
      const { hasConsentFor } = await import('@/lib/consent/helpers');
      // Essential is always considered true
      expect(hasConsentFor('essential')).toBe(true);
    });

    it('returns stored consent value for analytics', async () => {
      const consent: ConsentRecord = {
        preferences: ACCEPT_ALL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasConsentFor } = await import('@/lib/consent/helpers');
      expect(hasConsentFor('analytics')).toBe(true);
    });

    it('returns false for analytics when rejected', async () => {
      const consent: ConsentRecord = {
        preferences: REJECT_NON_ESSENTIAL_PREFERENCES,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasConsentFor } = await import('@/lib/consent/helpers');
      expect(hasConsentFor('analytics')).toBe(false);
    });
  });

  describe('hasAnalyticsConsent', () => {
    it('returns false when no consent stored', async () => {
      vi.resetModules();
      const { hasAnalyticsConsent } = await import('@/lib/consent/helpers');
      expect(hasAnalyticsConsent()).toBe(false);
    });

    it('returns true when analytics consent given', async () => {
      const consent: ConsentRecord = {
        preferences: { ...DEFAULT_PREFERENCES, analytics: true },
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasAnalyticsConsent } = await import('@/lib/consent/helpers');
      expect(hasAnalyticsConsent()).toBe(true);
    });
  });

  describe('hasFunctionalConsent', () => {
    it('returns false when no consent stored', async () => {
      vi.resetModules();
      const { hasFunctionalConsent } = await import('@/lib/consent/helpers');
      expect(hasFunctionalConsent()).toBe(false);
    });

    it('returns true when functional consent given', async () => {
      const consent: ConsentRecord = {
        preferences: { ...DEFAULT_PREFERENCES, functional: true },
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasFunctionalConsent } = await import('@/lib/consent/helpers');
      expect(hasFunctionalConsent()).toBe(true);
    });
  });

  describe('hasMarketingConsent', () => {
    it('returns false when no consent stored', async () => {
      vi.resetModules();
      const { hasMarketingConsent } = await import('@/lib/consent/helpers');
      expect(hasMarketingConsent()).toBe(false);
    });

    it('returns true when marketing consent given', async () => {
      const consent: ConsentRecord = {
        preferences: { ...DEFAULT_PREFERENCES, marketing: true },
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify(consent);

      vi.resetModules();
      const { hasMarketingConsent } = await import('@/lib/consent/helpers');
      expect(hasMarketingConsent()).toBe(true);
    });
  });
});

// =============================================================================
// TYPE VALIDATION TESTS
// =============================================================================

describe('Consent Type Validation', () => {
  it('ConsentPreferences requires essential to be true', () => {
    // TypeScript will enforce this at compile time
    // This test documents the expected structure
    const validPreferences: ConsentPreferences = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    };
    expect(validPreferences.essential).toBe(true);
  });

  it('ConsentRecord has required fields', () => {
    const record: ConsentRecord = {
      preferences: DEFAULT_PREFERENCES,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };

    expect(record).toHaveProperty('preferences');
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('version');
  });

  it('ConsentRecord timestamp is ISO string', () => {
    const record: ConsentRecord = {
      preferences: DEFAULT_PREFERENCES,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };

    // Verify it's a valid ISO string
    const parsed = new Date(record.timestamp);
    expect(parsed.toISOString()).toBe(record.timestamp);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Consent Edge Cases', () => {
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
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorageMock[CONSENT_STORAGE_KEY] = 'not valid json';

    vi.resetModules();
    const { hasAnalyticsConsent } = await import('@/lib/consent/helpers');

    // Should return false (default) rather than throwing
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('handles missing preferences in stored consent', async () => {
    // Partial/corrupted consent object
    localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify({
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
      // preferences missing
    });

    vi.resetModules();
    const { hasAnalyticsConsent } = await import('@/lib/consent/helpers');

    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('handles null preferences values', async () => {
    localStorageMock[CONSENT_STORAGE_KEY] = JSON.stringify({
      preferences: {
        essential: true,
        functional: null,
        analytics: null,
        marketing: null,
      },
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    });

    vi.resetModules();
    const { hasAnalyticsConsent } = await import('@/lib/consent/helpers');

    // null should be treated as false
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
