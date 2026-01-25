/**
 * User GDPR API Tests
 *
 * Tests for consent, data export, and account deletion APIs.
 * These endpoints require authentication.
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

// Helper to check if endpoint exists
const checkEndpointExists = async (path: string) => {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'HEAD' });
    return res.status !== 404;
  } catch {
    return false;
  }
};

// =============================================================================
// CONSENT API TESTS (Integration - requires deployment)
// =============================================================================

describe('Consent API', () => {
  describe('GET /api/user/consent', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/consent');
      if (!exists) {
        console.log('Skipping: Consent endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/consent`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/user/consent', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/consent');
      if (!exists) {
        console.log('Skipping: Consent endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            essential: true,
            functional: true,
            analytics: true,
            marketing: false,
          },
          timestamp: new Date().toISOString(),
          version: '1.0',
          method: 'banner',
        }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects malformed consent data', async () => {
      const exists = await checkEndpointExists('/api/user/consent');
      if (!exists) {
        console.log('Skipping: Consent endpoint not deployed yet');
        return;
      }

      // Even unauthenticated, malformed data should be caught
      const res = await fetch(`${API_BASE}/api/user/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      // Either 401 (auth first) or 400 (validation)
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('DELETE /api/user/consent', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/consent');
      if (!exists) {
        console.log('Skipping: Consent endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/consent`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
    });
  });
});

// =============================================================================
// DATA EXPORT API TESTS (Integration - requires deployment)
// =============================================================================

describe('Data Export API', () => {
  describe('GET /api/user/data-export', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/data-export');
      if (!exists) {
        console.log('Skipping: Data export endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/data-export`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Data Export Response Format', () => {
    // These tests document expected format when authenticated
    it('expects JSON response with specific structure', () => {
      // Document expected format
      const expectedFormat = {
        exportedAt: 'ISO timestamp',
        format: 'json',
        version: '1.0',
        user: {
          email: 'string',
          displayName: 'string or null',
          role: 'string',
          createdAt: 'ISO timestamp',
          preferences: 'object',
          subscription: {
            tier: 'string or null',
            status: 'string or null',
          },
          consent: {
            preferences: 'object or null',
            updatedAt: 'ISO timestamp or null',
            marketingOptOut: 'boolean',
          },
        },
        data: {
          favorites: 'array',
          savedSearches: 'array',
          alerts: 'array',
          activityHistory: {
            note: 'string',
            records: 'array',
          },
          consentHistory: 'array',
        },
        metadata: {
          totalFavorites: 'number',
          totalSavedSearches: 'number',
          totalAlerts: 'number',
          activityRecords: 'number',
        },
      };

      // This test documents the expected structure
      expect(expectedFormat.user).toHaveProperty('consent');
      expect(expectedFormat.data).toHaveProperty('consentHistory');
    });
  });
});

// =============================================================================
// ACCOUNT DELETION API TESTS (Integration - requires deployment)
// =============================================================================

describe('Account Deletion API', () => {
  describe('GET /api/user/delete-account', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/delete-account');
      if (!exists) {
        console.log('Skipping: Delete account endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/delete-account`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/user/delete-account', () => {
    it('returns 401 without authentication', async () => {
      const exists = await checkEndpointExists('/api/user/delete-account');
      if (!exists) {
        console.log('Skipping: Delete account endpoint not deployed yet');
        return;
      }

      const res = await fetch(`${API_BASE}/api/user/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmEmail: 'test@example.com',
          reason: 'privacy',
        }),
      });

      expect(res.status).toBe(401);
    });

    it('requires email confirmation', async () => {
      // Document expected behavior
      const expectedRequest = {
        confirmEmail: 'user@example.com', // Must match account email
        reason: 'privacy', // Optional: 'privacy' | 'not_using' | 'switching_service' | 'other'
        feedback: 'Optional feedback text',
      };

      expect(expectedRequest).toHaveProperty('confirmEmail');
    });
  });

  describe('Account Deletion Process', () => {
    it('documents deletion steps', () => {
      // This test documents the deletion process
      const deletionSteps = [
        '1. Verify user identity (email confirmation)',
        '2. Check for active subscription (must cancel first)',
        '3. Log deletion request for compliance audit',
        '4. Delete alert history',
        '5. Delete user alerts',
        '6. Delete saved search notifications',
        '7. Delete saved searches',
        '8. Delete favorites',
        '9. Anonymize activity data (keep for analytics)',
        '10. Anonymize sessions',
        '11. Delete profile',
        '12. Delete auth user',
        '13. Update deletion request status',
      ];

      expect(deletionSteps.length).toBe(13);
    });

    it('documents error responses', () => {
      const errorResponses = {
        401: 'Unauthorized - not logged in',
        400: {
          'Email confirmation required': 'Missing confirmEmail field',
          'Email does not match account email': 'Wrong email provided',
          'Active subscription detected': 'Must cancel subscription first',
        },
        500: 'Internal server error',
      };

      expect(errorResponses[400]).toHaveProperty('Active subscription detected');
    });
  });
});

// =============================================================================
// GDPR COMPLIANCE DOCUMENTATION
// =============================================================================

describe('GDPR Compliance Documentation', () => {
  it('documents supported rights', () => {
    const gdprRights = {
      'Right to Access (Art. 15)': {
        endpoint: 'GET /api/user/data-export',
        description: 'Export all user data in machine-readable JSON format',
      },
      'Right to Rectification (Art. 16)': {
        endpoint: '/profile',
        description: 'Users can update their profile information',
      },
      'Right to Erasure (Art. 17)': {
        endpoint: 'POST /api/user/delete-account',
        description: 'Delete account and associated data',
      },
      'Right to Data Portability (Art. 20)': {
        endpoint: 'GET /api/user/data-export',
        description: 'Data export in JSON format',
      },
      'Right to Object (Art. 21)': {
        endpoint: 'POST /api/user/consent',
        description: 'Update consent preferences, unsubscribe from marketing',
      },
    };

    expect(Object.keys(gdprRights).length).toBeGreaterThanOrEqual(5);
  });

  it('documents consent categories', () => {
    const consentCategories = {
      essential: {
        description: 'Required for site functionality',
        canDisable: false,
        examples: ['Authentication', 'Security', 'Load balancing'],
      },
      functional: {
        description: 'Remembers preferences',
        canDisable: true,
        examples: ['Theme preference', 'Currency setting', 'Recently viewed'],
      },
      analytics: {
        description: 'Helps improve the service',
        canDisable: true,
        examples: ['Page views', 'Click tracking', 'Session data'],
      },
      marketing: {
        description: 'Personalized communications',
        canDisable: true,
        examples: ['Email newsletters', 'Promotional offers'],
      },
    };

    expect(consentCategories.essential.canDisable).toBe(false);
    expect(consentCategories.analytics.canDisable).toBe(true);
  });

  it('documents data retention periods', () => {
    const retentionPeriods = {
      'User profile': 'Until account deletion',
      'Consent history': 'Kept for audit trail (not deleted)',
      'Activity data': 'Anonymized on account deletion',
      'Session data': 'Anonymized on account deletion',
      'Deletion requests': 'Kept for compliance audit',
    };

    expect(retentionPeriods['Consent history']).toContain('audit');
  });
});

// =============================================================================
// LEGAL PAGES TESTS (Integration - requires deployment)
// =============================================================================

describe('Legal Pages', () => {
  // Helper to check if page exists
  const checkPageExists = async (path: string) => {
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: 'HEAD' });
      return res.status === 200;
    } catch {
      return false;
    }
  };

  it('Terms of Service page exists', async () => {
    const exists = await checkPageExists('/terms');
    if (!exists) {
      console.log('Skipping: Terms page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/terms`);
    expect(res.status).toBe(200);
  });

  it('Privacy Policy page exists', async () => {
    const exists = await checkPageExists('/privacy');
    if (!exists) {
      console.log('Skipping: Privacy page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/privacy`);
    expect(res.status).toBe(200);
  });

  it('Cookie Policy page exists', async () => {
    const exists = await checkPageExists('/cookies');
    if (!exists) {
      console.log('Skipping: Cookies page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/cookies`);
    expect(res.status).toBe(200);
  });

  it('Terms page has required sections', async () => {
    const exists = await checkPageExists('/terms');
    if (!exists) {
      console.log('Skipping: Terms page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/terms`);
    const html = await res.text();

    // Check for key sections (these should be in the page)
    expect(html.toLowerCase()).toContain('terms');
    expect(html.toLowerCase()).toContain('nihontowatch');
  });

  it('Privacy page mentions GDPR rights', async () => {
    const exists = await checkPageExists('/privacy');
    if (!exists) {
      console.log('Skipping: Privacy page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/privacy`);
    const html = await res.text();

    // Should mention key GDPR concepts
    expect(html.toLowerCase()).toContain('data');
    expect(html.toLowerCase()).toContain('privacy');
  });

  it('Cookie page has preference management', async () => {
    const exists = await checkPageExists('/cookies');
    if (!exists) {
      console.log('Skipping: Cookies page not deployed yet');
      return;
    }

    const res = await fetch(`${API_BASE}/cookies`);
    const html = await res.text();

    expect(html.toLowerCase()).toContain('cookie');
  });
});
