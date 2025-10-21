import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * SYSTEM prompt: does both pet validation and concise structured output.
 */
const SYSTEM = `You first decide if the image clearly shows an ANIMAL (any species).
If it does NOT, return ONLY:
{"blocked": true, "reason": "Please upload a clear photo of a pet or animal."}

If it DOES show an animal, return ONE JSON object ONLY (no extra text):
{
  "emotion": { "label": one of ["Happy","Excited","Relaxed","Content","Curious","Playful","Alert","Bored","Anxious","Stressed","Fearful","Sad","Angry","Tired"], "confidence": [0,1] },
  "activity_suggestion": string,
  "breed_guess": { "label": string, "confidence": [0,1] },
  "toy_ideas": string[],   // 2 concise items, each formatted "Toy — why it fits"
  "recommended_treat": string,
  "care": { "teeth": string, "paws": string, "eyes": string }
}
Rules:
- NO positivity bias; choose negative labels when warranted.
- Breed/species: single plausible guess (never "unknown"); lower confidence if unsure.
- "toy_ideas": only 2, distinct, use varied phrasing across runs.
- "care": exactly one actionable tip per field; if a region isn’t visible, say "Not Clearly Visible".
- Keep text concise, factual, JSON only.
- Vary wording naturally based on visible cues — avoid repeating stock phrases.`;

type EmotionRaw = { label?: unknown; confidence?: unknown };
type BreedRaw = { label?: unknown; confidence?: unknown };
type CareRaw = { teeth?: unknown; paws?: unknown; eyes?: unknown };

type Parsed = {
  blocked?: boolean;
  reason?: string;
  emotion?: EmotionRaw | unknown;
  activity_suggestion?: unknown;
  breed_guess?: BreedRaw | unknown;
  toy_ideas?: unknown;
  recommended_treat?: unknown;
  favorite_treat?: unknown;
  care?: CareRaw | unknown;
};

type SafeResult = {
  blocked?: boolean;
  reason?: string;
  emotion: { label: string; confidence: number };
  activity_suggestion: string;
  breed_guess: { label: string; confidence: number };
  toy_ideas: string[];
  recommended_treat: string;
  care: { teeth: string; paws: string; eyes: string };
};

function toStr(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : v == null ? fb : String(v);
}
function toNum01(v: unknown, fb = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return fb;
  return Math.max(0, Math.min(1, n));
}
function toStringArray2(v: unknown): string[] {
  const base: string[] = Array.isArray(v) ? v.map((x) => toStr(x)).filter(Boolean) : [];
  const uniq = Array.from(new Set(base));
  return uniq.slice(0, 2);
}
function asRecord(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
}

const EMOTION_SET = new Set([
  'Happy','Excited','Relaxed','Content','Curious','Playful','Alert',
  'Bored','Anxious','Stressed','Fearful','Sad','Angry','Tired'
]);
function sanitizeEmotionLabel(s: string): string {
  const t = (s || '').trim();
  if (EMOTION_SET.has(t)) return t;
  const m = t.toLowerCase();
  if (m.includes('angry') || m.includes('mad')) return 'Angry';
  if (m.includes('sad')) return 'Sad';
  if (m.includes('fear')) return 'Fearful';
  if (m.includes('stress')) return 'Stressed';
  if (m.includes('anx')) return 'Anxious';
  if (m.includes('bored')) return 'Bored';
  if (m.includes('tired') || m.includes('sleep')) return 'Tired';
  if (m.includes('alert')) return 'Alert';
  if (m.includes('play')) return 'Playful';
  if (m.includes('curio')) return 'Curious';
  if (m.includes('content')) return 'Content';
  if (m.includes('relax') || m.includes('calm')) return 'Relaxed';
  if (m.includes('excite')) return 'Excited';
  if (m.includes('happy') || m.includes('joy')) return 'Happy';
  return 'Alert';
}

