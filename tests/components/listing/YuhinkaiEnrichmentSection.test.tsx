import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YuhinkaiEnrichmentSection } from '@/components/listing/YuhinkaiEnrichmentSection';
import type { ListingWithEnrichment, YuhinkaiEnrichment } from '@/types';

// Mock hasVerifiedEnrichment to control test behavior
vi.mock('@/types', async () => {
  const actual = await vi.importActual('@/types');
  return {
    ...actual,
    hasVerifiedEnrichment: vi.fn(),
  };
});

import { hasVerifiedEnrichment } from '@/types';
const mockHasVerifiedEnrichment = vi.mocked(hasVerifiedEnrichment);

// Helper to create mock listing with enrichment
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
      match_score: 0.95,
      match_confidence: 'DEFINITIVE',
      match_signals: null,
      matched_fields: null,
      enriched_maker: null,
      enriched_maker_kanji: null,
      enriched_school: null,
      enriched_period: null,
      enriched_form_type: null,
      setsumei_ja: null,
      setsumei_en: null,
      setsumei_en_format: null,
      enriched_cert_type: null,
      enriched_cert_session: null,
      item_category: 'blade',
      verification_status: 'confirmed',
      connection_source: 'manual',
      enriched_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...enrichment,
    } : null,
  } as ListingWithEnrichment;
}

describe('YuhinkaiEnrichmentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('render conditions', () => {
    it('renders nothing when hasVerifiedEnrichment returns false', () => {
      mockHasVerifiedEnrichment.mockReturnValue(false);
      const listing = createListing({
        setsumei_en: 'Some translation',
      });

      const { container } = render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when no enrichment data', () => {
      mockHasVerifiedEnrichment.mockReturnValue(false);
      const listing = createListing(null);

      const { container } = render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when enrichment has no setsumei and no metadata', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: null,
        enriched_maker: null,
        enriched_school: null,
      });

      const { container } = render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('full setsumei display', () => {
    it('displays "Official Catalog Translation" header when setsumei_en present', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: '## Test Translation\n\nThis is a test.',
        setsumei_en_format: 'markdown',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Official Catalog Translation')).toBeInTheDocument();
    });

    it('displays cert type badge when present', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test translation',
        enriched_cert_type: 'Juyo',
        enriched_cert_session: 68,
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Juyo #68')).toBeInTheDocument();
    });

    it('displays enriched metadata (artisan, school, period)', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test translation',
        enriched_maker: 'Masamune',
        enriched_school: 'Soshu',
        enriched_period: 'Kamakura',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Masamune')).toBeInTheDocument();
      expect(screen.getByText('Soshu')).toBeInTheDocument();
      expect(screen.getByText('Kamakura')).toBeInTheDocument();
    });

    it('displays source info with collection', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test translation',
        yuhinkai_collection: 'Tokuju',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText(/Source: Yuhinkai Catalog/)).toBeInTheDocument();
      expect(screen.getByText(/Tokuju/)).toBeInTheDocument();
    });

    it('displays match score percentage', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test translation',
        match_score: 0.95,
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Match: 95%')).toBeInTheDocument();
    });
  });

  describe('metadata-only display (no setsumei)', () => {
    it('displays "Catalog Data" header when only metadata available', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: null,
        enriched_maker: 'Masamune',
        enriched_school: 'Soshu',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Catalog Data')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('displays artisan in metadata-only mode', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: null,
        enriched_maker: 'Sadamune',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Sadamune')).toBeInTheDocument();
    });

    it('displays school in metadata-only mode', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: null,
        enriched_school: 'Soshu',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Soshu')).toBeInTheDocument();
    });
  });

  describe('preview mode (truncation)', () => {
    it('truncates long content in preview mode', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const longText = 'A'.repeat(500);
      const listing = createListing({
        setsumei_en: longText,
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="preview" previewLength={100} />);

      // Content should be truncated
      const content = screen.getByText(/^A+/);
      expect(content.textContent!.length).toBeLessThan(500);
    });

    it('shows "Read full translation" button when truncated', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const longText = 'A'.repeat(500);
      const listing = createListing({
        setsumei_en: longText,
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="preview" previewLength={100} />);
      expect(screen.getByText('Read full translation')).toBeInTheDocument();
    });

    it('expands content when "Read full translation" clicked', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const longText = 'A'.repeat(500);
      const listing = createListing({
        setsumei_en: longText,
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="preview" previewLength={100} />);

      const expandButton = screen.getByText('Read full translation');
      fireEvent.click(expandButton);

      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('does not show expand button for short content', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Short text',
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="preview" previewLength={100} />);
      expect(screen.queryByText('Read full translation')).not.toBeInTheDocument();
    });
  });

  describe('full mode', () => {
    it('shows "Show original" button when Japanese setsumei available', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'English translation',
        setsumei_ja: '日本語の説明',
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="full" />);
      expect(screen.getByText('Show original')).toBeInTheDocument();
    });

    it('toggles between English and Japanese', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'English translation',
        setsumei_ja: '日本語の説明',
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="full" />);

      // Initially shows English
      expect(screen.getByText('English translation')).toBeInTheDocument();

      // Click to show original
      fireEvent.click(screen.getByText('Show original'));
      expect(screen.getByText('日本語の説明')).toBeInTheDocument();
      expect(screen.getByText('Show translation')).toBeInTheDocument();
    });

    it('does not show toggle when no Japanese available', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'English only',
        setsumei_ja: null,
      });

      render(<YuhinkaiEnrichmentSection listing={listing} variant="full" />);
      expect(screen.queryByText('Show original')).not.toBeInTheDocument();
    });
  });

  describe('markdown rendering', () => {
    it('renders markdown content when format is markdown', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: '**Bold text** and *italic*',
        setsumei_en_format: 'markdown',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);

      // ReactMarkdown should render bold and italic
      expect(screen.getByText('Bold text')).toBeInTheDocument();
    });

    it('renders plain text when format is not markdown', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Plain text content',
        setsumei_en_format: 'plain',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);
      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test',
      });

      const { container } = render(
        <YuhinkaiEnrichmentSection listing={listing} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('uses gold theme colors', () => {
      mockHasVerifiedEnrichment.mockReturnValue(true);
      const listing = createListing({
        setsumei_en: 'Test',
      });

      render(<YuhinkaiEnrichmentSection listing={listing} />);

      // Header should have gold color
      const header = screen.getByText('Official Catalog Translation');
      expect(header).toHaveClass('text-gold');
    });
  });
});
