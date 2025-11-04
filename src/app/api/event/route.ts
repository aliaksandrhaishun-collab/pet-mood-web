import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 👇 read the linked Blob secret from env
const BLOB_TOKEN = process.env.BLOBV2_READ_WRITE_TOKEN;

async function ensureSession() {
  const jar = await cookies(); // ok for your setup
  let sid = jar.get('pm_sid')?.value;

  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    jar.set('pm_sid', sid, {
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return sid;
}

export async function POST(req: NextRequest) {
  try {
    // (optional) fail fast if the token is not present in the env
    if (!BLOB_TOKEN) {
      console.error('Blob token missing: set BLOBV2_READ_WRITE_TOKEN in env');
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const sid = await ensureSession();
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

    // safer, unique key
    const nonce = Math.random().toString(36).slice(2, 10);
    const key = `events/${evt.type || 'Unknown'}/${now.slice(0,10)}/${Date.now()}-${nonce}.json`;

    await put(key, JSON.stringify(evt), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
      token: BLOB_TOKEN,              // 👈 pass the token here
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