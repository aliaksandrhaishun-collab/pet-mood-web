import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// per-user session id (non-PII)
async function ensureSession() {
  const jar = await cookies(); // <-- await (Next 15 typing)
  let sid = jar.get('pm_sid')?.value;

  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    // set a non-HTTPOnly, Lax cookie for attribution
    jar.set('pm_sid', sid, {
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 180, // 180 days
    });
  }
  return sid;
}

export async function POST(req: NextRequest) {
  try {
    const sid = await ensureSession(); // <-- await
    const payload = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const evt = {
      ts: now,
      sid,
      type: String(payload.type || ''),
      variant: String(payload.variant || ''),
      uploadId: String(payload.uploadId || ''),
      label: String(payload.label || ''),
      url: String(payload.url || ''),
      price: String(payload.price || ''),
      ua: req.headers.get('user-agent') || '',
    };

    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
    const key = `events/${evt.type}/${now.slice(0,10)}/${id}`;

    await put(key, JSON.stringify(evt), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('event log error', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}