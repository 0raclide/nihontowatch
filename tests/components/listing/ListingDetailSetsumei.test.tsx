/**
 * Listing Detail Setsumei Integration Tests
 *
 * CRITICAL REGRESSION TESTS:
 * - SetsumeiZufuBadge must appear when setsumei_text_en is present
 * - SetsumeiSection must always render (not conditional on Yuhinkai)
 * - No references to CatalogEnrichedBadge or YuhinkaiEnrichmentSection
 *
 * These tests prevent reverting to the old Yuhinkai-based system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '123' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock auth context
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

// Mock alerts hook
vi.mock('@/hooks/useAlerts', () => ({
  useAlerts: () => ({
    createAlert: vi.fn(),
    isCreating: false,
  }),
}));

// Mock image validation hook
vi.mock('@/hooks/useValidatedImages', () => ({
  useValidatedImages: (images: string[]) => ({
    validatedImages: images,
    isValidating: false,
  }),
}));

// Check that the code imports are correct
describe('ListingDetailClient Import Checks', () => {
  it('should NOT import CatalogEnrichedBadge', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('CatalogEnrichedBadge');
    expect(content).not.toContain('CatalogEnrichedIndicator');
  });

  it('should NOT import YuhinkaiEnrichmentSection', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('YuhinkaiEnrichmentSection');
    expect(content).not.toContain('hasVerifiedEnrichment');
  });

  it('should import SetsumeiZufuBadge', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('SetsumeiZufuBadge');
  });

  it('should import SetsumeiSection', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('SetsumeiSection');
  });
});

describe('ListingDetailClient Setsumei Logic', () => {
  it('should show SetsumeiZufuBadge based on setsumei_text_en, not yuhinkai_enrichment', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Badge should be conditional on setsumei_text_en
    expect(content).toContain('listing.setsumei_text_en');
    expect(content).toContain('<SetsumeiZufuBadge');

    // Badge should NOT be conditional on yuhinkai_enrichment
    expect(content).not.toMatch(/listing\.yuhinkai_enrichment\s*&&\s*\(\s*<.*Badge/);
  });

  it('should render SetsumeiSection unconditionally (not wrapped in Yuhinkai check)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // SetsumeiSection should NOT be conditional on !hasVerifiedEnrichment
    expect(content).not.toContain('!hasVerifiedEnrichment');

    // SetsumeiSection should exist in the file
    expect(content).toContain('<SetsumeiSection');
  });

  it('should NOT reference enrichment-based artisan/school indicators', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/listing/[id]/ListingDetailClient.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Should not have isArtisanEnriched or isSchoolEnriched
    expect(content).not.toContain('isArtisanEnriched');
    expect(content).not.toContain('isSchoolEnriched');
    expect(content).not.toContain('enrichment.enriched_maker');
    expect(content).not.toContain('enrichment.enriched_school');
  });
});

describe('Browse API Setsumei Filter Verification', () => {
  it('should filter on setsumei_text_en, not listing_yuhinkai_enrichment', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src/app/api/browse/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Should use setsumei_text_en filter
    expect(content).toContain("query.not('setsumei_text_en', 'is', null)");

    // Should NOT query listing_yuhinkai_enrichment for enriched filter
    expect(content).not.toContain("from('listing_yuhinkai_enrichment')");
  });
});
