/**
 * Distill an ArtisanPageResponse into a compact ArtistOverview
 * suitable for enriching the AI curator note prompt.
 *
 * Pure function — no I/O. Returns null if the page data contains
 * no meaningful supplementary data beyond what the artisan entity already provides.
 *
 * @module lib/listing/distillArtistOverview
 */

import type { ArtisanPageResponse } from '@/types/artisan';
import type { ArtistOverview } from './curatorNote';

/**
 * Distill rich artist page data into a compact overview for AI context.
 * Returns null if there's nothing meaningful to add.
 */
export function distillArtistOverview(
  pageData: ArtisanPageResponse
): ArtistOverview | null {
  const formDist = pageData.stats?.form_distribution ?? {};
  const meiDist = pageData.stats?.mei_distribution ?? {};

  // Top 5 students by elite_factor
  const topStudents = (pageData.lineage?.students ?? [])
    .filter(s => s.elite_factor > 0 || s.juyo_count > 0 || s.tokuju_count > 0)
    .sort((a, b) => b.elite_factor - a.elite_factor)
    .slice(0, 5)
    .map(s => ({
      name: s.name_romaji ?? s.code,
      juyo_count: s.juyo_count,
      tokuju_count: s.tokuju_count,
      elite_factor: s.elite_factor,
    }));

  // School ancestry breadcrumb names
  const schoolAncestry = (pageData.schoolAncestry ?? [])
    .map(a => a.name_romaji)
    .filter(Boolean);

  // Elite percentile
  const elitePercentile = pageData.rankings?.elite_percentile ?? 0;

  // Top 5 provenance owners from denraiGrouped
  const topProvenanceOwners = (pageData.denraiGrouped ?? [])
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 5)
    .map(d => ({
      name: d.parent,
      count: d.totalCount,
    }));

  // Check if we have any meaningful data beyond what the entity already provides
  const hasFormDist = Object.keys(formDist).length > 0;
  const hasMeiDist = Object.keys(meiDist).length > 0;
  const hasStudents = topStudents.length > 0;
  const hasAncestry = schoolAncestry.length > 0;
  const hasProvenance = topProvenanceOwners.length > 0;

  if (!hasFormDist && !hasMeiDist && !hasStudents && !hasAncestry && !hasProvenance) {
    return null;
  }

  return {
    form_distribution: formDist,
    mei_distribution: meiDist,
    top_students: topStudents,
    school_ancestry: schoolAncestry,
    elite_percentile: elitePercentile,
    top_provenance_owners: topProvenanceOwners,
  };
}
