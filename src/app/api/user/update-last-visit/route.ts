import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/update-last-visit
 * Updates the user's last_visit_at timestamp to the current time.
 * Called when the user views the browse page.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ last_visit_at: new Date().toISOString() } as never)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating last_visit_at:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update last visit API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
