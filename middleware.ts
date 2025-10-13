import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'pm_email';
const PUBLIC = new Set([
  '/join',
  '/api/session',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/privacy',
  '/contact',
]);

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const email = req.cookies.get(COOKIE_NAME)?.value;

  // Allow Next internals and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Allow public paths; if already "signed in", bounce /join back to next or /
  if ([...PUBLIC].some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (pathname.startsWith('/join') && email) {
      const next = searchParams.get('next') || '/';
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  // Gate everything else
  if (!email) {
    const url = new URL('/join', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|static).*)'] };
