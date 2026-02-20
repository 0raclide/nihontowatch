import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiServerError,
  apiSuccess,
} from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('profiles')
      .select('id, email, display_name, is_admin, created_at, updated_at', { count: 'exact' });

    // Apply search filter (sanitize PostgREST operators to prevent filter injection)
    if (search) {
      const sanitized = search.replace(/[,().]/g, '');
      if (sanitized) {
        query = query.or(`email.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`);
      }
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Users query error', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return users as-is (is_admin column exists in database)
    const transformedUsers = users || [];

    return NextResponse.json({
      users: transformedUsers,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    logger.logError('Admin users error', error);
    return apiServerError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const body = await request.json();
    const { userId, isAdmin } = body;

    if (!userId || typeof isAdmin !== 'boolean') {
      return apiBadRequest('userId and isAdmin are required');
    }

    // Prevent admin from removing their own admin status
    if (userId === authResult.user.id && !isAdmin) {
      return apiBadRequest('Cannot remove your own admin status');
    }

    // Update role column only - is_admin is a GENERATED column computed from role
    const newRole = isAdmin ? 'admin' : 'user';
    // Type assertion needed - profiles table update has partial typing issues
    type ProfilesTable = ReturnType<typeof supabase.from>;
    const { error } = await (supabase
      .from('profiles') as unknown as ProfilesTable)
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId) as { error: { message: string } | null };

    if (error) {
      logger.error('Update user role error', { error: error.message, userId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return apiSuccess({ success: true });
  } catch (error) {
    logger.logError('Admin users PATCH error', error);
    return apiServerError();
  }
}
