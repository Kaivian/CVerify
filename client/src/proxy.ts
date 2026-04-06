import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from './lib/constants/auth.constants';

const SUPPORTED_LANGS = ['vi', 'en'];
const DEFAULT_LANG = 'vi';
const LANG_COOKIE_NAME = 'i18next';

function handleLocale(request: NextRequest, response: NextResponse): void {
  const { cookies, headers } = request;
  let locale = cookies.get(LANG_COOKIE_NAME)?.value;

  if (!locale) {
    const acceptLang = headers.get('accept-language');
    if (acceptLang) {
      const preferred = acceptLang
        .split(',')
        .map((lang) => lang.split(';')[0].trim().substring(0, 2).toLowerCase())
        .find((lang) => SUPPORTED_LANGS.includes(lang));

      if (preferred) {
        locale = preferred;
      }
    }
  }

  if (!locale || !SUPPORTED_LANGS.includes(locale)) {
    locale = DEFAULT_LANG;
  }

  if (cookies.get(LANG_COOKIE_NAME)?.value !== locale) {
    response.cookies.set(LANG_COOKIE_NAME, locale, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
    });
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';
  
  // Extract tokens from cookies, aligned with C# snake_case cookie naming
  const accessToken = request.cookies.get('access_token')?.value;

  // Define route classifications
  const isDashboardRoute = ['/admin', '/business', '/user', '/chat'].some(p => pathname.startsWith(p));

  // Development environment gated edge logging to prevent production data leakage
  if (isDev) {
    console.log(
      `[Security Proxy] Route: ${pathname} | Token Present: ${!!accessToken}`
    );
  }

  // 1. Protecting Dashboard Sub-Routes (Coarse Gating)
  if (isDashboardRoute) {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!accessToken && !refreshToken) {
      const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
      const redirectUrl = new URL(`${ROUTES.LOGIN}?callbackUrl=${callbackUrl}`, request.url);
      
      if (isDev) {
        console.log(`[Security Proxy] Both access and refresh tokens missing. Redirecting to login: ${redirectUrl.toString()}`);
      }

      // Clean cookies on redirect to clear potentially broken sessions
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      handleLocale(request, response);
      return response;
    }
  }

  const response = NextResponse.next();
  handleLocale(request, response);
  return response;
}

// Next.js Proxy matcher configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public folder items)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
