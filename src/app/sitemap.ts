import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { yuhinkaiClient, yuhinkaiConfigured } from '@/lib/supabase/yuhinkai';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { getAllSlugsByRoute } from '@/lib/seo/categories';
import { createDealerSlug } from '@/lib/dealers/utils';
import { FEATURED_TERMS } from '@/lib/glossary/featuredTerms';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Batch size for fetching listings (Supabase limit is 1000)
const BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// Sub-sitemap IDs
// ---------------------------------------------------------------------------
// 0 = static pages + categories + glossary + dealers
// 1 = available listings
// 2 = sold listings
// 3 = artisan pages (from Yuhinkai)
// ---------------------------------------------------------------------------

/**
 * Generate sitemap index — each ID becomes a separate /sitemap/{id}.xml.
 * This avoids Vercel serverless timeouts by splitting the work into
 * smaller, independent function invocations.
 */
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
}

// ---------------------------------------------------------------------------
// Data fetchers (one per content type)
// ---------------------------------------------------------------------------

interface ListingForSitemap {
  id: number;
  last_scraped_at: string | null;
  item_type: string | null;
}

interface DealerForSitemap {
  id: number;
  name: string;
}

interface ArtisanForSitemap {
  code: string;
  name_romaji: string | null;
}

async function getAllDealers(): Promise<DealerForSitemap[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('dealers')
    .select('id, name')
    .eq('is_active', true);

  if (error) {
    console.error('[Sitemap:0] Error fetching dealers:', error);
    return [];
  }

  console.log(`[Sitemap:0] Fetched ${data?.length ?? 0} dealers`);
  return data || [];
}

async function fetchListingsBatch(
  available: boolean,
  statusFilter?: string[],
  /** When true, only include listings with images (filters out soft-404 candidates) */
  requireImages?: boolean
): Promise<ListingForSitemap[]> {
  const supabase = createServiceClient();
  const allListings: ListingForSitemap[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('listings')
      .select('id, last_scraped_at, item_type')
      .eq('is_available', available)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (statusFilter) {
      query = query.in('status', statusFilter);
    }

    if (requireImages) {
      query = query.not('images', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Sitemap] Error fetching listings (available=${available}) at offset ${offset}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allListings.push(...data);
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allListings;
}

async function getAllNotableArtisans(): Promise<ArtisanForSitemap[]> {
  if (!yuhinkaiConfigured) {
    console.warn('[Sitemap:3] Yuhinkai not configured — skipping artisan pages');
    return [];
  }

  const artisans: ArtisanForSitemap[] = [];

  // Fetch individual makers from artisan_makers
  const { data: makers, error: makersError } = await yuhinkaiClient
    .from('artisan_makers')
    .select('maker_id, name_romaji')
    .gt('total_items', 0);

  if (makersError) {
    console.error('[Sitemap:3] Error fetching artisan_makers:', makersError);
  } else {
    for (const m of makers || []) {
      artisans.push({ code: m.maker_id, name_romaji: m.name_romaji });
    }
    console.log(`[Sitemap:3] Fetched ${makers?.length ?? 0} individual makers`);
  }

  // Fetch school entries from artisan_schools
  const { data: schools, error: schoolsError } = await yuhinkaiClient
    .from('artisan_schools')
    .select('school_id, name_romaji')
    .gt('total_items', 0);

  if (schoolsError) {
    console.error('[Sitemap:3] Error fetching artisan_schools:', schoolsError);
  } else {
    for (const s of schools || []) {
      artisans.push({ code: s.school_id, name_romaji: s.name_romaji });
    }
    console.log(`[Sitemap:3] Fetched ${schools?.length ?? 0} schools`);
  }

  console.log(`[Sitemap:3] Total artisan pages: ${artisans.length}`);
  return artisans;
}

// Glossary terms imported from shared constant (src/lib/glossary/featuredTerms.ts)

// ---------------------------------------------------------------------------
// Sitemap generator — dispatches to the right content type by ID
// ---------------------------------------------------------------------------

export default async function sitemap(
  { id }: { id: number }
): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    // ----- 0: Static pages + categories + glossary + dealers -----
    case 0: {
      const dealers = await getAllDealers();

      const staticPages: MetadataRoute.Sitemap = [
        {
          url: baseUrl,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 1.0,
        },
        {
          url: `${baseUrl}/dealers`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/artists`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/glossary`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.7,
        },
      ];

      const dealerPages: MetadataRoute.Sitemap = dealers.map((dealer) => ({
        url: `${baseUrl}/dealers/${createDealerSlug(dealer.name)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

      const routePrefixes = ['swords', 'fittings', 'certified'] as const;
      const categoryPages: MetadataRoute.Sitemap = routePrefixes.flatMap((prefix) =>
        getAllSlugsByRoute(prefix).map((slug) => ({
          url: `${baseUrl}/${prefix}/${slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }))
      );

      const glossaryPages: MetadataRoute.Sitemap = FEATURED_TERMS.map((slug) => ({
        url: `${baseUrl}/glossary/${slug}`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));

      const total = staticPages.length + dealerPages.length + categoryPages.length + glossaryPages.length;
      console.log(`[Sitemap:0] Generated ${total} URLs (${staticPages.length} static, ${categoryPages.length} categories, ${glossaryPages.length} glossary, ${dealerPages.length} dealers)`);

      return [...staticPages, ...categoryPages, ...glossaryPages, ...dealerPages];
    }

    // ----- 1: Available listings -----
    case 1: {
      const listings = await fetchListingsBatch(true);
      console.log(`[Sitemap:1] Generated ${listings.length} available listing URLs`);

      return listings.map((listing) => ({
        url: `${baseUrl}/listing/${listing.id}`,
        lastModified: listing.last_scraped_at
          ? new Date(listing.last_scraped_at)
          : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }

    // ----- 2: Sold listings (archive, content-rich only) -----
    case 2: {
      // Only include sold listings with images to avoid soft-404s from thin content pages
      const soldListings = await fetchListingsBatch(false, ['sold', 'presumed_sold'], true);
      console.log(`[Sitemap:2] Generated ${soldListings.length} sold listing URLs (filtered: images required)`);

      return soldListings.map((listing) => ({
        url: `${baseUrl}/listing/${listing.id}`,
        lastModified: listing.last_scraped_at
          ? new Date(listing.last_scraped_at)
          : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      }));
    }

    // ----- 3: Artisan pages (from Yuhinkai) -----
    case 3: {
      const artisans = await getAllNotableArtisans();

      return artisans.map((artisan) => ({
        url: `${baseUrl}/artists/${generateArtisanSlug(artisan.name_romaji, artisan.code)}`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    }

    default:
      return [];
  }
}

// Revalidate each sub-sitemap every hour
export const revalidate = 3600;
