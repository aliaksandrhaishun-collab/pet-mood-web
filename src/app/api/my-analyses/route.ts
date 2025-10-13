import { NextResponse, NextRequest } from 'next/server';
import { list } from '@vercel/blob';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IndexRecord = {
  id: string;
  emailHash: string;
  metaPath: string;
  imagePath: string;
  createdAt: string;
};

type MetaRecord = {
  id: string;
  emailHash: string;
  imagePath: string;
  imageUrl: string;
  size: number;
  mime: string;
  result: {
    emotion: string;
    action_desire: string;
    breed_guess: { label: string; confidence: number };
    toy_recos: string[];
    cute_attribute: string;
  };
  createdAt: string;
};

export async function GET(req: NextRequest) {
  // 1) Require email cookie
  const email = req.cookies.get('pm_email')?.value;
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 401 });
  }

  // 2) Compute same hash we wrote during /api/analyze
  const emailHash = crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex');

  // 3) List all index files for this user
  const prefix = `email-index/${emailHash}/`;
  const { blobs } = await list({ prefix });

  if (!blobs.length) {
    return NextResponse.json({ emailHash, items: [] });
  }

  // 4) For each index file, fetch it, then fetch the full meta JSON it points to
  const items: MetaRecord[] = [];
  for (const b of blobs) {
    try {
      const idxRes = await fetch(b.url);
      if (!idxRes.ok) continue;

      const idx: IndexRecord = (await idxRes.json()) as IndexRecord;

      // Load the full analysis metadata
      const metaUrl = new URL(idx.metaPath, b.url);
      // b.url is like https://blob.vercel-storage.com/…/email-index/hash/id.json
      // new URL with a relative path replaces after the host, so we ensure same base:
      metaUrl.pathname = metaUrl.pathname.replace(
        /email-index\/.+$/,
        idx.metaPath
      );

      const metaRes = await fetch(metaUrl.toString());
      if (!metaRes.ok) continue;

      const meta = (await metaRes.json()) as MetaRecord;
      items.push(meta);
    } catch {
      // skip malformed entries
    }
  }

  // Sort newest first
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ emailHash, count: items.length, items });
}
