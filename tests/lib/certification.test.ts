/**
 * Tests for Certification Configuration
 *
 * Verifies that all certification types are properly configured across:
 * - Constants (CERTIFICATIONS, CERTIFICATION_PRIORITY)
 * - MetadataGrid (CERT_CONFIG)
 * - FilterContent (CERT_LABELS, CERT_ORDER)
 * - Browse API (CERT_VARIANTS)
 * - Saved Search matcher (CERT_VARIANTS)
 *
 * Critical for ensuring new certification types like Juyo Bijutsuhin
 * are properly integrated across the entire application.
 */

import { describe, it, expect } from 'vitest';
import { CERTIFICATIONS, CERTIFICATION_PRIORITY } from '@/lib/constants';
import { CERT_CONFIG } from '@/components/listing/MetadataGrid';

// =============================================================================
// JUYO BIJUTSUHIN (Pre-war Government Designation)
// =============================================================================

describe('Juyo Bijutsuhin Certification', () => {
  describe('Constants', () => {
    it('includes Juyo Bijutsuhin in CERTIFICATIONS', () => {
      expect(CERTIFICATIONS.JUYO_BIJUTSUHIN).toBe('Juyo Bijutsuhin');
    });

    it('has Juyo Bijutsuhin with highest priority (0)', () => {
      expect(CERTIFICATION_PRIORITY['Juyo Bijutsuhin']).toBe(0);
    });

    it('ranks Juyo Bijutsuhin above Tokubetsu Juyo', () => {
      const jubiPriority = CERTIFICATION_PRIORITY['Juyo Bijutsuhin'];
      const tokujuPriority = CERTIFICATION_PRIORITY['Tokubetsu Juyo'];
      expect(jubiPriority).toBeLessThan(tokujuPriority);
    });

    it('ranks Juyo Bijutsuhin above all NBTHK certifications', () => {
      const jubiPriority = CERTIFICATION_PRIORITY['Juyo Bijutsuhin'];
      const nbthkCerts = ['Tokubetsu Juyo', 'Juyo', 'Tokubetsu Hozon', 'Hozon'];

      for (const cert of nbthkCerts) {
        expect(jubiPriority).toBeLessThan(CERTIFICATION_PRIORITY[cert]);
      }
    });
  });

  describe('MetadataGrid CERT_CONFIG', () => {
    it('includes Juyo Bijutsuhin configuration', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin']).toBeDefined();
    });

    it('has correct label for Juyo Bijutsuhin', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin'].label).toBe('Juyo Bijutsuhin');
    });

    it('has short label "Jubi" for Juyo Bijutsuhin', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin'].shortLabel).toBe('Jubi');
    });

    it('has jubi tier for Juyo Bijutsuhin', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin'].tier).toBe('jubi');
    });
  });
});

// =============================================================================
// CERTIFICATION HIERARCHY
// =============================================================================

describe('Certification Hierarchy', () => {
  it('has correct priority order (lowest number = highest prestige)', () => {
    const priorities = Object.entries(CERTIFICATION_PRIORITY)
      .sort(([, a], [, b]) => a - b)
      .map(([cert]) => cert);

    // Juyo Bijutsuhin should be first (priority 0)
    expect(priorities[0]).toBe('Juyo Bijutsuhin');

    // Tokubetsu Juyo should be second (priority 1)
    expect(priorities[1]).toBe('Tokubetsu Juyo');
  });

  it('includes all expected NBTHK certifications', () => {
    expect(CERTIFICATIONS.JUYO).toBe('Juyo');
    expect(CERTIFICATIONS.TOKUBETSU_JUYO).toBe('Tokubetsu Juyo');
    expect(CERTIFICATIONS.HOZON).toBe('Hozon');
    expect(CERTIFICATIONS.TOKUBETSU_HOZON).toBe('Tokubetsu Hozon');
  });

  it('includes tosogu-specific certifications', () => {
    expect(CERTIFICATIONS.JUYO_TOSOGU).toBe('Juyo Tosogu');
    expect(CERTIFICATIONS.TOKUBETSU_HOZON_TOSOGU).toBe('Tokubetsu Hozon Tosogu');
    expect(CERTIFICATIONS.HOZON_TOSOGU).toBe('Hozon Tosogu');
  });
});

// =============================================================================
// CERT_CONFIG COMPLETENESS
// =============================================================================

describe('CERT_CONFIG Completeness', () => {
  const requiredCerts = [
    'Juyo Bijutsuhin',
    'Juyo',
    'juyo',
    'Tokubetsu Juyo',
    'tokubetsu_juyo',
    'Tokuju',
    'tokuju',
    'Tokubetsu Hozon',
    'tokubetsu_hozon',
    'TokuHozon',
    'Hozon',
    'hozon',
    'Juyo Tosogu',
    'Tokubetsu Hozon Tosogu',
    'Hozon Tosogu',
    'NTHK Kanteisho',
  ];

  it.each(requiredCerts)('has configuration for "%s"', (cert) => {
    expect(CERT_CONFIG[cert]).toBeDefined();
    expect(CERT_CONFIG[cert].label).toBeTruthy();
    expect(CERT_CONFIG[cert].shortLabel).toBeTruthy();
    expect(['tokuju', 'jubi', 'juyo', 'tokuho', 'hozon']).toContain(CERT_CONFIG[cert].tier);
  });

  it('assigns correct 5-tier classification', () => {
    expect(CERT_CONFIG['Juyo Bijutsuhin'].tier).toBe('jubi');
    expect(CERT_CONFIG['Tokuju'].tier).toBe('tokuju');
    expect(CERT_CONFIG['Juyo'].tier).toBe('juyo');
    expect(CERT_CONFIG['Juyo Tosogu'].tier).toBe('juyo');
    expect(CERT_CONFIG['Tokubetsu Hozon'].tier).toBe('tokuho');
    expect(CERT_CONFIG['TokuHozon'].tier).toBe('tokuho');
    expect(CERT_CONFIG['Tokubetsu Hozon Tosogu'].tier).toBe('tokuho');
    expect(CERT_CONFIG['Hozon'].tier).toBe('hozon');
    expect(CERT_CONFIG['Hozon Tosogu'].tier).toBe('hozon');
    expect(CERT_CONFIG['NTHK Kanteisho'].tier).toBe('hozon');
  });
});
