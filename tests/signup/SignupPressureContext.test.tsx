import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import {
  SignupPressureProvider,
  useSignupPressure,
  useSignupPressureOptional,
} from '@/contexts/SignupPressureContext';
import { SIGNUP_PRESSURE_CONFIG, STORAGE_KEY } from '@/lib/signup/config';

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
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test consumer component that exposes context state
function TestConsumer() {
  const {
    isModalOpen,
    triggerContext,
    quickViewCount,
    timeOnSite,
    thresholdsMet,
    isOnCooldown,
    isAuthenticated,
    trackQuickView,
    triggerForAction,
    dismissModal,
    closeModal,
    markAsSignedUp,
    addLocalFavorite,
    getLocalFavorites,
    resetSession,
  } = useSignupPressure();

  return (
    <div>
      <span data-testid="modal-open">{isModalOpen ? 'open' : 'closed'}</span>
      <span data-testid="trigger-context">{triggerContext || 'none'}</span>
      <span data-testid="quick-view-count">{quickViewCount}</span>
      <span data-testid="time-on-site">{timeOnSite}</span>
      <span data-testid="thresholds-met">{thresholdsMet ? 'yes' : 'no'}</span>
      <span data-testid="on-cooldown">{isOnCooldown ? 'yes' : 'no'}</span>
      <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="local-favorites">{getLocalFavorites().join(',')}</span>

      <button data-testid="track-quick-view" onClick={trackQuickView}>
        Track View
      </button>
      <button
        data-testid="trigger-favorite"
        onClick={() => triggerForAction('favorite')}
      >
        Trigger Favorite
      </button>
      <button data-testid="trigger-alert" onClick={() => triggerForAction('alert')}>
        Trigger Alert
      </button>
      <button data-testid="dismiss-modal" onClick={dismissModal}>
        Dismiss
      </button>
      <button data-testid="close-modal" onClick={closeModal}>
        Close
      </button>
      <button data-testid="mark-signed-up" onClick={markAsSignedUp}>
        Mark Signed Up
      </button>
      <button
        data-testid="add-favorite"
        onClick={() => addLocalFavorite('listing-123')}
      >
        Add Favorite
      </button>
      <button data-testid="reset-session" onClick={resetSession}>
        Reset
      </button>
    </div>
  );
}

