import { generateArtisanSlug } from '@/lib/artisan/slugs';
import type { ArtisanPageResponse } from '@/types/artisan';

/**
 * Build full artist page data for a given artisan code.
 * Shared between SSR page (artists/[slug]/page.tsx) and API route (api/artisan/[code]).
 * Returns null if the code doesn't resolve to a known artisan.
 */
export async function buildArtistPageData(code: string): Promise<ArtisanPageResponse | null> {
  const {
    getArtisan,
    getAiDescription,
    getStudents,
    getRelatedArtisans,
    getElitePercentile,
    getProvenancePercentile,
    getTokoTaikanPercentile,
    resolveTeacher,
    getDenraiForArtisan,
    getDenraiGrouped,
    getArtisanDistributions,
    getHeroImageForDetailPage,
    getPublishedCatalogueEntries,
    getSchoolAncestry,
  } = await import('@/lib/supabase/yuhinkai');

  const entity = await getArtisan(code);
  if (!entity) return null;

  const entityCode = entity.maker_id;
  const entityType = entity.entity_type;
  const eliteFactor = entity.elite_factor ?? 0;
  const provenanceFactor = entity.provenance_factor ?? null;
  const provenanceCount = entity.provenance_count ?? 0;
  const provenanceApex = entity.provenance_apex ?? 0;
  const slug = generateArtisanSlug(entity.name_romaji, entityCode);

  // Fetch all enrichment data in parallel
  const [aiDescription, students, related, elitePercentile, provenancePercentile, tokoTaikanPercentile, teacherStub, denraiResult, heroImage, catalogueEntries, schoolAncestryRaw] =
    await Promise.all([
      getAiDescription(entityCode),
      getStudents(entityCode, entity.name_romaji),
      getRelatedArtisans(entityCode, entity.school, entityType, entity.school_code),
      getElitePercentile(eliteFactor, entityType),
      provenanceFactor != null
        ? getProvenancePercentile(provenanceFactor, entityType)
        : Promise.resolve(null),
      entity.toko_taikan
        ? getTokoTaikanPercentile(entity.toko_taikan)
        : Promise.resolve(null),
      entity.teacher ? resolveTeacher(entity.teacher) : Promise.resolve(null),
      getDenraiForArtisan(entityCode, entityType),
      getHeroImageForDetailPage(entityCode, entityType),
      getPublishedCatalogueEntries(entityCode, entityType),
      entity.school_code
        ? getSchoolAncestry(entity.school_code)
        : Promise.resolve([]),
    ]);

  // Compute grouped denrai from precomputed result (no extra DB queries)
  const denraiGrouped = await getDenraiGrouped(entityCode, entityType, denraiResult);

  // Always compute mei/form distributions live from gold_values
  // (profile snapshots had incorrect mei data — see CHO10/MAS590 bug)
  const stats = await getArtisanDistributions(entityCode, entityType);

  // Fetch available listing counts for students + related artisans
  const allRelatedCodes = [
    ...students.map(s => s.code),
    ...related.map(r => r.code),
  ];
  const listingCountMap = new Map<string, number>();
  if (allRelatedCodes.length > 0) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const supabase = createServiceClient();
      const { data: listingRows } = await supabase
        .from('listings')
        .select('id, artisan_id')
        .in('artisan_id' as string, allRelatedCodes)
        .eq('is_available', true) as { data: Array<{ id: number; artisan_id: string }> | null; error: unknown };

      for (const row of listingRows || []) {
        listingCountMap.set(row.artisan_id, (listingCountMap.get(row.artisan_id) || 0) + 1);
      }
    } catch {
      // Non-critical — listing counts are optional
    }
  }

  return {
    entity: {
      code: entityCode,
      name_romaji: entity.name_romaji,
      name_kanji: entity.name_kanji,
      school: entity.school,
      school_code: entity.school_code,
      school_kanji: entity.school_kanji,
      school_tradition: entity.school_tradition,
      province: entity.province,
      era: entity.era,
      period: entity.period,
      generation: entity.generation,
      teacher: entity.teacher,
      entity_type: entityType,
      is_school_code: entity.is_school_code || false,
      slug,
      fujishiro: entity.fujishiro,
      toko_taikan: entity.toko_taikan,
      specialties: entity.specialties,
    },
    certifications: {
      kokuho_count: entity.kokuho_count || 0,
      jubun_count: entity.jubun_count || 0,
      jubi_count: entity.jubi_count || 0,
      gyobutsu_count: entity.gyobutsu_count || 0,
      tokuju_count: entity.tokuju_count || 0,
      juyo_count: entity.juyo_count || 0,
      total_items: entity.total_items || 0,
      elite_count: entity.elite_count || 0,
      elite_factor: eliteFactor,
    },
    rankings: {
      elite_percentile: elitePercentile,
      toko_taikan_percentile: tokoTaikanPercentile,
      provenance_percentile: provenancePercentile,
    },
    provenance: {
      factor: provenanceFactor,
      count: provenanceCount,
      apex: provenanceApex,
    },
    profile: aiDescription
      ? { profile_md: aiDescription, hook: null, setsumei_count: 0, generated_at: '' }
      : null,
    stats,
    lineage: {
      teacher: teacherStub
        ? {
            code: teacherStub.code,
            name_romaji: teacherStub.name_romaji,
            slug: generateArtisanSlug(teacherStub.name_romaji, teacherStub.code),
          }
        : null,
      students: students.map(s => ({
        code: s.code,
        name_romaji: s.name_romaji,
        name_kanji: s.name_kanji,
        slug: generateArtisanSlug(s.name_romaji, s.code),
        school: s.school,
        kokuho_count: s.kokuho_count,
        jubun_count: s.jubun_count,
        jubi_count: s.jubi_count,
        gyobutsu_count: s.gyobutsu_count,
        juyo_count: s.juyo_count,
        tokuju_count: s.tokuju_count,
        elite_factor: s.elite_factor,
        available_count: listingCountMap.get(s.code) || 0,
      })),
    },
    related: related.map(r => ({
      code: r.code,
      name_romaji: r.name_romaji,
      name_kanji: r.name_kanji,
      slug: generateArtisanSlug(r.name_romaji, r.code),
      school: r.school,
      kokuho_count: r.kokuho_count,
      jubun_count: r.jubun_count,
      jubi_count: r.jubi_count,
      gyobutsu_count: r.gyobutsu_count,
      juyo_count: r.juyo_count,
      tokuju_count: r.tokuju_count,
      elite_factor: r.elite_factor,
      available_count: listingCountMap.get(r.code) || 0,
    })),
    schoolAncestry: schoolAncestryRaw.length > 1
      ? schoolAncestryRaw.map(s => ({ code: s.school_id, name_romaji: s.name_romaji, name_kanji: s.name_kanji }))
      : undefined,
    denrai: denraiResult.owners,
    denraiGrouped,
    heroImage,
    catalogueEntries: catalogueEntries.length > 0 ? catalogueEntries : undefined,
  };
}
