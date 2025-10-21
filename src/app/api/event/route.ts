import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// per-user session id (non-PII)
function ensureSession() {
  const jar = cookies();
  let sid = jar.get('pm_sid')?.value;
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    jar.set('pm_sid', sid, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60*60*24*180 });
  }
  return sid;
}

export async function POST(req: NextRequest) {
  try {
    const sid = ensureSession();
    const payload = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const evt = {
      ts: now,
      sid,                           // ← lets you count per user
      type: String(payload.type || ''),
      variant: String(payload.variant || ''),
      uploadId: String(payload.uploadId || ''),
      label: String(payload.label || ''),      // e.g., product label
      url: String(payload.url || ''),          // e.g., product url
      price: String(payload.price || ''),      // e.g., WTP price
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