import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Proxy route for Yuhinkai catalog images.
 * Fetches from Supabase Storage using the service role key and serves with caching.
 *
 * Usage: /api/catalog-image?path=Tokuju/6_19_oshigata.jpg
 */

const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const storageKey = process.env.YUHINKAI_STORAGE_KEY || '';

export async function GET(request: NextRequest) {
  const storagePath = request.nextUrl.searchParams.get('path');

  if (!storagePath || !yuhinkaiUrl || !storageKey) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Validate path format (prevent traversal)
  if (storagePath.includes('..') || !storagePath.match(/^[A-Za-z_]+\/[\d_]+_oshigata\.jpg$/)) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  try {
    const client = createClient(yuhinkaiUrl, storageKey);
    const { data, error } = await client.storage
      .from('images')
      .download(storagePath);

    if (error || !data) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Image not found', { status: 404 });
  }
}
