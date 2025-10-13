import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

const COOKIE_NAME = 'pm_email';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Set cookie for session
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // ~180 days
  });

  // ---- SAVE EMAIL TO VERCEL BLOB ----
  try {
    const record = {
      email,
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    await put(
      `emails/${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
      JSON.stringify(record, null, 2),
      {
        access: 'public',           // <-- must be 'public' with current SDK
        contentType: 'application/json',
        addRandomSuffix: true,
      }
    );
  } catch (err) {
    console.error('Failed to store email log:', err);
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}