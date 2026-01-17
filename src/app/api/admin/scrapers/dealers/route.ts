import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Try to get active dealers (table may not exist)
    try {
      const { data: dealers, error } = await supabase
        .from('dealers')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        // Table doesn't exist - return empty list
        console.log('dealers table not available:', error.message);
        return NextResponse.json({ dealers: [] });
      }

      return NextResponse.json({ dealers: dealers || [] });
    } catch (e) {
      // Table doesn't exist
      return NextResponse.json({ dealers: [] });
    }
  } catch (error) {
    console.error('Dealers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