export async function POST(req: NextRequest) {
  try {
    const email = (await cookies()).get('pm_email')?.value || '';
    if (!email)
      return NextResponse.json({ error: 'Email required' }, { status: 401 });

    const form = await req.formData();
    const image = form.get('image');
    if (!(image instanceof File))
      return NextResponse.json({ error: 'No image' }, { status: 400 });

    const buf = Buffer.from(await image.arrayBuffer());
    const mime = image.type || 'image/jpeg';
    const base64 = buf.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    // One GPT call: validates + analyzes
    const resp = await client.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      text: { format: { type: 'json_object' } },
      input: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Analyze or block as instructed; return JSON only.' } as const,
            { type: 'input_image', image_url: dataUrl, detail: 'auto' } as const,
          ],
        },
      ],
    });

    const maybe = resp as unknown as { output_text?: string };
    const raw = toStr(maybe.output_text, '{}').trim();
    const prelim = JSON.parse(raw) as Parsed;

    // If not a pet or animal → block
    if (prelim.blocked)
      return NextResponse.json(
        { error: prelim.reason || 'Please upload a clear photo of your pet.' },
        { status: 400 }
      );

    const emotionrec = asRecord(prelim.emotion);
    const breedrec = asRecord(prelim.breed_guess);
    const carerec = asRecord(prelim.care);

    const safe: SafeResult = {
      emotion: {
        label: sanitizeEmotionLabel(toStr(emotionrec.label ?? '')),
        confidence: toNum01(emotionrec.confidence, 0.5),
      },
      activity_suggestion: toStr(prelim.activity_suggestion ?? '').slice(0, 120),
      breed_guess: {
        label: toStr(breedrec.label ?? '')
          .replace(/mixed|unknown|unidentifiable|breed\s*mix/gi, '')
          .trim()
          .slice(0, 60),
        confidence: toNum01(breedrec.confidence, 0.5),
      },
      toy_ideas: toStringArray2(prelim.toy_ideas),
      recommended_treat: toStr(prelim.recommended_treat ?? prelim.favorite_treat ?? '').slice(0, 60),
      care: {
        teeth: toStr(carerec.teeth ?? 'Not Clearly Visible').slice(0, 80),
        paws: toStr(carerec.paws ?? 'Not Clearly Visible').slice(0, 80),
        eyes: toStr(carerec.eyes ?? 'Not Clearly Visible').slice(0, 80),
      },
    };

    if (!safe.emotion.label) safe.emotion.label = 'Alert';
    if (!safe.breed_guess.label) {
      safe.breed_guess.label = 'Best Guess';
      safe.breed_guess.confidence = Math.min(safe.breed_guess.confidence, 0.5);
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const imgPath = `uploads/${id}.jpg`;
    const metaPath = `uploads/meta/${id}.json`;

    const record = {
      id,
      email,
      imagePath: imgPath,
      size: buf.byteLength,
      mime,
      result: safe,
      createdAt: new Date().toISOString(),
    };

    // Save blob and metadata concurrently
    const [img] = await Promise.all([
      put(imgPath, buf, { access: 'public', contentType: mime, addRandomSuffix: false }),
      put(metaPath, JSON.stringify(record, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      }),
    ]);

    // 🛒 Generate contextual product links
    const makeAmazonLink = (query: string) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=petmoodai-20`;

    const toyLinks = safe.toy_ideas.map((t) => ({
      label: t,
      url: makeAmazonLink(t),
    }));

    const treatLabel = safe.recommended_treat || 'pet treats';
    const treatLink = {
      label: `Buy ${treatLabel}`,
      url: makeAmazonLink(treatLabel),
    };

    const cta_links = [...toyLinks, treatLink];

    // Return everything
    return NextResponse.json({
      ...safe,
      uploadId: id,
      imageUrl: img.url,
      cta_links,
    });
  } catch (e) {
    console.error('analyze error', e);
    return NextResponse.json({ error: 'Analyze failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}