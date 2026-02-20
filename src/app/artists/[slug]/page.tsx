import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { extractCodeFromSlug, isBareCode, generateArtisanSlug } from '@/lib/artisan/slugs';
import { getArtisanDisplayParts, getArtisanAlias } from '@/lib/artisan/displayName';
import { getArtisan } from '@/lib/supabase/yuhinkai';
import { buildArtistPageData } from '@/lib/artisan/getArtistPageData';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { ArtistProfileBar } from '@/components/artisan/ArtistProfileBar';
import { ListingReturnBar } from '@/components/artisan/ListingReturnBar';
import { ArtistPageClient } from './ArtistPageClient';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const code = extractCodeFromSlug(slug);
  if (!code) return { title: 'Artist Not Found | NihontoWatch' };

  const entity = await getArtisan(code);

  if (!entity) return { title: 'Artist Not Found | NihontoWatch' };

  const name = entity.name_romaji || code;
  const type = entity.entity_type === 'smith' ? 'swordsmith' : 'tosogu maker';
  const province = entity.province ? ` of ${entity.province}` : '';
  const juyo = entity.juyo_count || 0;
  const tokuju = entity.tokuju_count || 0;

  const entityCode = entity.maker_id;
  const { prefix } = getArtisanDisplayParts(name, entity.school);
  const schoolLabel = prefix || entity.school || 'Japanese';
  const alias = getArtisanAlias(entityCode);
  const isSchool = entityCode.startsWith('NS-');
  const schoolSuffix = isSchool ? ' School' : '';
  const baseName = alias ? (alias.toLowerCase().includes(name.toLowerCase()) ? alias : `${name} (${alias})`) : name;
  const displayName = baseName + schoolSuffix;
  const title = `${displayName} — ${schoolLabel} ${isSchool ? 'school' : type} | NihontoWatch`;
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
    const entity = await getArtisan(slug);

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

  const data = await buildArtistPageData(code);
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