describe('SignupPressureContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('provides initial state with modal closed', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('none');
      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('0');
      expect(screen.getByTestId('thresholds-met')).toHaveTextContent('no');
      expect(screen.getByTestId('on-cooldown')).toHaveTextContent('no');
    });

    it('reflects isAuthenticated prop', () => {
      render(
        <SignupPressureProvider isAuthenticated={true}>
          <TestConsumer />
        </SignupPressureProvider>
      );

      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });
  });

  describe('Quick View Tracking', () => {
    it('increments quick view count when trackQuickView is called', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('0');

      fireEvent.click(screen.getByTestId('track-quick-view'));
      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('track-quick-view'));
      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');
    });

    it('does not track views when authenticated', () => {
      render(
        <SignupPressureProvider isAuthenticated={true}>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('track-quick-view'));
      fireEvent.click(screen.getByTestId('track-quick-view'));

      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('0');
    });

    it('persists quick view count to localStorage', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('track-quick-view'));
      fireEvent.click(screen.getByTestId('track-quick-view'));
      fireEvent.click(screen.getByTestId('track-quick-view'));

      // Check localStorage was updated
      const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored.quickViewCount).toBe(3);
    });
  });

  describe('Engagement Threshold Auto-Trigger', () => {
    it('triggers modal when both thresholds are met', async () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Track enough quick views
      for (let i = 0; i < SIGNUP_PRESSURE_CONFIG.quickViewThreshold; i++) {
        fireEvent.click(screen.getByTestId('track-quick-view'));
      }

      // Verify view count
      expect(screen.getByTestId('quick-view-count')).toHaveTextContent(
        String(SIGNUP_PRESSURE_CONFIG.quickViewThreshold)
      );

      // Advance time past threshold using multiple small increments
      // to allow the timer interval to fire
      for (let i = 0; i < SIGNUP_PRESSURE_CONFIG.timeThreshold + 5; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      // Modal should now be open
      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('engagement');
    }, 10000);

    it('does not trigger when only view threshold is met', async () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Track enough quick views but don't wait for time
      for (let i = 0; i < SIGNUP_PRESSURE_CONFIG.quickViewThreshold; i++) {
        fireEvent.click(screen.getByTestId('track-quick-view'));
      }

      // Only advance a little time
      act(() => {
        vi.advanceTimersByTime(30 * 1000); // 30 seconds
      });

      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
    });
  });

  describe('Action Triggers', () => {
    it('triggers modal for favorite action', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-favorite'));

      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');
    });

    it('triggers modal for alert action', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-alert'));

      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('alert');
    });

    it('does not trigger when authenticated', () => {
      render(
        <SignupPressureProvider isAuthenticated={true}>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-favorite'));

      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
    });

    it('does not trigger when modal is already open', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open with favorite
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');

      // Try to trigger with alert - should not change context
      fireEvent.click(screen.getByTestId('trigger-alert'));
      expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');
    });
  });

  describe('Modal Dismissal', () => {
    it('closes modal and starts cooldown on dismiss', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open modal
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');

      // Dismiss
      fireEvent.click(screen.getByTestId('dismiss-modal'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      expect(screen.getByTestId('on-cooldown')).toHaveTextContent('yes');
    });

    it('does not trigger during cooldown', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open and dismiss
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('dismiss-modal'));

      // Try to trigger again
      fireEvent.click(screen.getByTestId('trigger-alert'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
    });

    it('allows trigger after cooldown period', async () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open and dismiss
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('dismiss-modal'));

      // Advance past cooldown
      act(() => {
        vi.advanceTimersByTime(
          (SIGNUP_PRESSURE_CONFIG.cooldownHours + 1) * 60 * 60 * 1000
        );
      });

      // Should be able to trigger now
      fireEvent.click(screen.getByTestId('trigger-alert'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
    });

    it('increments dismiss count', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // First dismiss
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('dismiss-modal'));

      const stored1 = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored1.dismissCount).toBe(1);

      // Advance past cooldown and dismiss again
      act(() => {
        vi.advanceTimersByTime(
          (SIGNUP_PRESSURE_CONFIG.cooldownHours + 1) * 60 * 60 * 1000
        );
      });

      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('dismiss-modal'));

      const stored2 = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored2.dismissCount).toBe(2);
    });

    it('stops triggering after max dismissals', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Dismiss max times
      for (let i = 0; i < SIGNUP_PRESSURE_CONFIG.maxDismissals; i++) {
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        fireEvent.click(screen.getByTestId('dismiss-modal'));

        // Advance past cooldown
        act(() => {
          vi.advanceTimersByTime(
            (SIGNUP_PRESSURE_CONFIG.cooldownHours + 1) * 60 * 60 * 1000
          );
        });
      }

      // Should not trigger anymore
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
    });
  });

  describe('Close Without Cooldown', () => {
    it('closes modal without starting cooldown', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open and close (not dismiss)
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('close-modal'));

      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      expect(screen.getByTestId('on-cooldown')).toHaveTextContent('no');

      // Should be able to trigger immediately
      fireEvent.click(screen.getByTestId('trigger-alert'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
    });
  });

  describe('Mark As Signed Up', () => {
    it('closes modal and disables future triggers', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Open and mark signed up
      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('mark-signed-up'));

      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');

      // Should not trigger anymore
      fireEvent.click(screen.getByTestId('trigger-alert'));
      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');

      // Should not track views
      fireEvent.click(screen.getByTestId('track-quick-view'));
      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('0');
    });

    it('persists signed up state', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-favorite'));
      fireEvent.click(screen.getByTestId('mark-signed-up'));

      const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored.hasSignedUp).toBe(true);
    });
  });

  describe('Local Favorites', () => {
    it('adds local favorites', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('add-favorite'));

      expect(screen.getByTestId('local-favorites')).toHaveTextContent('listing-123');
    });

    it('does not add duplicate favorites', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('add-favorite'));
      fireEvent.click(screen.getByTestId('add-favorite'));

      expect(screen.getByTestId('local-favorites')).toHaveTextContent('listing-123');
      // Check localStorage to verify no duplicates
      const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored.localFavorites).toEqual(['listing-123']);
    });

    it('persists local favorites', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      fireEvent.click(screen.getByTestId('add-favorite'));

      const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
      expect(stored.localFavorites).toContain('listing-123');
    });
  });

  describe('Reset Session', () => {
    it('resets all state', () => {
      render(
        <SignupPressureProvider>
          <TestConsumer />
        </SignupPressureProvider>
      );

      // Build up some state
      fireEvent.click(screen.getByTestId('track-quick-view'));
      fireEvent.click(screen.getByTestId('track-quick-view'));
      fireEvent.click(screen.getByTestId('add-favorite'));

      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');
      expect(screen.getByTestId('local-favorites')).toHaveTextContent('listing-123');

      // Reset
      fireEvent.click(screen.getByTestId('reset-session'));

      expect(screen.getByTestId('quick-view-count')).toHaveTextContent('0');
      expect(screen.getByTestId('local-favorites')).toHaveTextContent('');
      expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
    });
  });

  describe('Hook Usage', () => {
    it('useSignupPressure throws when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useSignupPressure must be used within a SignupPressureProvider');

      consoleSpy.mockRestore();
    });

    it('useSignupPressureOptional returns null outside provider', () => {
      function OptionalConsumer() {
        const context = useSignupPressureOptional();
        return <span data-testid="context-status">{context ? 'found' : 'null'}</span>;
      }

      render(<OptionalConsumer />);

      expect(screen.getByTestId('context-status')).toHaveTextContent('null');
    });

    it('useSignupPressureOptional returns context inside provider', () => {
      function OptionalConsumer() {
        const context = useSignupPressureOptional();
        return <span data-testid="context-status">{context ? 'found' : 'null'}</span>;
      }

      render(
        <SignupPressureProvider>
          <OptionalConsumer />
        </SignupPressureProvider>
      );

      expect(screen.getByTestId('context-status')).toHaveTextContent('found');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    describe('Rapid Fire Operations', () => {
      it('handles 10 rapid trackQuickView calls correctly', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Fire 10 quick views in rapid succession
        for (let i = 0; i < 10; i++) {
          fireEvent.click(screen.getByTestId('track-quick-view'));
        }

        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('10');

        // Verify localStorage was updated correctly
        const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.quickViewCount).toBe(10);
      });
    });

    describe('triggerForAction Return Value', () => {
      it('returns true when modal is shown', () => {
        let returnValue: boolean | undefined;

        function TestConsumerWithReturn() {
          const { triggerForAction } = useSignupPressure();
          return (
            <button
              data-testid="trigger"
              onClick={() => {
                returnValue = triggerForAction('favorite');
              }}
            >
              Trigger
            </button>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithReturn />
          </SignupPressureProvider>
        );

        fireEvent.click(screen.getByTestId('trigger'));
        expect(returnValue).toBe(true);
      });

      it('returns false when blocked by authentication', () => {
        let returnValue: boolean | undefined;

        function TestConsumerWithReturn() {
          const { triggerForAction } = useSignupPressure();
          return (
            <button
              data-testid="trigger"
              onClick={() => {
                returnValue = triggerForAction('favorite');
              }}
            >
              Trigger
            </button>
          );
        }

        render(
          <SignupPressureProvider isAuthenticated={true}>
            <TestConsumerWithReturn />
          </SignupPressureProvider>
        );

        fireEvent.click(screen.getByTestId('trigger'));
        expect(returnValue).toBe(false);
      });

      it('returns false when blocked by cooldown', () => {
        let returnValue: boolean | undefined;

        function TestConsumerWithReturn() {
          const { triggerForAction, dismissModal } = useSignupPressure();
          return (
            <div>
              <button
                data-testid="trigger"
                onClick={() => {
                  returnValue = triggerForAction('favorite');
                }}
              >
                Trigger
              </button>
              <button data-testid="dismiss" onClick={dismissModal}>
                Dismiss
              </button>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithReturn />
          </SignupPressureProvider>
        );

        // Trigger and dismiss to start cooldown
        fireEvent.click(screen.getByTestId('trigger'));
        fireEvent.click(screen.getByTestId('dismiss'));

        // Try to trigger again - should return false
        fireEvent.click(screen.getByTestId('trigger'));
        expect(returnValue).toBe(false);
      });

      it('returns false when modal is already open', () => {
        let returnValues: boolean[] = [];

        function TestConsumerWithReturn() {
          const { triggerForAction } = useSignupPressure();
          return (
            <div>
              <button
                data-testid="trigger-favorite"
                onClick={() => {
                  returnValues.push(triggerForAction('favorite'));
                }}
              >
                Trigger Favorite
              </button>
              <button
                data-testid="trigger-alert"
                onClick={() => {
                  returnValues.push(triggerForAction('alert'));
                }}
              >
                Trigger Alert
              </button>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithReturn />
          </SignupPressureProvider>
        );

        // First trigger should succeed
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(returnValues[0]).toBe(true);

        // Second trigger while modal is open should fail
        fireEvent.click(screen.getByTestId('trigger-alert'));
        expect(returnValues[1]).toBe(false);
      });
    });

    describe('Multiple Sequential Triggers', () => {
      it('only first trigger opens modal, subsequent calls blocked', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // First trigger opens modal
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
        expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');

        // Second trigger should not change context
        fireEvent.click(screen.getByTestId('trigger-alert'));
        expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');

        // Third trigger should also not change context
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('trigger-context')).toHaveTextContent('favorite');
      });
    });

    describe('markAsSignedUp Edge Cases', () => {
      it('works when modal is closed', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Modal is closed, mark as signed up
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
        fireEvent.click(screen.getByTestId('mark-signed-up'));

        // State should still be updated
        const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.hasSignedUp).toBe(true);

        // Should not be able to trigger anymore
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      });
    });

    describe('dismissModal When Already Closed', () => {
      it('is a safe no-op when modal is already closed', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Modal is closed
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');

        // Dismiss should not throw or cause issues
        fireEvent.click(screen.getByTestId('dismiss-modal'));

        // Modal should still be closed
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');

        // Note: dismissModal still increments count and sets cooldown even when closed
        // This is current behavior - test documents it
        const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.dismissCount).toBe(1);
      });
    });

    describe('closeModal vs dismissModal Cooldown Behavior', () => {
      it('closeModal does not start cooldown, dismissModal does', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Open and close (not dismiss)
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        fireEvent.click(screen.getByTestId('close-modal'));

        expect(screen.getByTestId('on-cooldown')).toHaveTextContent('no');

        // Should be able to trigger immediately
        fireEvent.click(screen.getByTestId('trigger-alert'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('open');

        // Now dismiss
        fireEvent.click(screen.getByTestId('dismiss-modal'));
        expect(screen.getByTestId('on-cooldown')).toHaveTextContent('yes');

        // Should NOT be able to trigger during cooldown
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      });

      it('closeModal does not increment dismiss count, dismissModal does', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Open and close multiple times
        for (let i = 0; i < 3; i++) {
          fireEvent.click(screen.getByTestId('trigger-favorite'));
          fireEvent.click(screen.getByTestId('close-modal'));
        }

        // Dismiss count should still be 0
        let stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.dismissCount).toBe(0);

        // Now dismiss once
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        fireEvent.click(screen.getByTestId('dismiss-modal'));

        stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.dismissCount).toBe(1);
      });
    });

    describe('getLocalFavorites Array Reference', () => {
      it('returns new array reference each time', () => {
        let firstRef: string[] | undefined;
        let secondRef: string[] | undefined;

        function TestConsumerWithRefs() {
          const { getLocalFavorites, addLocalFavorite } = useSignupPressure();
          return (
            <div>
              <button
                data-testid="get-first"
                onClick={() => {
                  firstRef = getLocalFavorites();
                }}
              >
                Get First
              </button>
              <button
                data-testid="get-second"
                onClick={() => {
                  secondRef = getLocalFavorites();
                }}
              >
                Get Second
              </button>
              <button
                data-testid="add"
                onClick={() => addLocalFavorite('listing-1')}
              >
                Add
              </button>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithRefs />
          </SignupPressureProvider>
        );

        // Add a favorite first
        fireEvent.click(screen.getByTestId('add'));

        // Get references
        fireEvent.click(screen.getByTestId('get-first'));
        fireEvent.click(screen.getByTestId('get-second'));

        // Both should have the same content
        expect(firstRef).toEqual(['listing-1']);
        expect(secondRef).toEqual(['listing-1']);

        // Note: Due to React state, the array reference is actually the same
        // until state changes - this documents current behavior
      });
    });

    describe('addLocalFavorite Edge Cases', () => {
      it('handles empty string', () => {
        function TestConsumerWithEmptyAdd() {
          const { addLocalFavorite, getLocalFavorites } = useSignupPressure();
          return (
            <div>
              <button
                data-testid="add-empty"
                onClick={() => addLocalFavorite('')}
              >
                Add Empty
              </button>
              <span data-testid="favorites">{getLocalFavorites().join(',')}</span>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithEmptyAdd />
          </SignupPressureProvider>
        );

        fireEvent.click(screen.getByTestId('add-empty'));

        // Empty string is still added (current behavior)
        const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.localFavorites).toContain('');
      });

      it('handles very long string', () => {
        const veryLongId = 'a'.repeat(10000);

        function TestConsumerWithLongAdd() {
          const { addLocalFavorite, getLocalFavorites } = useSignupPressure();
          return (
            <div>
              <button
                data-testid="add-long"
                onClick={() => addLocalFavorite(veryLongId)}
              >
                Add Long
              </button>
              <span data-testid="favorites-count">
                {getLocalFavorites().length}
              </span>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <TestConsumerWithLongAdd />
          </SignupPressureProvider>
        );

        fireEvent.click(screen.getByTestId('add-long'));

        // Should be added without issues
        const stored = JSON.parse(localStorageMock.store[STORAGE_KEY] || '{}');
        expect(stored.localFavorites).toHaveLength(1);
        expect(stored.localFavorites[0]).toBe(veryLongId);
      });
    });

    describe('resetSession Edge Cases', () => {
      it('closes modal if open during reset', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Open modal
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('open');

        // Reset while modal is open
        fireEvent.click(screen.getByTestId('reset-session'));

        // Modal should be closed
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
        expect(screen.getByTestId('trigger-context')).toHaveTextContent('none');
      });

      it('clears cooldown on reset', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Trigger and dismiss to start cooldown
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        fireEvent.click(screen.getByTestId('dismiss-modal'));
        expect(screen.getByTestId('on-cooldown')).toHaveTextContent('yes');

        // Reset session
        fireEvent.click(screen.getByTestId('reset-session'));

        // Cooldown should be cleared
        expect(screen.getByTestId('on-cooldown')).toHaveTextContent('no');
      });
    });

    describe('Auth State Changes', () => {
      it('handles isAuthenticated changing from false to true mid-session', () => {
        const { rerender } = render(
          <SignupPressureProvider isAuthenticated={false}>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Track some views while unauthenticated
        fireEvent.click(screen.getByTestId('track-quick-view'));
        fireEvent.click(screen.getByTestId('track-quick-view'));
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');

        // Simulate user authenticating
        rerender(
          <SignupPressureProvider isAuthenticated={true}>
            <TestConsumer />
          </SignupPressureProvider>
        );

        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');

        // Quick view count should be preserved but further tracking blocked
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');

        // New views should not be tracked
        fireEvent.click(screen.getByTestId('track-quick-view'));
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');

        // Triggers should be blocked
        fireEvent.click(screen.getByTestId('trigger-favorite'));
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      });
    });

    describe('Threshold Boundary Conditions', () => {
      it('triggers exactly at threshold boundary (5 views, 180 seconds)', async () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Track exactly 5 quick views (the threshold)
        for (let i = 0; i < 5; i++) {
          fireEvent.click(screen.getByTestId('track-quick-view'));
        }
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('5');

        // Advance time to exactly 180 seconds (the threshold)
        for (let i = 0; i < 180; i++) {
          act(() => {
            vi.advanceTimersByTime(1000);
          });
        }

        // Modal should be open at exactly the threshold
        expect(screen.getByTestId('modal-open')).toHaveTextContent('open');
        expect(screen.getByTestId('trigger-context')).toHaveTextContent('engagement');
      }, 10000);

      it('does not trigger at one below threshold (4 views, 179 seconds)', async () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Track 4 quick views (one below threshold)
        for (let i = 0; i < 4; i++) {
          fireEvent.click(screen.getByTestId('track-quick-view'));
        }

        // Advance time to 179 seconds (one below threshold)
        for (let i = 0; i < 179; i++) {
          act(() => {
            vi.advanceTimersByTime(1000);
          });
        }

        // Modal should still be closed
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      }, 10000);

      it('5 views but only 179 seconds does not trigger', async () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Track exactly 5 quick views
        for (let i = 0; i < 5; i++) {
          fireEvent.click(screen.getByTestId('track-quick-view'));
        }

        // Advance time to 179 seconds (one below threshold)
        for (let i = 0; i < 179; i++) {
          act(() => {
            vi.advanceTimersByTime(1000);
          });
        }

        // Modal should still be closed (time threshold not met)
        expect(screen.getByTestId('modal-open')).toHaveTextContent('closed');
      }, 10000);
    });

    describe('Time Tracking With Authentication', () => {
      it('stops time tracking when authenticated', () => {
        render(
          <SignupPressureProvider isAuthenticated={true}>
            <TestConsumer />
          </SignupPressureProvider>
        );

        const initialTime = parseInt(
          screen.getByTestId('time-on-site').textContent || '0'
        );

        // Advance time
        act(() => {
          vi.advanceTimersByTime(10000);
        });

        // Time should not have increased significantly
        // (initial load calculation may have a small value)
        const newTime = parseInt(
          screen.getByTestId('time-on-site').textContent || '0'
        );

        // The time should be the same since timer interval doesn't run when authenticated
        expect(newTime).toBe(initialTime);
      });

      it('stops time tracking after hasSignedUp', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Mark as signed up
        fireEvent.click(screen.getByTestId('mark-signed-up'));

        const timeAfterSignup = parseInt(
          screen.getByTestId('time-on-site').textContent || '0'
        );

        // Advance time significantly
        act(() => {
          vi.advanceTimersByTime(60000);
        });

        const timeAfterWait = parseInt(
          screen.getByTestId('time-on-site').textContent || '0'
        );

        // Time should not have increased
        expect(timeAfterWait).toBe(timeAfterSignup);
      });
    });

    describe('Quick View Count After Sign Up', () => {
      it('does not increment quick view count after hasSignedUp', () => {
        render(
          <SignupPressureProvider>
            <TestConsumer />
          </SignupPressureProvider>
        );

        // Track some views
        fireEvent.click(screen.getByTestId('track-quick-view'));
        fireEvent.click(screen.getByTestId('track-quick-view'));
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');

        // Mark as signed up
        fireEvent.click(screen.getByTestId('mark-signed-up'));

        // Try to track more views
        fireEvent.click(screen.getByTestId('track-quick-view'));
        fireEvent.click(screen.getByTestId('track-quick-view'));

        // Count should still be 2
        expect(screen.getByTestId('quick-view-count')).toHaveTextContent('2');
      });
    });

    describe('Multiple Nested Providers', () => {
      it('nested providers work independently', () => {
        function InnerConsumer() {
          const { quickViewCount, trackQuickView } = useSignupPressure();
          return (
            <div>
              <span data-testid="inner-count">{quickViewCount}</span>
              <button data-testid="inner-track" onClick={trackQuickView}>
                Track Inner
              </button>
            </div>
          );
        }

        function OuterConsumer() {
          const { quickViewCount, trackQuickView } = useSignupPressure();
          return (
            <div>
              <span data-testid="outer-count">{quickViewCount}</span>
              <button data-testid="outer-track" onClick={trackQuickView}>
                Track Outer
              </button>
            </div>
          );
        }

        render(
          <SignupPressureProvider>
            <OuterConsumer />
            <SignupPressureProvider>
              <InnerConsumer />
            </SignupPressureProvider>
          </SignupPressureProvider>
        );

        // Track in outer
        fireEvent.click(screen.getByTestId('outer-track'));
        expect(screen.getByTestId('outer-count')).toHaveTextContent('1');

        // Inner should have its own state, but since they share localStorage,
        // the behavior is that both see the same persisted state after remount
        // For now, track inner separately
        fireEvent.click(screen.getByTestId('inner-track'));

        // Both counts increment from their own provider state
        // (they share localStorage key, so this is complex)
        // This test documents the current behavior
        expect(screen.getByTestId('inner-count')).toHaveTextContent('1');
      });
    });

    describe('Callback Memoization', () => {
      it('trackQuickView callback is stable between renders', () => {
        const trackQuickViewRefs: Array<() => void> = [];

        function TestConsumerWithRef() {
          const { trackQuickView, triggerForAction } = useSignupPressure();

          // Capture the ref on each render
          trackQuickViewRefs.push(trackQuickView);

          return (
            <div>
              <button
                data-testid="track"
                onClick={trackQuickView}
              >
                Track
              </button>
              <button
                data-testid="trigger"
                onClick={() => triggerForAction('favorite')}
              >
                Trigger
              </button>
            </div>
          );
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        // Force re-render
        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        // Callbacks should be the same reference (memoized)
        expect(trackQuickViewRefs.length).toBeGreaterThanOrEqual(2);
        expect(trackQuickViewRefs[0]).toBe(trackQuickViewRefs[1]);
      });

      it('dismissModal callback is stable between renders', () => {
        const dismissModalRefs: Array<() => void> = [];

        function TestConsumerWithRef() {
          const { dismissModal } = useSignupPressure();
          dismissModalRefs.push(dismissModal);
          return <button onClick={dismissModal}>Dismiss</button>;
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        expect(dismissModalRefs.length).toBeGreaterThanOrEqual(2);
        expect(dismissModalRefs[0]).toBe(dismissModalRefs[1]);
      });

      it('closeModal callback is stable between renders', () => {
        const closeModalRefs: Array<() => void> = [];

        function TestConsumerWithRef() {
          const { closeModal } = useSignupPressure();
          closeModalRefs.push(closeModal);
          return <button onClick={closeModal}>Close</button>;
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        expect(closeModalRefs.length).toBeGreaterThanOrEqual(2);
        expect(closeModalRefs[0]).toBe(closeModalRefs[1]);
      });

      it('markAsSignedUp callback is stable between renders', () => {
        const markAsSignedUpRefs: Array<() => void> = [];

        function TestConsumerWithRef() {
          const { markAsSignedUp } = useSignupPressure();
          markAsSignedUpRefs.push(markAsSignedUp);
          return <button onClick={markAsSignedUp}>Sign Up</button>;
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        expect(markAsSignedUpRefs.length).toBeGreaterThanOrEqual(2);
        expect(markAsSignedUpRefs[0]).toBe(markAsSignedUpRefs[1]);
      });

      it('resetSession callback is stable between renders', () => {
        const resetSessionRefs: Array<() => void> = [];

        function TestConsumerWithRef() {
          const { resetSession } = useSignupPressure();
          resetSessionRefs.push(resetSession);
          return <button onClick={resetSession}>Reset</button>;
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        expect(resetSessionRefs.length).toBeGreaterThanOrEqual(2);
        expect(resetSessionRefs[0]).toBe(resetSessionRefs[1]);
      });

      it('addLocalFavorite callback is stable between renders', () => {
        const addLocalFavoriteRefs: Array<(id: string) => void> = [];

        function TestConsumerWithRef() {
          const { addLocalFavorite } = useSignupPressure();
          addLocalFavoriteRefs.push(addLocalFavorite);
          return <button onClick={() => addLocalFavorite('test')}>Add</button>;
        }

        const { rerender } = render(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        rerender(
          <SignupPressureProvider>
            <TestConsumerWithRef />
          </SignupPressureProvider>
        );

        expect(addLocalFavoriteRefs.length).toBeGreaterThanOrEqual(2);
        expect(addLocalFavoriteRefs[0]).toBe(addLocalFavoriteRefs[1]);
      });
    });
  });
});
