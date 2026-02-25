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
import { LOCALE_COOKIE } from '@/i18n';
import { GDPR_COOKIE, isGdprCountry } from '@/lib/consent/gdpr';

// ── Currency geo-detection ──
export const CURRENCY_COOKIE = 'nw-currency';

const EUROZONE_COUNTRIES = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
]);

function countryToCurrency(country: string): 'JPY' | 'EUR' | 'USD' {
  if (country === 'JP') return 'JPY';
  if (EUROZONE_COUNTRIES.has(country)) return 'EUR';
  return 'USD';
}

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

  // ── Locale detection ──
  // If the nw-locale cookie is absent, detect from IP country and set it.
  const localeCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const needsLocaleCookie = !localeCookie || (localeCookie !== 'en' && localeCookie !== 'ja');

  // ── GDPR region detection ──
  // If the nw-gdpr cookie is absent, detect from IP country and set it.
  // Cookie persists from first visit (no flip-flopping on VPN changes).
  const gdprCookie = request.cookies.get(GDPR_COOKIE)?.value;
  const needsGdprCookie = gdprCookie === undefined;

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

  // Protect /admin and /api/admin routes (single role query for both)
  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminPage || isAdminApi) {
    // Check API key bypass first (for /api/admin only)
    if (isAdminApi) {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = request.headers.get('authorization');
      const cronHeader = request.headers.get('x-cron-secret');
      if (cronSecret && (authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret)) {
        return supabaseResponse;
      }
    }

    if (!user) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('login', 'admin');
      return NextResponse.redirect(url);
    }

    // Single role query for both /admin and /api/admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if (profile?.role !== 'admin') {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // ── Set locale cookie if needed ──
  if (needsLocaleCookie) {
    const country = request.headers.get('x-vercel-ip-country') || '';
    const detectedLocale = country === 'JP' ? 'ja' : 'en';
    supabaseResponse.cookies.set(LOCALE_COOKIE, detectedLocale, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
    });
  }

  // ── Set GDPR region cookie if needed ──
  if (needsGdprCookie) {
    const country = request.headers.get('x-vercel-ip-country') || '';
    supabaseResponse.cookies.set(GDPR_COOKIE, isGdprCountry(country) ? '1' : '0', {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
    });
  }

  // ── Set currency cookie if needed ──
  const currencyCookie = request.cookies.get(CURRENCY_COOKIE)?.value;
  if (!currencyCookie) {
    const country = request.headers.get('x-vercel-ip-country') || '';
    supabaseResponse.cookies.set(CURRENCY_COOKIE, countryToCurrency(country), {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
    });
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
