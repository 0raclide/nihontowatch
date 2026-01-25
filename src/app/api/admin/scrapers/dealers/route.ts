import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiUnauthorized, apiForbidden } from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    // Use service client to bypass RLS for scraper tables
    const serviceClient = createServiceClient();

    // Try to get active dealers (table may not exist)
    try {
      const { data: dealers, error } = await serviceClient
        .from('dealers')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        // Table doesn't exist - return empty list
        logger.info('dealers table not available', { error: error.message });
        return NextResponse.json({ dealers: [] });
      }

      return NextResponse.json({ dealers: dealers || [] });
    } catch (e) {
      // Table doesn't exist
      return NextResponse.json({ dealers: [] });
    }
  } catch (error) {
    logger.logError('Dealers error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
