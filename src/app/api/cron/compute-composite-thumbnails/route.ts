/**
 * Generate composite thumbnails for listings with extreme aspect ratio images
 *
 * For listings where the cover image is panoramic (w/h > 4, e.g., Nipponto sword strips),
 * downloads ALL images, filters for panoramic strips, and stacks them vertically
 * into a single 600x800 portrait composite on a dark background.
 *
 * The composite is uploaded to Supabase Storage and its public URL stored in
 * listings.thumbnail_url. ListingCard checks this field first.
 *
 * Schedule: every 4 hours at :45 (offset from focal-points at :30, featured-scores at :00)
 * Auth: CRON_SECRET (Bearer or x-cron-secret header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import { logger } from '@/lib/logger';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const MAX_LISTINGS_PER_RUN = 100; // Stored images are fast Supabase-to-Supabase downloads
const FORCE_LIMIT_CAP = 500; // Max allowed via ?force_limit query param
const COMPOSITE_WIDTH = 600;
const COMPOSITE_HEIGHT = 800;
const STRIP_GAP = 6;
const PANORAMIC_THRESHOLD = 3; // Individual image w/h ratio to qualify as a strip
const COMPOSITE_TRIGGER_RATIO = 4; // Cover image w/h ratio to trigger composite
const BG_COLOR = { r: 23, g: 23, b: 23 }; // #171717

interface ListingRow {
  id: number;
  stored_images: string[] | null;
  images: string[] | null;
  image_width: number;
  image_height: number;
  dealer_id: number;
  dealers: { name: string } | null;
}

function getAllImageUrls(listing: ListingRow): string[] {
  const stored = listing.stored_images;
  if (stored && stored.length > 0) return stored.filter(Boolean);
  const original = listing.images;
  if (original && original.length > 0) return original.filter(Boolean);
  return [];
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'NihontoWatch-CompositeCron/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function createDealerSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface StripInfo {
  buffer: Buffer;
  width: number;
  height: number;
}

async function generateComposite(strips: StripInfo[]): Promise<Buffer> {
  // Scale all strips to fill COMPOSITE_WIDTH edge-to-edge
  const scaledStrips: StripInfo[] = [];
  for (const strip of strips) {
    const scale = COMPOSITE_WIDTH / strip.width;
    const newHeight = Math.max(1, Math.round(strip.height * scale));
    const scaledBuffer = await sharp(strip.buffer)
      .resize(COMPOSITE_WIDTH, newHeight, { fit: 'fill' })
      .toBuffer();
    scaledStrips.push({ buffer: scaledBuffer, width: COMPOSITE_WIDTH, height: newHeight });
  }

  // Build overlays — stack from top, crop at canvas bottom
  const overlays: { input: Buffer; top: number; left: number }[] = [];
  let currentY = 0;
  for (const strip of scaledStrips) {
    if (currentY >= COMPOSITE_HEIGHT) break;

    let overlayBuffer = strip.buffer;
    if (currentY + strip.height > COMPOSITE_HEIGHT) {
      const overlayHeight = COMPOSITE_HEIGHT - currentY;
      overlayBuffer = await sharp(strip.buffer)
        .extract({ left: 0, top: 0, width: strip.width, height: overlayHeight })
        .toBuffer();
    }

    overlays.push({ input: overlayBuffer, top: currentY, left: 0 });
    currentY += strip.height + STRIP_GAP;
  }

  return sharp({
    create: {
      width: COMPOSITE_WIDTH,
      height: COMPOSITE_HEIGHT,
      channels: 3,
      background: BG_COLOR,
    },
  })
    .composite(overlays)
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceClient();

    // Allow manual backfill via ?force_limit=N (capped at FORCE_LIMIT_CAP)
    const forceLimitParam = request.nextUrl.searchParams.get('force_limit');
    const batchSize = forceLimitParam
      ? Math.min(parseInt(forceLimitParam, 10) || MAX_LISTINGS_PER_RUN, FORCE_LIMIT_CAP)
      : MAX_LISTINGS_PER_RUN;

    // Query 1: Panoramic listings with known dimensions — DB-side filter via generated column
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: knownPanoramic, error } = await (supabase.from('listings') as any)
      .select('id, stored_images, images, image_width, image_height, dealer_id, dealers(name)')
      .is('thumbnail_url', null)
      .gt('cover_aspect_ratio', COMPOSITE_TRIGGER_RATIO)
      .order('id', { ascending: false })
      .limit(batchSize) as { data: ListingRow[] | null; error: unknown };

    if (error) {
      logger.error('[composite-thumbnails] Query error', { error });
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Query 2: Listings with images but NULL dimensions — need to probe first image
    const remainingSlots = batchSize - (knownPanoramic?.length ?? 0);
    let unknownDimension: ListingRow[] = [];
    if (remainingSlots > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unknown, error: err2 } = await (supabase.from('listings') as any)
        .select('id, stored_images, images, image_width, image_height, dealer_id, dealers(name)')
        .is('thumbnail_url', null)
        .is('image_width', null)
        .not('images', 'is', null)
        .order('id', { ascending: false })
        .limit(remainingSlots) as { data: ListingRow[] | null; error: unknown };
      if (err2) {
        logger.error('[composite-thumbnails] Unknown-dimension query error', { error: err2 });
      } else {
        unknownDimension = unknown ?? [];
      }
    }

    const listings = [...(knownPanoramic ?? []), ...unknownDimension];

    if (listings.length === 0) {
      return NextResponse.json({ success: true, message: 'No listings need composites', durationMs: Date.now() - startTime });
    }

    let totalProcessed = 0;
    let totalComposited = 0;
    let totalSkipped = 0;

    for (const listing of listings) {
      totalProcessed++;
      const imageUrls = getAllImageUrls(listing);
      if (imageUrls.length === 0) { totalSkipped++; continue; }

      try {
        // For unknown-dimension listings, probe first image to check if panoramic
        if (!listing.image_width || !listing.image_height) {
          try {
            const probeBuffer = await downloadImage(imageUrls[0]);
            const probeMeta = await sharp(probeBuffer).metadata();
            if (probeMeta.width && probeMeta.height) {
              // Backfill dimensions in DB
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('listings') as any)
                .update({ image_width: probeMeta.width, image_height: probeMeta.height })
                .eq('id', listing.id);
              // Skip if not panoramic
              if (probeMeta.width / probeMeta.height <= COMPOSITE_TRIGGER_RATIO) {
                totalSkipped++;
                continue;
              }
            }
          } catch {
            totalSkipped++;
            continue;
          }
        }

        // Download all images and get dimensions
        const imageData: StripInfo[] = [];
        for (const url of imageUrls) {
          try {
            const buffer = await downloadImage(url);
            const metadata = await sharp(buffer).metadata();
            if (metadata.width && metadata.height) {
              imageData.push({ buffer, width: metadata.width, height: metadata.height });
            }
          } catch {
            continue;
          }
        }

        // Filter for panoramic strips
        const strips = imageData.filter(img => img.width / img.height > PANORAMIC_THRESHOLD);
        if (strips.length < 2) { totalSkipped++; continue; }

        const thumbnailBuffer = await generateComposite(strips);

        // Upload to Supabase Storage
        const dealerSlug = listing.dealers?.name
          ? createDealerSlug(listing.dealers.name)
          : `dealer-${listing.dealer_id}`;
        const paddedId = String(listing.id).padStart(5, '0');
        const storagePath = `${dealerSlug}/L${paddedId}/composite.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(storagePath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          logger.error('[composite-thumbnails] Upload error', { listingId: listing.id, error: uploadError });
          totalSkipped++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('listing-images')
          .getPublicUrl(storagePath);

        // Write thumbnail_url to DB
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('listings') as any)
          .update({ thumbnail_url: urlData.publicUrl })
          .eq('id', listing.id);

        if (updateError) {
          logger.error('[composite-thumbnails] DB update error', { listingId: listing.id, error: updateError });
          totalSkipped++;
          continue;
        }

        totalComposited++;
      } catch {
        totalSkipped++;
      }

      // Time guard: stop if approaching 5-minute limit
      if (Date.now() - startTime > 270000) {
        logger.info('[composite-thumbnails] Approaching timeout, stopping early');
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('[composite-thumbnails] Complete', {
      totalProcessed,
      totalComposited,
      totalSkipped,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalComposited,
      totalSkipped,
      durationMs,
    });
  } catch (error) {
    logger.logError('[composite-thumbnails] Fatal error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
