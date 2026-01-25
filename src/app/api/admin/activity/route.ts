import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

interface ActivityRecord {
  id: number;
  user_id: string;
  action_type: string;
  page_path: string | null;
  listing_id: number | null;
  search_query: string | null;
  duration_seconds: number | null;
  created_at: string;
  profiles: {
    email: string;
    display_name: string | null;
  } | null;
}

type ActivityQueryResult = {
  data: ActivityRecord[] | null;
  count: number | null;
  error: { message: string } | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const userFilter = searchParams.get('user') || '';
    const actionType = searchParams.get('action_type') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const format = searchParams.get('format') || '';
    const offset = (page - 1) * limit;

    // Type assertion for user_activity table
    type UserActivityTable = ReturnType<typeof supabase.from>;

    // Build query for user_activity table
    // Use left join (no !inner) to include activities even if profile is missing
    let query = (supabase.from('user_activity') as unknown as UserActivityTable)
      .select(`
        id,
        user_id,
        action_type,
        page_path,
        listing_id,
        search_query,
        duration_seconds,
        created_at,
        profiles(email, display_name)
      `, { count: 'exact' });

    // Apply filters
    if (userFilter) {
      // Filter by user email or ID
      query = query.or(`user_id.eq.${userFilter},profiles.email.ilike.%${userFilter}%`);
    }

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`);
    }

    // For CSV export, get all matching records (with reasonable limit)
    if (format === 'csv') {
      const { data: allActivity, error } = await query
        .order('created_at', { ascending: false })
        .limit(10000) as ActivityQueryResult;

      if (error) {
        logger.error('Activity export error', { error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Convert to CSV
      const csv = convertToCSV(allActivity || []);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activity-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    const { data: activity, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1) as ActivityQueryResult;

    if (error) {
      logger.error('Activity query error', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format response
    const formattedActivity = activity?.map(record => {
      const { profiles, ...rest } = record;
      return {
        ...rest,
        user: profiles,
      };
    }) || [];

    return NextResponse.json({
      activity: formattedActivity,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    logger.logError('Admin activity error', error);
    return apiServerError();
  }
}

function convertToCSV(data: ActivityRecord[]): string {
  const headers = [
    'ID',
    'User ID',
    'User Email',
    'User Name',
    'Action Type',
    'Page Path',
    'Listing ID',
    'Search Query',
    'Duration (seconds)',
    'Timestamp',
  ];

  const rows = data.map(record => [
    record.id,
    record.user_id,
    record.profiles?.email || '',
    record.profiles?.display_name || '',
    record.action_type,
    record.page_path || '',
    record.listing_id || '',
    record.search_query || '',
    record.duration_seconds || '',
    record.created_at,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        // Escape quotes and wrap in quotes if contains comma or quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  return csvContent;
}
