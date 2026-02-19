import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { extractCodeFromSlug, isBareCode, generateArtisanSlug } from '@/lib/artisan/slugs';
import { getArtisanDisplayParts, getArtisanAlias } from '@/lib/artisan/displayName';
import {
  getSmithEntity,
  getTosoguMaker,
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
} from '@/lib/supabase/yuhinkai';
import { createServiceClient } from '@/lib/supabase/server';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { ArtistProfileBar } from '@/components/artisan/ArtistProfileBar';
import { ListingReturnBar } from '@/components/artisan/ListingReturnBar';
import { ArtistPageClient } from './ArtistPageClient';
import type { ArtisanPageResponse } from '@/app/api/artisan/[code]/route';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Fetch all data for the artist page server-side.
 */
async function getArtistData(code: string): Promise<ArtisanPageResponse | null> {
  const smithEntity = await getSmithEntity(code);
  const isSmith = !!smithEntity;
  const tosoguMaker = !isSmith ? await getTosoguMaker(code) : null;
  const entity = smithEntity || tosoguMaker;

  if (!entity) return null;

  const entityCode = entity.maker_id;
  const entityType = isSmith ? 'smith' as const : 'tosogu' as const;
  const eliteFactor = entity.elite_factor ?? 0;
  const provenanceFactor = entity.provenance_factor ?? null;
  const provenanceCount = entity.provenance_count ?? 0;
  const provenanceApex = entity.provenance_apex ?? 0;
  const slug = generateArtisanSlug(entity.name_romaji, entityCode);

  const [aiDescription, students, related, elitePercentile, provenancePercentile, tokoTaikanPercentile, teacherStub, denraiResult, heroImage, catalogueEntries] =
    await Promise.all([
      getAiDescription(entityCode),
      getStudents(entityCode, entity.name_romaji),
      getRelatedArtisans(entityCode, entity.school, entityType),
      getElitePercentile(eliteFactor, entityType),
      provenanceFactor != null
        ? getProvenancePercentile(provenanceFactor, entityType)
        : Promise.resolve(null),
      isSmith && smithEntity!.toko_taikan
        ? getTokoTaikanPercentile(smithEntity!.toko_taikan!)
        : Promise.resolve(null),
      entity.teacher ? resolveTeacher(entity.teacher) : Promise.resolve(null),
      getDenraiForArtisan(entityCode, entityType),
      getHeroImageForDetailPage(entityCode, entityType),
      getPublishedCatalogueEntries(entityCode, entityType),
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
      province: entity.province,
      era: entity.era,
      period: isSmith ? smithEntity!.period : null,
      generation: entity.generation,
      teacher: entity.teacher,
      entity_type: entityType,
      is_school_code: entity.is_school_code || false,
      slug,
      fujishiro: isSmith ? smithEntity!.fujishiro : null,
      toko_taikan: isSmith ? smithEntity!.toko_taikan : null,
      specialties: !isSmith ? tosoguMaker!.specialties : null,
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
    denrai: denraiResult.owners,
    denraiGrouped,
    heroImage,
    catalogueEntries: catalogueEntries.length > 0 ? catalogueEntries : undefined,
  };
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const code = extractCodeFromSlug(slug);
  if (!code) return { title: 'Artist Not Found | NihontoWatch' };

  const smith = await getSmithEntity(code);
  const tosogu = !smith ? await getTosoguMaker(code) : null;
  const entity = smith || tosogu;

  if (!entity) return { title: 'Artist Not Found | NihontoWatch' };

  const name = entity.name_romaji || code;
  const type = smith ? 'swordsmith' : 'tosogu maker';
  const province = entity.province ? ` of ${entity.province}` : '';
  const juyo = entity.juyo_count || 0;
  const tokuju = entity.tokuju_count || 0;

  const entityCode = entity.maker_id;
  const { prefix } = getArtisanDisplayParts(name, entity.school);
  const schoolLabel = prefix || entity.school || 'Japanese';
  const alias = getArtisanAlias(entityCode);
  const displayName = alias ? (alias.toLowerCase().includes(name.toLowerCase()) ? alias : `${name} (${alias})`) : name;
  const title = `${displayName} — ${schoolLabel} ${type} | NihontoWatch`;
  const description = `Comprehensive profile of ${displayName}${province}, ${entity.era || 'Japanese'} ${type}. ${juyo} Jūyō, ${tokuju} Tokubetsu Jūyō certified works. Certification statistics, biography, and available listings.`;

  const canonicalSlug = generateArtisanSlug(entity.name_romaji, entityCode);
  const canonical = `${BASE_URL}/artists/${canonicalSlug}`;
  const ogImageUrl = `${BASE_URL}/api/og?artist=${encodeURIComponent(entityCode)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${displayName} — Artist Profile`,
      description,
      type: 'profile',
      url: canonical,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${displayName} — ${schoolLabel} ${type}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} — Artist Profile`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ArtistSlugPage({ params }: ArtistPageProps) {
  const { slug } = await params;

  // Redirect bare codes to the full slug URL (unless slug already matches)
  if (isBareCode(slug)) {
    const smith = await getSmithEntity(slug);
    const tosogu = !smith ? await getTosoguMaker(slug) : null;
    const entity = smith || tosogu;

    if (entity) {
      const entityCode = entity.maker_id;
      const correctSlug = generateArtisanSlug(entity.name_romaji, entityCode);
      // Only redirect if the slug actually changes (avoids loop for NS-* codes)
      if (correctSlug !== slug) {
        redirect(`/artists/${correctSlug}`);
      }
      // Otherwise fall through to normal rendering
    } else {
      notFound();
    }
  }

  const code = extractCodeFromSlug(slug);
  if (!code) notFound();

  const data = await getArtistData(code);
  if (!data) notFound();

  // Ensure canonical slug — redirect if slug is wrong
  if (slug !== data.entity.slug) {
    redirect(`/artists/${data.entity.slug}`);
  }

  const name = data.entity.name_romaji || data.entity.code;

  // JSON-LD: Person schema + breadcrumbs
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    ...(data.entity.name_kanji ? { alternateName: data.entity.name_kanji } : {}),
    description: `${data.entity.era || 'Japanese'} ${data.entity.entity_type === 'smith' ? 'swordsmith' : 'tosogu maker'}${data.entity.province ? ` of ${data.entity.province}` : ''}${data.entity.school ? `, ${data.entity.school} school` : ''}.`,
    url: `${BASE_URL}/artists/${data.entity.slug}`,
    ...(data.entity.province ? { birthPlace: { '@type': 'Place', name: `${data.entity.province} Province, Japan` } } : {}),
    knowsAbout: data.entity.entity_type === 'smith'
      ? 'Japanese sword making (nihonto)'
      : 'Japanese sword fittings (tosogu)',
  };

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: BASE_URL },
    { name: 'Artists', url: `${BASE_URL}/artists` },
    { name },
  ]);

  return (
    <>
      <script {...jsonLdScriptProps(personJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ArtistPageClient data={data} />

      <ListingReturnBar />
      <ArtistProfileBar />
    </>
  );
}
