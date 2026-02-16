/**
 * Middleware for authentication and authorization.
 *
 * NOTE: Next.js 16+ deprecates the "middleware" file convention in favor of "proxy".
 * This is a known warning that will be addressed in a future refactor. The current
 * implementation continues to work correctly.
 * See: https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { findCategoryRedirect } from '@/lib/seo/categories';

export async function middleware(request: NextRequest) {
  // Canonical redirect: /?type=katana → /swords/katana (301)
  // Only fires on bare category-param URLs (no tab, sort, dealer, q, etc.)
  if (request.nextUrl.pathname === '/' && request.nextUrl.search) {
    const redirectRoute = findCategoryRedirect(request.nextUrl.searchParams);
    if (redirectRoute) {
      const url = request.nextUrl.clone();
      url.pathname = redirectRoute;
      url.search = '';
      return NextResponse.redirect(url, 301);
    }
  }

  // Skip middleware if Supabase credentials aren't available (during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if needed - this is important for the session to stay active
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('login', 'admin');
      return NextResponse.redirect(url);
    }

    // Check if user is admin (using role column)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Protect /api/admin routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    // Allow API-key authenticated requests (webhooks from Yuhinkai)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-cron-secret');

    const hasValidApiKey = cronSecret && (
      authHeader === `Bearer ${cronSecret}` ||
      cronHeader === cronSecret
    );

    if (hasValidApiKey) {
      // API key auth - let the route handler process it
      return supabaseResponse;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (using role column)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null };

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
