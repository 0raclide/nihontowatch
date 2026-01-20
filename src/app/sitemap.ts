import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

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

// Helper to create URL-friendly slug from dealer name
function createDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  ];

  // Fetch dealers and listings in parallel
  const [dealers, listings] = await Promise.all([
    getAllDealers(),
    getAllListings(),
  ]);

  // Individual dealer pages
  const dealerPages: MetadataRoute.Sitemap = dealers.map((dealer) => ({
    url: `${baseUrl}/dealers/${createDealerSlug(dealer.name)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dynamic listing pages
  const listingPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${baseUrl}/listing/${listing.id}`,
    lastModified: listing.last_scraped_at
      ? new Date(listing.last_scraped_at)
      : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...dealerPages, ...listingPages];
}

// Revalidate sitemap every hour
export const revalidate = 3600;
