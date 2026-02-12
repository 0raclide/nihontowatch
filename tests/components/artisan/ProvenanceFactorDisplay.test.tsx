import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Supabase before importing modules that depend on it
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

import { ProvenanceFactorDisplay, ProvenancePyramid } from '@/components/artisan/ProvenancePyramid';
import { computeProvenanceAnalysis } from '@/lib/artisan/provenanceMock';
import type { ProvenanceAnalysis } from '@/lib/artisan/provenanceMock';

// ─── TEST DATA FACTORIES ────────────────────────────────────────────────────

type DenraiGroupInput = Array<{
  parent: string;
  totalCount: number;
  children: Array<{ owner: string; count: number }>;
  isGroup: boolean;
}>;

function flat(entries: Array<[string, number]>): DenraiGroupInput {
  return entries.map(([owner, count]) => ({
    parent: owner,
    totalCount: count,
    children: [{ owner, count }],
    isGroup: false,
  }));
}

function makeAnalysis(overrides: Partial<ProvenanceAnalysis> = {}): ProvenanceAnalysis {
  // Default: a modest artisan with some daimyō provenance
  const base = computeProvenanceAnalysis([
    ...flat([['Tokugawa Family', 5]]),
    ...flat([['Maeda Family', 3]]),
    ...flat([['Random Person', 10]]),
  ])!;
  return { ...base, ...overrides };
}

// ─── ProvenanceFactorDisplay ────────────────────────────────────────────────

describe('ProvenanceFactorDisplay', () => {
  describe('rendering basics', () => {
    it('renders without crashing', () => {
      const analysis = makeAnalysis();
      const { container } = render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );
      expect(container.innerHTML).not.toBe('');
    });

    it('shows the raw score', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );
      // Score should be displayed somewhere
      expect(screen.getByText(/\/ 10/)).toBeTruthy();
    });

    it('shows scored works count', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );
      // "N works held in elite collections"
      expect(screen.getByText(/work/)).toBeTruthy();
    });

    it('shows "smiths" for smith entityType', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );
      expect(screen.getByText(/smiths/)).toBeTruthy();
    });

    it('shows "tosogu makers" for tosogu entityType', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="tosogu" />
      );
      expect(screen.getByText(/tosogu makers/)).toBeTruthy();
    });
  });

  describe('real vs mock percentile', () => {
    it('uses DB percentile when provided', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          percentile={92}
        />
      );
      // Top 8% (100 - 92)
      expect(screen.getByText(/Top/)).toBeTruthy();
      expect(screen.getByText(/8%/)).toBeTruthy();
    });

    it('uses estimated percentile when DB value is null', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          percentile={null}
        />
      );
      // Should still show "Top X%"
      expect(screen.getByText(/Top/)).toBeTruthy();
    });

    it('uses estimated percentile when percentile prop is omitted', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
        />
      );
      expect(screen.getByText(/Top/)).toBeTruthy();
    });

    it('uses DB factor when provided', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          dbFactor={7.25}
        />
      );
      expect(screen.getByText(/7\.25/)).toBeTruthy();
    });

    it('uses mock factor when dbFactor is null', () => {
      const analysis = makeAnalysis({ factor: 3.14 });
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          dbFactor={null}
        />
      );
      expect(screen.getByText(/3\.14/)).toBeTruthy();
    });
  });

  describe('info panel toggle', () => {
    it('shows explanation when info button is clicked', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );

      // Initially no explanation visible
      expect(screen.queryByText(/Provenance Standing measures/)).toBeNull();

      // Click info button
      const infoButton = screen.getByRole('button', { name: /How is Provenance Standing calculated/ });
      fireEvent.click(infoButton);

      // Explanation should now be visible
      expect(screen.getByText(/Provenance Standing measures/)).toBeTruthy();
    });

    it('hides explanation on second click', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );

      const infoButton = screen.getByRole('button', { name: /How is Provenance Standing calculated/ });
      fireEvent.click(infoButton);
      expect(screen.getByText(/Provenance Standing measures/)).toBeTruthy();

      fireEvent.click(infoButton);
      expect(screen.queryByText(/Provenance Standing measures/)).toBeNull();
    });

    it('explanation mentions "every provenance observation" (V4 language)', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay analysis={analysis} entityType="smith" />
      );

      const infoButton = screen.getByRole('button', { name: /How is Provenance Standing calculated/ });
      fireEvent.click(infoButton);

      // V4 explanation should NOT say "Only these top three tiers"
      expect(screen.queryByText(/Only these top three tiers/)).toBeNull();
      // V4 explanation SHOULD mention "every provenance observation"
      expect(screen.getByText(/Every provenance observation/)).toBeTruthy();
    });
  });

  describe('percentile edge cases', () => {
    it('percentile of 100 shows "Top 1%" (clamped)', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          percentile={100}
        />
      );
      // Math.max(100 - 100, 1) = 1
      expect(screen.getByText(/1%/)).toBeTruthy();
    });

    it('percentile of 0 shows "Top 100%"', () => {
      const analysis = makeAnalysis();
      render(
        <ProvenanceFactorDisplay
          analysis={analysis}
          entityType="smith"
          percentile={0}
        />
      );
      expect(screen.getByText(/100%/)).toBeTruthy();
    });
  });
});

// ─── ProvenancePyramid ──────────────────────────────────────────────────────

describe('ProvenancePyramid', () => {
  it('renders all 8 tier labels', () => {
    const analysis = makeAnalysis();
    render(<ProvenancePyramid analysis={analysis} />);

    expect(screen.getByText('Imperial')).toBeTruthy();
    expect(screen.getByText('Shogunal')).toBeTruthy();
    expect(screen.getByText(/Premier/)).toBeTruthy();
    expect(screen.getByText(/Major/)).toBeTruthy();
    expect(screen.getByText(/Other/)).toBeTruthy();
    expect(screen.getByText('Zaibatsu')).toBeTruthy();
    expect(screen.getByText('Institutions')).toBeTruthy();
    expect(screen.getByText('Named Collectors')).toBeTruthy();
  });

  it('shows counts for active tiers and dashes for empty tiers', () => {
    // Single-tier data
    const data = flat([['Tokugawa Family', 5]]);
    const analysis = computeProvenanceAnalysis(data)!;
    render(<ProvenancePyramid analysis={analysis} />);

    // Shogunal should show "5"
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('expands tier to show collectors on click', () => {
    const data = flat([['Maeda Family', 3]]);
    const analysis = computeProvenanceAnalysis(data)!;
    render(<ProvenancePyramid analysis={analysis} />);

    // Click on the Premier Daimyō tier
    const premierButton = screen.getByText(/Premier/).closest('button')!;
    fireEvent.click(premierButton);

    // Should show the collector name
    expect(screen.getByText('Maeda Family')).toBeTruthy();
  });
});
