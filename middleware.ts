// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * No-op middleware
 * Email gate removed — allow all requests to proceed.
 * We keep this file to make it easy to reintroduce rules later.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

/**
 * Disable matching so the middleware does not intercept any paths.
 * (Leaving this file in place avoids a framework cold start cost later.)
 */
export const config = { matcher: [] };