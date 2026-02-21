import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isLocale } from '@/i18n';

/**
 * POST /api/user/locale
 * Persists the user's locale preference to their profile.
 * Used by LocaleContext.setLocale() so cron jobs can send
 * emails in the user's preferred language.
 */
export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();

    if (!isLocale(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not authenticated — just ignore (cookie still works)
      return NextResponse.json({ ok: true });
    }

    // Read current preferences and merge locale
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
    await supabase
      .from('profiles')
      .update({ preferences: { ...currentPrefs, locale } } as never)
      .eq('id', user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Fail silently
  }
}
