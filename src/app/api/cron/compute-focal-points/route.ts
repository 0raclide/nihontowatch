/**
 * Compute smart crop focal points for new/invalidated listings
 *
 * For each listing with NULL focal_x and non-null images, downloads the
 * cover image, runs smartcrop-sharp to detect the optimal crop center,
 * and stores focal_x/focal_y (0-100%) for object-position CSS.
 *
 * Schedule: every 4 hours at :30 (offset from featured-scores at :00)
 * Auth: CRON_SECRET (Bearer or x-cron-secret header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import { logger } from '@/lib/logger';
import sharp from 'sharp';
import smartcrop from 'smartcrop-sharp';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const PAGE_SIZE = 200;
const UPDATE_BATCH_SIZE = 50;
const MAX_LISTINGS_PER_RUN = 500;
const MAX_DIMENSION = 512;
const CROP_ASPECT_W = 3;
const CROP_ASPECT_H = 4;

interface ListingRow {
  id: number;
  stored_images: string[] | null;
  images: string[] | null;
}

/**
 * Get the first usable image URL for a listing.
 * Prefers stored_images (Supabase Storage) over original dealer URLs.
 */
function getFirstImageUrl(listing: ListingRow): string | null {
  const stored = listing.stored_images;
  if (stored && stored.length > 0 && stored[0]) return stored[0];
  const original = listing.images;
  if (original && original.length > 0 && original[0]) return original[0];
  return null;
}

/**
 * Download an image and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NihontoWatch-FocalPointCron/1.0',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Compute the focal point for an image buffer.
 * Returns { x, y } as percentages (0-100).
 */
async function computeFocalPoint(imageBuffer: Buffer): Promise<{ x: number; y: number; width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  const origWidth = metadata.width || 800;
  const origHeight = metadata.height || 600;

  const scale = Math.min(MAX_DIMENSION / origWidth, MAX_DIMENSION / origHeight, 1);
  const analysisWidth = Math.round(origWidth * scale);
  const analysisHeight = Math.round(origHeight * scale);

  const resizedBuffer = await sharp(imageBuffer)
    .resize(analysisWidth, analysisHeight, { fit: 'inside' })
    .toBuffer();

  const cropWidth = Math.min(analysisWidth, Math.round(analysisHeight * CROP_ASPECT_W / CROP_ASPECT_H));
  const cropHeight = Math.min(analysisHeight, Math.round(analysisWidth * CROP_ASPECT_H / CROP_ASPECT_W));

  const result = await smartcrop.crop(resizedBuffer, {
    width: cropWidth,
    height: cropHeight,
  });

  const crop = result.topCrop;
  const centerX = (crop.x + crop.width / 2) / analysisWidth * 100;
  const centerY = (crop.y + crop.height / 2) / analysisHeight * 100;

  return {
    x: Math.round(centerX * 10) / 10,
    y: Math.round(centerY * 10) / 10,
    width: origWidth,
    height: origHeight,
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceClient();

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let offset = 0;

    while (totalProcessed < MAX_LISTINGS_PER_RUN) {
      const remaining = MAX_LISTINGS_PER_RUN - totalProcessed;
      const fetchSize = Math.min(PAGE_SIZE, remaining);

      // Fetch listings with NULL focal_x that have images
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listings, error } = await (supabase.from('listings') as any)
        .select('id, stored_images, images')
        .is('focal_x', null)
        .not('images', 'is', null)
        .range(offset, offset + fetchSize - 1) as { data: ListingRow[] | null; error: unknown };

      if (error) {
        logger.error('[focal-points] Query error at offset', { offset, error });
        break;
      }

      if (!listings || listings.length === 0) break;

      // Process each listing and collect updates
      const updates: { id: number; focal_x: number; focal_y: number; image_width: number; image_height: number }[] = [];

      for (const listing of listings) {
        const imageUrl = getFirstImageUrl(listing);
        if (!imageUrl) {
          totalSkipped++;
          continue;
        }

        try {
          const buffer = await downloadImage(imageUrl);
          const { x, y, width, height } = await computeFocalPoint(buffer);
          updates.push({ id: listing.id, focal_x: x, focal_y: y, image_width: width, image_height: height });
        } catch {
          totalSkipped++;
        }
      }

      // Batch update focal points + image dimensions
      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const chunk = updates.slice(i, i + UPDATE_BATCH_SIZE);
        await Promise.all(
          chunk.map(({ id, focal_x, focal_y, image_width, image_height }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from('listings') as any)
              .update({ focal_x, focal_y, image_width, image_height })
              .eq('id', id)
          )
        );
        totalUpdated += chunk.length;
      }

      totalProcessed += listings.length;

      if (listings.length < fetchSize) break;
      // Successfully updated rows drop out of the focal_x IS NULL filter.
      // Only advance offset by the number of skipped rows (which stay NULL).
      const batchSkipped = listings.length - updates.length;
      offset += batchSkipped;
    }

    const durationMs = Date.now() - startTime;
    logger.info('[focal-points] Complete', {
      totalProcessed,
      totalUpdated,
      totalSkipped,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalUpdated,
      totalSkipped,
      durationMs,
    });
  } catch (error) {
    logger.logError('[focal-points] Fatal error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
