import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadPersistedState,
  savePersistedState,
  clearPersistedState,
  getDefaultPersistedState,
  isSessionExpired,
  isOnCooldown,
  hasExceededMaxDismissals,
  checkThresholds,
  calculateTimeOnSite,
} from '@/lib/signup/storage';
import { SIGNUP_PRESSURE_CONFIG, STORAGE_KEY } from '@/lib/signup/config';
import type { SignupPressurePersistedState } from '@/lib/signup/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Signup Pressure Storage Utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDefaultPersistedState', () => {
    it('returns valid default state', () => {
      const state = getDefaultPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.sessionStartTime).toBeGreaterThan(0);
      expect(state.lastDismissedAt).toBeNull();
      expect(state.dismissCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
      expect(state.localFavorites).toEqual([]);
      expect(state.sessionId).toBeTruthy();
    });

    it('generates unique session IDs', () => {
      const state1 = getDefaultPersistedState();
      const state2 = getDefaultPersistedState();

      expect(state1.sessionId).not.toBe(state2.sessionId);
    });
  });

  describe('loadPersistedState', () => {
    it('returns default state when localStorage is empty', () => {
      const state = loadPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
    });

    it('loads valid state from localStorage', () => {
      const savedState: SignupPressurePersistedState = {
        quickViewCount: 5,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: false,
        localFavorites: ['123', '456'],
        sessionId: 'test-session',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(savedState));

      const loaded = loadPersistedState();

      expect(loaded.quickViewCount).toBe(5);
      expect(loaded.dismissCount).toBe(1);
      expect(loaded.localFavorites).toEqual(['123', '456']);
    });

    it('handles corrupted JSON gracefully', () => {
      localStorageMock.setItem(STORAGE_KEY, 'not valid json');

      const state = loadPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
    });

    it('handles partial/invalid data gracefully', () => {
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({
          quickViewCount: 'not a number',
          hasSignedUp: 'not a boolean',
          localFavorites: 'not an array',
        })
      );

      const state = loadPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
      expect(state.localFavorites).toEqual([]);
    });

    it('resets session when expired', () => {
      const expiredTime =
        Date.now() - (SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes + 5) * 60 * 1000;

      const savedState: SignupPressurePersistedState = {
        quickViewCount: 10,
        sessionStartTime: expiredTime,
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: false,
        localFavorites: ['123'],
        sessionId: 'old-session',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(savedState));

      const loaded = loadPersistedState();

      // Quick view count should be reset
      expect(loaded.quickViewCount).toBe(0);
      // Other state should be preserved
      expect(loaded.dismissCount).toBe(1);
      expect(loaded.localFavorites).toEqual(['123']);
      // Session ID should be new
      expect(loaded.sessionId).not.toBe('old-session');
    });
  });

  describe('savePersistedState', () => {
    it('saves state to localStorage', () => {
      const state: SignupPressurePersistedState = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      savePersistedState(state);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    });
  });

  describe('clearPersistedState', () => {
    it('removes state from localStorage', () => {
      clearPersistedState();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('isSessionExpired', () => {
    it('returns false for recent session', () => {
      const recentTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago

      expect(isSessionExpired(recentTime)).toBe(false);
    });

    it('returns true for expired session', () => {
      const expiredTime =
        Date.now() - (SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes + 1) * 60 * 1000;

      expect(isSessionExpired(expiredTime)).toBe(true);
    });
  });

  describe('isOnCooldown', () => {
    it('returns false when never dismissed', () => {
      expect(isOnCooldown(null)).toBe(false);
    });

    it('returns true during cooldown period', () => {
      const recentDismissal = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

      expect(isOnCooldown(recentDismissal)).toBe(true);
    });

    it('returns false after cooldown period', () => {
      const oldDismissal =
        Date.now() - (SIGNUP_PRESSURE_CONFIG.cooldownHours + 1) * 60 * 60 * 1000;

      expect(isOnCooldown(oldDismissal)).toBe(false);
    });
  });

  describe('hasExceededMaxDismissals', () => {
    it('returns false when under limit', () => {
      expect(hasExceededMaxDismissals(0)).toBe(false);
      expect(hasExceededMaxDismissals(SIGNUP_PRESSURE_CONFIG.maxDismissals - 1)).toBe(
        false
      );
    });

    it('returns true when at or over limit', () => {
      expect(hasExceededMaxDismissals(SIGNUP_PRESSURE_CONFIG.maxDismissals)).toBe(true);
      expect(hasExceededMaxDismissals(SIGNUP_PRESSURE_CONFIG.maxDismissals + 1)).toBe(
        true
      );
    });
  });

  describe('checkThresholds', () => {
    const { quickViewThreshold, timeThreshold } = SIGNUP_PRESSURE_CONFIG;

    it('returns false when neither threshold is met', () => {
      expect(checkThresholds(0, 0)).toBe(false);
      expect(checkThresholds(quickViewThreshold - 1, timeThreshold - 1)).toBe(false);
    });

    it('returns false when only view threshold is met (requireBoth=true)', () => {
      expect(checkThresholds(quickViewThreshold, 0)).toBe(false);
    });

    it('returns false when only time threshold is met (requireBoth=true)', () => {
      expect(checkThresholds(0, timeThreshold)).toBe(false);
    });

    it('returns true when both thresholds are met', () => {
      expect(checkThresholds(quickViewThreshold, timeThreshold)).toBe(true);
      expect(checkThresholds(quickViewThreshold + 5, timeThreshold + 60)).toBe(true);
    });
  });

  describe('calculateTimeOnSite', () => {
    it('calculates time correctly', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      const timeOnSite = calculateTimeOnSite(fiveMinutesAgo);

      // Should be approximately 300 seconds (5 minutes)
      expect(timeOnSite).toBeGreaterThanOrEqual(299);
      expect(timeOnSite).toBeLessThanOrEqual(301);
    });
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  describe('Edge Cases: localStorage quota exceeded', () => {
    it('handles setItem throwing QuotaExceededError gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      const state: SignupPressurePersistedState = {
        quickViewCount: 5,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      // Should not throw
      expect(() => savePersistedState(state)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist signup pressure state');

      consoleSpy.mockRestore();
    });

    it('handles setItem throwing generic Error gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage unavailable');
      });

      const state: SignupPressurePersistedState = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: false,
        localFavorites: ['abc'],
        sessionId: 'test-session',
      };

      expect(() => savePersistedState(state)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist signup pressure state');

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases: malformed JSON strings', () => {
    it('handles string starting with valid JSON prefix but invalid overall', () => {
      // Starts with valid JSON structure but is truncated/corrupted
      localStorageMock.setItem(STORAGE_KEY, '{"quickViewCount": 5, "session');

      const state = loadPersistedState();

      // Should return default state
      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
      expect(state.sessionId).toBeTruthy();
    });

    it('handles string that looks like JSON array instead of object', () => {
      localStorageMock.setItem(STORAGE_KEY, '[1, 2, 3]');

      const state = loadPersistedState();

      // Arrays are not valid state objects, should return defaults
      expect(state.quickViewCount).toBe(0);
      expect(state.localFavorites).toEqual([]);
    });

    it('handles JSON with nested object instead of flat structure', () => {
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({
          quickViewCount: { nested: 5 },
          hasSignedUp: { value: true },
        })
      );

      const state = loadPersistedState();

      // Nested objects are not valid for these fields
      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
    });

    it('handles empty JSON object', () => {
      localStorageMock.setItem(STORAGE_KEY, '{}');

      const state = loadPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
      expect(state.localFavorites).toEqual([]);
      expect(state.sessionId).toBeTruthy();
    });
  });

  describe('Edge Cases: session boundary - exactly at timeout', () => {
    it('returns false when exactly at session timeout boundary', () => {
      const exactlyAtTimeout =
        Date.now() - SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes * 60 * 1000;

      // At exactly the timeout, timeSinceStart equals timeoutMs, not greater
      // The implementation uses > (greater than), so exactly at timeout should NOT be expired
      expect(isSessionExpired(exactlyAtTimeout)).toBe(false);
    });

    it('returns true when 1ms past session timeout', () => {
      const oneMsPastTimeout =
        Date.now() - SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes * 60 * 1000 - 1;

      expect(isSessionExpired(oneMsPastTimeout)).toBe(true);
    });

    it('returns false when 1ms before session timeout', () => {
      const oneMsBeforeTimeout =
        Date.now() - SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes * 60 * 1000 + 1;

      expect(isSessionExpired(oneMsBeforeTimeout)).toBe(false);
    });
  });

  describe('Edge Cases: cooldown boundary - exactly at cooldown end', () => {
    it('returns true when exactly at cooldown boundary', () => {
      const exactlyAtCooldown =
        Date.now() - SIGNUP_PRESSURE_CONFIG.cooldownHours * 60 * 60 * 1000;

      // At exactly cooldown, timeSinceDismissal equals cooldownMs
      // The implementation uses < (less than), so exactly at cooldown should NOT be on cooldown
      expect(isOnCooldown(exactlyAtCooldown)).toBe(false);
    });

    it('returns true when 1ms before cooldown ends', () => {
      const oneMsBeforeCooldownEnd =
        Date.now() - SIGNUP_PRESSURE_CONFIG.cooldownHours * 60 * 60 * 1000 + 1;

      expect(isOnCooldown(oneMsBeforeCooldownEnd)).toBe(true);
    });

    it('returns false when 1ms after cooldown ends', () => {
      const oneMsAfterCooldownEnd =
        Date.now() - SIGNUP_PRESSURE_CONFIG.cooldownHours * 60 * 60 * 1000 - 1;

      expect(isOnCooldown(oneMsAfterCooldownEnd)).toBe(false);
    });
  });

  describe('Edge Cases: state migration - old format missing new fields', () => {
    it('handles state missing localFavorites field', () => {
      const oldFormatState = {
        quickViewCount: 10,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 2,
        hasSignedUp: false,
        sessionId: 'old-id',
        // localFavorites is missing
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(oldFormatState));

      const loaded = loadPersistedState();

      expect(loaded.localFavorites).toEqual([]);
      expect(loaded.quickViewCount).toBe(10);
      expect(loaded.dismissCount).toBe(2);
    });

    it('handles state missing sessionId field', () => {
      const oldFormatState = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: false,
        localFavorites: ['item-1'],
        // sessionId is missing
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(oldFormatState));

      const loaded = loadPersistedState();

      // Should generate new session ID
      expect(loaded.sessionId).toBeTruthy();
      expect(loaded.sessionId.length).toBeGreaterThan(0);
      expect(loaded.localFavorites).toEqual(['item-1']);
    });

    it('handles state missing multiple fields', () => {
      const minimalState = {
        quickViewCount: 7,
        // Most fields missing
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(minimalState));

      const loaded = loadPersistedState();

      expect(loaded.quickViewCount).toBe(7);
      expect(loaded.sessionStartTime).toBeGreaterThan(0);
      expect(loaded.lastDismissedAt).toBeNull();
      expect(loaded.dismissCount).toBe(0);
      expect(loaded.hasSignedUp).toBe(false);
      expect(loaded.localFavorites).toEqual([]);
      expect(loaded.sessionId).toBeTruthy();
    });

    it('handles state with extra unexpected fields', () => {
      const stateWithExtraFields = {
        quickViewCount: 4,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test-id',
        unknownField: 'should be ignored',
        anotherUnknownField: 12345,
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithExtraFields));

      const loaded = loadPersistedState();

      expect(loaded.quickViewCount).toBe(4);
      expect(loaded.sessionId).toBe('test-id');
      // Extra fields should not cause issues
    });
  });

  describe('Edge Cases: race condition simulation - multiple rapid saves', () => {
    it('handles multiple rapid sequential saves', () => {
      const states: SignupPressurePersistedState[] = [];

      for (let i = 0; i < 10; i++) {
        const state: SignupPressurePersistedState = {
          quickViewCount: i,
          sessionStartTime: Date.now(),
          lastDismissedAt: null,
          dismissCount: 0,
          hasSignedUp: false,
          localFavorites: [],
          sessionId: `session-${i}`,
        };
        states.push(state);
        savePersistedState(state);
      }

      // Last save should win
      const loaded = loadPersistedState();
      expect(loaded.quickViewCount).toBe(9);
      expect(loaded.sessionId).toBe('session-9');
    });

    it('handles interleaved save and load operations', () => {
      const initialState: SignupPressurePersistedState = {
        quickViewCount: 5,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: false,
        localFavorites: ['item-1'],
        sessionId: 'initial',
      };

      savePersistedState(initialState);

      // Load
      const loaded1 = loadPersistedState();
      expect(loaded1.quickViewCount).toBe(5);

      // Modify and save
      const modifiedState = { ...loaded1, quickViewCount: 6 };
      savePersistedState(modifiedState);

      // Load again
      const loaded2 = loadPersistedState();
      expect(loaded2.quickViewCount).toBe(6);

      // Another modification
      const furtherModified = { ...loaded2, quickViewCount: 7, dismissCount: 2 };
      savePersistedState(furtherModified);

      const finalLoaded = loadPersistedState();
      expect(finalLoaded.quickViewCount).toBe(7);
      expect(finalLoaded.dismissCount).toBe(2);
    });
  });

  describe('Edge Cases: SSR - window/localStorage undefined', () => {
    it('loadPersistedState returns default when window is undefined', () => {
      // Temporarily mock window as undefined
      const originalWindow = global.window;
      // @ts-expect-error - intentionally setting window to undefined for SSR test
      delete global.window;

      const state = loadPersistedState();

      expect(state.quickViewCount).toBe(0);
      expect(state.hasSignedUp).toBe(false);
      expect(state.sessionId).toBeTruthy();

      // Restore window
      global.window = originalWindow;
    });

    it('savePersistedState does nothing when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - intentionally setting window to undefined for SSR test
      delete global.window;

      const state: SignupPressurePersistedState = {
        quickViewCount: 10,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      // Should not throw
      expect(() => savePersistedState(state)).not.toThrow();

      global.window = originalWindow;
    });

    it('clearPersistedState does nothing when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - intentionally setting window to undefined for SSR test
      delete global.window;

      expect(() => clearPersistedState()).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('Edge Cases: negative numbers in state', () => {
    it('handles negative quickViewCount', () => {
      const stateWithNegative = {
        quickViewCount: -5,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNegative));

      const loaded = loadPersistedState();

      // Negative numbers are still valid numbers, implementation accepts them
      expect(loaded.quickViewCount).toBe(-5);
    });

    it('handles negative dismissCount', () => {
      const stateWithNegative = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: -10,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNegative));

      const loaded = loadPersistedState();

      // Negative numbers are still valid numbers
      expect(loaded.dismissCount).toBe(-10);
    });

    it('negative dismissCount never exceeds max dismissals', () => {
      expect(hasExceededMaxDismissals(-1)).toBe(false);
      expect(hasExceededMaxDismissals(-100)).toBe(false);
    });

    it('negative quickViewCount never meets threshold', () => {
      const { timeThreshold } = SIGNUP_PRESSURE_CONFIG;
      expect(checkThresholds(-5, timeThreshold)).toBe(false);
      expect(checkThresholds(-100, timeThreshold + 1000)).toBe(false);
    });

    it('negative timeOnSite never meets threshold', () => {
      const { quickViewThreshold } = SIGNUP_PRESSURE_CONFIG;
      expect(checkThresholds(quickViewThreshold, -100)).toBe(false);
    });
  });

  describe('Edge Cases: future timestamps', () => {
    it('handles sessionStartTime in the future', () => {
      const futureTime = Date.now() + 60 * 60 * 1000; // 1 hour in the future

      // Session with future start time should not be expired
      expect(isSessionExpired(futureTime)).toBe(false);
    });

    it('calculateTimeOnSite returns negative for future sessionStartTime', () => {
      const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes in future

      const timeOnSite = calculateTimeOnSite(futureTime);

      // Will be negative because session hasn't "started" yet
      expect(timeOnSite).toBeLessThan(0);
    });

    it('handles lastDismissedAt in the future (always on cooldown)', () => {
      const futureTime = Date.now() + 24 * 60 * 60 * 1000; // 1 day in future

      // If dismissed "in the future", should still be on cooldown
      expect(isOnCooldown(futureTime)).toBe(true);
    });

    it('loads state with future sessionStartTime without resetting', () => {
      const futureState: SignupPressurePersistedState = {
        quickViewCount: 8,
        sessionStartTime: Date.now() + 60 * 60 * 1000, // 1 hour in future
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'future-session',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(futureState));

      const loaded = loadPersistedState();

      // Future session should not be considered expired
      expect(loaded.quickViewCount).toBe(8);
      expect(loaded.sessionId).toBe('future-session');
    });
  });

  describe('Edge Cases: very large values', () => {
    it('handles very large dismissCount', () => {
      const largeValue = Number.MAX_SAFE_INTEGER;

      expect(hasExceededMaxDismissals(largeValue)).toBe(true);
    });

    it('handles very large quickViewCount', () => {
      const stateWithLargeCount = {
        quickViewCount: Number.MAX_SAFE_INTEGER,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithLargeCount));

      const loaded = loadPersistedState();

      expect(loaded.quickViewCount).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('handles very large values in checkThresholds', () => {
      const { quickViewThreshold, timeThreshold } = SIGNUP_PRESSURE_CONFIG;

      expect(checkThresholds(Number.MAX_SAFE_INTEGER, timeThreshold)).toBe(true);
      expect(checkThresholds(quickViewThreshold, Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it('handles Infinity values', () => {
      expect(checkThresholds(Infinity, SIGNUP_PRESSURE_CONFIG.timeThreshold)).toBe(true);
      expect(hasExceededMaxDismissals(Infinity)).toBe(true);
    });
  });

  describe('Edge Cases: localFavorites with duplicate entries', () => {
    it('preserves duplicate entries in localFavorites', () => {
      const stateWithDuplicates = {
        quickViewCount: 2,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: ['item-1', 'item-1', 'item-2', 'item-2', 'item-1'],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithDuplicates));

      const loaded = loadPersistedState();

      // Implementation does not dedupe, just filters for strings
      expect(loaded.localFavorites).toEqual([
        'item-1',
        'item-1',
        'item-2',
        'item-2',
        'item-1',
      ]);
      expect(loaded.localFavorites.length).toBe(5);
    });

    it('filters out non-string values from localFavorites', () => {
      const stateWithMixedTypes = {
        quickViewCount: 1,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: ['valid', 123, null, undefined, 'also-valid', { id: 'obj' }, true],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithMixedTypes));

      const loaded = loadPersistedState();

      expect(loaded.localFavorites).toEqual(['valid', 'also-valid']);
    });
  });

  describe('Edge Cases: empty string sessionId', () => {
    it('accepts empty string as valid sessionId', () => {
      const stateWithEmptySessionId = {
        quickViewCount: 4,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: '',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithEmptySessionId));

      const loaded = loadPersistedState();

      // Empty string is typeof 'string', so it passes validation
      expect(loaded.sessionId).toBe('');
    });

    it('generates new session ID when sessionId is not a string', () => {
      const stateWithNullSessionId = {
        quickViewCount: 2,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: null,
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNullSessionId));

      const loaded = loadPersistedState();

      expect(loaded.sessionId).toBeTruthy();
      expect(loaded.sessionId.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases: null vs undefined handling', () => {
    it('handles null quickViewCount', () => {
      const stateWithNull = {
        quickViewCount: null,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNull));

      const loaded = loadPersistedState();

      // null is not typeof 'number', so should default to 0
      expect(loaded.quickViewCount).toBe(0);
    });

    it('handles undefined values (JSON.parse results in missing keys)', () => {
      // When undefined is in JSON, it becomes missing key after parse
      const stateWithUndefined = {
        quickViewCount: undefined,
        sessionStartTime: undefined,
        lastDismissedAt: undefined,
        dismissCount: undefined,
        hasSignedUp: undefined,
        localFavorites: undefined,
        sessionId: undefined,
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithUndefined));

      const loaded = loadPersistedState();

      // All should get default values
      expect(loaded.quickViewCount).toBe(0);
      expect(loaded.sessionStartTime).toBeGreaterThan(0);
      expect(loaded.lastDismissedAt).toBeNull();
      expect(loaded.dismissCount).toBe(0);
      expect(loaded.hasSignedUp).toBe(false);
      expect(loaded.localFavorites).toEqual([]);
      expect(loaded.sessionId).toBeTruthy();
    });

    it('handles null in lastDismissedAt for isOnCooldown', () => {
      expect(isOnCooldown(null)).toBe(false);
    });

    it('handles explicit null hasSignedUp', () => {
      const stateWithNullBoolean = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 1,
        hasSignedUp: null,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNullBoolean));

      const loaded = loadPersistedState();

      // null is not typeof 'boolean', so should default to false
      expect(loaded.hasSignedUp).toBe(false);
    });

    it('handles null localFavorites', () => {
      const stateWithNullArray = {
        quickViewCount: 2,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: null,
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithNullArray));

      const loaded = loadPersistedState();

      // null is not Array.isArray, so should default to []
      expect(loaded.localFavorites).toEqual([]);
    });
  });

  describe('Edge Cases: NaN and special number values', () => {
    it('handles NaN quickViewCount', () => {
      // Note: JSON.stringify(NaN) becomes null
      const state = {
        quickViewCount: NaN,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(state));

      const loaded = loadPersistedState();

      // NaN becomes null in JSON, which is not a number
      expect(loaded.quickViewCount).toBe(0);
    });

    it('NaN in checkThresholds returns false', () => {
      // NaN comparisons always return false
      expect(checkThresholds(NaN, SIGNUP_PRESSURE_CONFIG.timeThreshold)).toBe(false);
      expect(checkThresholds(SIGNUP_PRESSURE_CONFIG.quickViewThreshold, NaN)).toBe(false);
      expect(checkThresholds(NaN, NaN)).toBe(false);
    });

    it('NaN in hasExceededMaxDismissals returns false', () => {
      // NaN >= any number is false
      expect(hasExceededMaxDismissals(NaN)).toBe(false);
    });

    it('NaN sessionStartTime is not expired', () => {
      // NaN comparisons return false
      expect(isSessionExpired(NaN)).toBe(false);
    });
  });

  describe('Edge Cases: clearPersistedState error handling', () => {
    it('handles removeItem throwing error', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => clearPersistedState()).not.toThrow();
    });
  });

  describe('Edge Cases: string coercion in numeric fields', () => {
    it('rejects numeric strings for quickViewCount', () => {
      const stateWithStringNumber = {
        quickViewCount: '5',
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: false,
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithStringNumber));

      const loaded = loadPersistedState();

      // '5' is typeof 'string', not 'number'
      expect(loaded.quickViewCount).toBe(0);
    });

    it('rejects boolean-like strings for hasSignedUp', () => {
      const stateWithStringBoolean = {
        quickViewCount: 3,
        sessionStartTime: Date.now(),
        lastDismissedAt: null,
        dismissCount: 0,
        hasSignedUp: 'true',
        localFavorites: [],
        sessionId: 'test',
      };

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stateWithStringBoolean));

      const loaded = loadPersistedState();

      // 'true' is typeof 'string', not 'boolean'
      expect(loaded.hasSignedUp).toBe(false);
    });
  });

  describe('Edge Cases: calculateTimeOnSite edge values', () => {
    it('returns 0 for current time', () => {
      const now = Date.now();

      const timeOnSite = calculateTimeOnSite(now);

      expect(timeOnSite).toBe(0);
    });

    it('handles very old timestamps', () => {
      const veryOld = 0; // Unix epoch

      const timeOnSite = calculateTimeOnSite(veryOld);

      // Should be a very large number (seconds since epoch)
      expect(timeOnSite).toBeGreaterThan(1000000000);
    });
  });

  describe('Edge Cases: threshold boundary conditions', () => {
    it('returns false when quickViewCount is exactly one below threshold', () => {
      const { quickViewThreshold, timeThreshold } = SIGNUP_PRESSURE_CONFIG;

      expect(checkThresholds(quickViewThreshold - 1, timeThreshold)).toBe(false);
    });

    it('returns false when timeOnSite is exactly one below threshold', () => {
      const { quickViewThreshold, timeThreshold } = SIGNUP_PRESSURE_CONFIG;

      expect(checkThresholds(quickViewThreshold, timeThreshold - 1)).toBe(false);
    });

    it('returns true when both are exactly at threshold', () => {
      const { quickViewThreshold, timeThreshold } = SIGNUP_PRESSURE_CONFIG;

      expect(checkThresholds(quickViewThreshold, timeThreshold)).toBe(true);
    });

    it('handles zero values for both thresholds', () => {
      expect(checkThresholds(0, 0)).toBe(false);
    });
  });

  describe('Edge Cases: max dismissals boundary', () => {
    it('returns false when dismissCount is exactly one below max', () => {
      expect(hasExceededMaxDismissals(SIGNUP_PRESSURE_CONFIG.maxDismissals - 1)).toBe(
        false
      );
    });

    it('returns true when dismissCount is exactly at max', () => {
      expect(hasExceededMaxDismissals(SIGNUP_PRESSURE_CONFIG.maxDismissals)).toBe(true);
    });

    it('handles dismissCount of 0', () => {
      expect(hasExceededMaxDismissals(0)).toBe(false);
    });
  });
});
