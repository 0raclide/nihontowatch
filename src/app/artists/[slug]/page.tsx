import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { extractCodeFromSlug, isBareCode, generateArtisanSlug } from '@/lib/artisan/slugs';
import {
  getSmithEntity,
  getTosoguMaker,
  getArtistProfile,
  getStudents,
  getRelatedArtisans,
  getElitePercentile,
  getTokoTaikanPercentile,
  resolveTeacher,
} from '@/lib/supabase/yuhinkai';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { ArtistPageClient } from './ArtistPageClient';
import type { ArtisanPageResponse } from '@/app/api/artisan/[code]/route';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

function computeEliteGrade(percentile: number): string {
  if (percentile >= 95) return 'S';
  if (percentile >= 80) return 'A';
  if (percentile >= 60) return 'B';
  if (percentile >= 40) return 'C';
  return 'D';
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

  const entityCode = isSmith ? smithEntity!.smith_id : tosoguMaker!.maker_id;
  const entityType = isSmith ? 'smith' as const : 'tosogu' as const;
  const eliteFactor = entity.elite_factor ?? 0;
  const slug = generateArtisanSlug(entity.name_romaji, entityCode);

  const [profile, students, related, elitePercentile, tokoTaikanPercentile, teacherStub] =
    await Promise.all([
      getArtistProfile(entityCode),
      getStudents(entityCode, entity.name_romaji),
      getRelatedArtisans(entityCode, entity.school, entityType),
      getElitePercentile(eliteFactor, entityType),
      isSmith && smithEntity!.toko_taikan
        ? getTokoTaikanPercentile(smithEntity!.toko_taikan!)
        : Promise.resolve(null),
      entity.teacher ? resolveTeacher(entity.teacher) : Promise.resolve(null),
    ]);

  let stats: ArtisanPageResponse['stats'] = null;
  if (profile?.stats_snapshot) {
    const snapshot = profile.stats_snapshot as Record<string, unknown>;
    const mei = snapshot.mei_distribution as Record<string, number> | undefined;
    const form = snapshot.form_distribution as Record<string, number> | undefined;
    if (mei || form) {
      stats = { mei_distribution: mei || {}, form_distribution: form || {} };
    }
  }

  const eliteGrade = computeEliteGrade(elitePercentile);

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
      elite_grade: eliteGrade,
      toko_taikan_percentile: tokoTaikanPercentile,
    },
    profile: profile
      ? {
          profile_md: profile.profile_md,
          hook: profile.hook,
          setsumei_count: profile.setsumei_count,
          generated_at: profile.generated_at,
        }
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
        slug: generateArtisanSlug(s.name_romaji, s.code),
      })),
    },
    related: related.map(r => ({
      code: r.code,
      name_romaji: r.name_romaji,
      name_kanji: r.name_kanji,
      slug: generateArtisanSlug(r.name_romaji, r.code),
      school: r.school,
      juyo_count: r.juyo_count,
      tokuju_count: r.tokuju_count,
      elite_factor: r.elite_factor,
    })),
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

  const title = `${name} — ${entity.school || 'Japanese'} ${type} | NihontoWatch`;
  const description = `Comprehensive profile of ${name}${province}, ${entity.era || 'Japanese'} ${type}. ${juyo} Jūyō, ${tokuju} Tokubetsu Jūyō certified works. Certification statistics, biography, and available listings.`;

  const canonicalSlug = generateArtisanSlug(entity.name_romaji, smith ? smith.smith_id : tosogu!.maker_id);
  const canonical = `${BASE_URL}/artists/${canonicalSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} — Artist Profile`,
      description,
      type: 'profile',
      url: canonical,
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
      const entityCode = smith ? smith.smith_id : tosogu!.maker_id;
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
    <div className="min-h-screen bg-surface">
      <script {...jsonLdScriptProps(personJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ArtistPageClient data={data} />
    </div>
  );
}
