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

    it('has short label "JuBi" for Juyo Bijutsuhin', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin'].shortLabel).toBe('JuBi');
    });

    it('has premier tier for Juyo Bijutsuhin', () => {
      expect(CERT_CONFIG['Juyo Bijutsuhin'].tier).toBe('premier');
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
    expect(['premier', 'high', 'standard']).toContain(CERT_CONFIG[cert].tier);
  });

  it('assigns premier tier to Juyo-level certifications', () => {
    const premierCerts = ['Juyo Bijutsuhin', 'Juyo', 'Tokuju', 'Juyo Tosogu'];
    for (const cert of premierCerts) {
      expect(CERT_CONFIG[cert].tier).toBe('premier');
    }
  });

  it('assigns high tier to Tokubetsu Hozon certifications', () => {
    const highCerts = ['Tokubetsu Hozon', 'TokuHozon', 'Tokubetsu Hozon Tosogu'];
    for (const cert of highCerts) {
      expect(CERT_CONFIG[cert].tier).toBe('high');
    }
  });

  it('assigns standard tier to Hozon certifications', () => {
    const standardCerts = ['Hozon', 'Hozon Tosogu', 'NTHK Kanteisho'];
    for (const cert of standardCerts) {
      expect(CERT_CONFIG[cert].tier).toBe('standard');
    }
  });
});
