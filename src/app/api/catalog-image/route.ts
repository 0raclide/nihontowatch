import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Proxy route for Yuhinkai catalog images.
 * Fetches from Supabase Storage using the service key and serves with caching.
 *
 * Usage: /api/catalog-image?path=Tokuju/6_19_oshigata.jpg
 */

const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const storagePath = request.nextUrl.searchParams.get('path');
  const debug = request.nextUrl.searchParams.get('debug') === '1';

  if (!storagePath || !yuhinkaiUrl || !yuhinkaiKey) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Validate path format (prevent traversal)
  if (storagePath.includes('..') || !storagePath.match(/^[A-Za-z_]+\/[\d_]+_oshigata\.jpg$/)) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  // Debug: list files in the folder to check what exists
  if (debug) {
    const client = createClient(yuhinkaiUrl, yuhinkaiKey);
    const parts = storagePath.split('/');
    const folder = parts[0];
    // List root of bucket + target folder
    const { data: buckets, error: bucketError } = await client.storage.listBuckets();
    const { data: rootFiles, error: rootError } = await client.storage
      .from('images')
      .list('', { limit: 20 });
    const { data: folderFiles, error: folderError } = await client.storage
      .from('images')
      .list(folder, { limit: 20 });
    return NextResponse.json({
      buckets: buckets?.map(b => ({ name: b.name, public: b.public })) || [],
      bucketError: bucketError?.message || null,
      rootFiles: rootFiles?.map(f => f.name) || [],
      rootError: rootError?.message || null,
      folderFiles: folderFiles?.map(f => f.name) || [],
      folderError: folderError?.message || null,
      folder,
      storagePath,
      projectUrl: yuhinkaiUrl?.slice(0, 40),
    });
  }

  try {
    const client = createClient(yuhinkaiUrl, yuhinkaiKey);
    const { data, error } = await client.storage
      .from('images')
      .download(storagePath);

    if (error || !data) {
      console.error('[catalog-image] Storage download error:', error?.message, 'path:', storagePath, 'url:', yuhinkaiUrl?.slice(0, 30));
      // Return diagnostic info in dev/debug
      return NextResponse.json(
        { error: error?.message || 'No data returned', path: storagePath, hasUrl: !!yuhinkaiUrl, hasKey: !!yuhinkaiKey },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[catalog-image] Unexpected error:', err);
    return new NextResponse('Image not found', { status: 500 });
  }
}
