import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Handle Supabase auth callback
 * This route handles the callback from magic link emails and OAuth providers
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? '/';

  // Prevent open redirect: only allow relative paths starting with /
  // Block protocol-relative URLs (//evil.com) and absolute URLs
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful authentication - redirect to the intended destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's an error or no code, redirect to home with error
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
