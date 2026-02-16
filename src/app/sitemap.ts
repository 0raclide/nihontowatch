import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { yuhinkaiClient } from '@/lib/supabase/yuhinkai';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { getAllSlugsByRoute } from '@/lib/seo/categories';
import { createDealerSlug } from '@/lib/dealers/utils';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Batch size for fetching listings (Supabase limit is 1000)
const BATCH_SIZE = 1000;

interface ListingForSitemap {
  id: number;
  last_scraped_at: string | null;
  item_type: string | null;
}

interface DealerForSitemap {
  id: number;
  name: string;
}

async function getAllDealers(): Promise<DealerForSitemap[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('dealers')
    .select('id, name')
    .eq('is_active', true);

  if (error) {
    console.error('[Sitemap] Error fetching dealers:', error);
    return [];
  }

  return data || [];
}

interface ArtisanForSitemap {
  code: string;
  name_romaji: string | null;
}

async function getAllNotableArtisans(): Promise<ArtisanForSitemap[]> {
  const artisans: ArtisanForSitemap[] = [];

  // Fetch smiths (including NS school codes)
  const { data: smiths } = await yuhinkaiClient
    .from('smith_entities')
    .select('smith_id, name_romaji')
    .gt('total_items', 0);

  for (const s of smiths || []) {
    artisans.push({ code: s.smith_id, name_romaji: s.name_romaji });
  }

  // Fetch tosogu makers (including NS school codes)
  const { data: makers } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('maker_id, name_romaji')
    .gt('total_items', 0);

  for (const m of makers || []) {
    artisans.push({ code: m.maker_id, name_romaji: m.name_romaji });
  }

  return artisans;
}

async function getAllListings(): Promise<ListingForSitemap[]> {
  const supabase = createServiceClient();
  const allListings: ListingForSitemap[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, last_scraped_at, item_type')
      .eq('is_available', true)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('[Sitemap] Error fetching listings:', error);
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

async function getAllSoldListings(): Promise<ListingForSitemap[]> {
  const supabase = createServiceClient();
  const allListings: ListingForSitemap[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, last_scraped_at, item_type')
      .eq('is_available', false)
      .in('status', ['sold', 'presumed_sold'])
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('[Sitemap] Error fetching sold listings:', error);
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
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
  ];

  // Fetch dealers, listings, sold listings, and artisans in parallel
  const [dealers, listings, soldListings, artisans] = await Promise.all([
    getAllDealers(),
    getAllListings(),
    getAllSoldListings(),
    getAllNotableArtisans(),
  ]);

  // Individual dealer pages
  const dealerPages: MetadataRoute.Sitemap = dealers.map((dealer) => ({
    url: `${baseUrl}/dealers/${createDealerSlug(dealer.name)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dynamic listing pages (available)
  const listingPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${baseUrl}/listing/${listing.id}`,
    lastModified: listing.last_scraped_at
      ? new Date(listing.last_scraped_at)
      : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Sold listing pages (archive — lower priority, less frequent changes)
  const soldListingPages: MetadataRoute.Sitemap = soldListings.map((listing) => ({
    url: `${baseUrl}/listing/${listing.id}`,
    lastModified: listing.last_scraped_at
      ? new Date(listing.last_scraped_at)
      : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }));

  // Individual artist pages
  const artistPages: MetadataRoute.Sitemap = artisans.map((artisan) => ({
    url: `${baseUrl}/artists/${generateArtisanSlug(artisan.name_romaji, artisan.code)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Category landing pages (SEO) — all routes use unified slug API
  const routePrefixes = ['swords', 'fittings', 'certified'] as const;
  const categoryPages: MetadataRoute.Sitemap = routePrefixes.flatMap((prefix) =>
    getAllSlugsByRoute(prefix).map((slug) => ({
      url: `${baseUrl}/${prefix}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  );

  // Glossary term pages (featured terms only)
  const glossaryTermSlugs = [
    'juyo', 'hozon', 'tokubetsu-hozon', 'tokubetsu-juyo', 'setsumei', 'origami', 'shinsa',
    'katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'daisho',
    'hamon', 'nagasa', 'sugata', 'kissaki', 'nakago', 'mei', 'boshi', 'sori',
    'kitae', 'jigane', 'jihada', 'yakiba',
    'tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'koshirae',
    'gokaden', 'shinto', 'koto', 'shinshinto',
    'shakudo', 'shibuichi',
  ];
  const glossaryTermPages: MetadataRoute.Sitemap = glossaryTermSlugs.map((slug) => ({
    url: `${baseUrl}/glossary/${slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...glossaryTermPages, ...dealerPages, ...listingPages, ...soldListingPages, ...artistPages];
}

// Revalidate sitemap every hour
export const revalidate = 3600;
