import { describe, it, expect } from 'vitest';
import { hasVerifiedEnrichment, type ListingWithEnrichment, type YuhinkaiEnrichment } from '@/types';

/**
 * Tests for hasVerifiedEnrichment function
 *
 * This function determines whether to display Yuhinkai enrichment data.
 * Currently, only MANUAL connections are displayed (auto-matcher disabled).
 */

// Helper to create a mock listing with enrichment
function createListing(enrichment: Partial<YuhinkaiEnrichment> | null): ListingWithEnrichment {
  return {
    id: 1,
    url: 'https://example.com/listing/1',
    title: 'Test Listing',
    item_type: 'katana',
    yuhinkai_enrichment: enrichment ? {
      enrichment_id: 1,
      listing_id: 1,
      yuhinkai_uuid: 'test-uuid',
      yuhinkai_collection: 'Juyo',
      yuhinkai_volume: 68,
      yuhinkai_item_number: 1,
      match_score: 1.0,
      match_confidence: 'DEFINITIVE',
      match_signals: null,
      matched_fields: null,
      enriched_maker: 'Test Maker',
      enriched_maker_kanji: null,
      enriched_school: 'Test School',
      enriched_period: null,
      enriched_form_type: null,
      setsumei_ja: null,
      setsumei_en: null,
      setsumei_en_format: null,
      enriched_cert_type: 'Juyo',
      enriched_cert_session: 68,
      item_category: 'blade',
      verification_status: 'auto',
      connection_source: 'auto',
      enriched_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...enrichment,
    } : null,
  } as ListingWithEnrichment;
}

describe('hasVerifiedEnrichment', () => {
  describe('no enrichment', () => {
    it('returns false when enrichment is null', () => {
      const listing = createListing(null);
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false when enrichment is undefined', () => {
      const listing = { id: 1 } as ListingWithEnrichment;
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });

  describe('manual connections', () => {
    it('returns true for manual connection with confirmed status', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(true);
    });

    it('returns false for manual connection with auto status', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for manual connection with pending status', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'pending',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for manual connection without DEFINITIVE confidence', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'HIGH',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });

  describe('auto connections (should be hidden)', () => {
    it('returns false for auto connection with auto status', () => {
      const listing = createListing({
        connection_source: 'auto',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for auto connection with confirmed status', () => {
      const listing = createListing({
        connection_source: 'auto',
        verification_status: 'confirmed',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for null connection_source (treated as auto)', () => {
      const listing = createListing({
        connection_source: null as unknown as 'auto',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for undefined connection_source (treated as auto)', () => {
      const listing = createListing({
        connection_source: undefined as unknown as 'auto',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });

  describe('match confidence', () => {
    it('returns false for HIGH confidence', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'HIGH',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for MEDIUM confidence', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'MEDIUM',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for LOW confidence', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'LOW',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for empty confidence', () => {
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: '',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('returns true for typical manual admin connection', () => {
      // This is what a manual connection looks like after admin connects
      const listing = createListing({
        connection_source: 'manual',
        verification_status: 'confirmed',
        match_confidence: 'DEFINITIVE',
        match_score: 1.0,
        setsumei_en: '## Juyo Token, 68th Session...',
        enriched_maker: 'Masamune',
        enriched_school: 'Soshu',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(true);
    });

    it('returns false for SOTA auto-matcher false positive', () => {
      // This is what listing 6758 looked like - auto-matched incorrectly
      const listing = createListing({
        connection_source: 'auto',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
        match_score: 0,
        setsumei_en: null,
        enriched_maker: 'Yukimitsu',
        enriched_school: 'Soshu',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('returns false for auto-match with high match score', () => {
      // Even high-score auto matches should be hidden
      const listing = createListing({
        connection_source: 'auto',
        verification_status: 'auto',
        match_confidence: 'DEFINITIVE',
        match_score: 0.95,
        setsumei_en: 'Some translation...',
      });
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });

  describe('type safety', () => {
    it('handles listing without yuhinkai_enrichment property', () => {
      const listing = { id: 1, url: 'test', title: 'Test' } as ListingWithEnrichment;
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });

    it('handles enrichment with missing properties', () => {
      const listing = {
        id: 1,
        yuhinkai_enrichment: {
          match_confidence: 'DEFINITIVE',
          // Missing connection_source and verification_status
        },
      } as ListingWithEnrichment;
      expect(hasVerifiedEnrichment(listing)).toBe(false);
    });
  });
});

describe('SHOW_AUTO_MATCHED_ENRICHMENTS flag behavior', () => {
  /**
   * Note: The flag is currently hardcoded to false in hasVerifiedEnrichment.
   * These tests document the expected behavior when the flag is disabled.
   *
   * When enabling auto-matches in the future, update:
   * - src/lib/constants.ts: SHOW_AUTO_MATCHED_ENRICHMENTS = true
   * - src/types/index.ts: const SHOW_AUTO_MATCHED_ENRICHMENTS = true
   *
   * Then these tests should be updated to expect true for auto connections.
   */

  it('currently hides all auto connections (flag is false)', () => {
    const autoListing = createListing({
      connection_source: 'auto',
      verification_status: 'auto',
      match_confidence: 'DEFINITIVE',
    });
    expect(hasVerifiedEnrichment(autoListing)).toBe(false);
  });

  it('currently shows manual connections (flag does not affect them)', () => {
    const manualListing = createListing({
      connection_source: 'manual',
      verification_status: 'confirmed',
      match_confidence: 'DEFINITIVE',
    });
    expect(hasVerifiedEnrichment(manualListing)).toBe(true);
  });
});
