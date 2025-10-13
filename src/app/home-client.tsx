'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

type ApiRaw = {
  blocked?: boolean;
  reason?: string;
  imageUrl?: string;
  uploadId?: string;
  emotion?: { label?: string; confidence?: number };
  breed_guess?: { label?: string; confidence?: number };
  mood_reason?: string;
  activity_suggestion?: string;
  toy_ideas?: string[];
  recommended_treat?: string;
  favorite_treat?: string;
  care?: { teeth?: string; paws?: string; eyes?: string };
  cta_links?: { label?: string; url?: string }[];
};

type ApiError = { error: string };

const s = (v: unknown, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
const lc = (t: string) => t.toLowerCase();

function titleCase(input: string): string {
  const small = new Set(['and','or','the','a','an','to','of','in','on','for','at','by','with','from']);
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z0-9]{2,}$/.test(w)) return w;
      if (i > 0 && small.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/\b(Ai|Usa|Uk|Id)\b/g, (m) => m.toUpperCase());
}
const tc = (v: unknown, fb = '') => titleCase(s(v, fb));

/** Map breed/label hints to a species label for UI phrasing. */
function speciesFromBreed(label: string): string {
  const L = lc(label || '');
  if (/\b(cat|feline|siamese|maine coon|ragdoll|tabby)\b/.test(L)) return 'Cat';
  if (/\b(dog|canine|shepherd|retriever|bulldog|poodle|terrier|dachshund|chihuahua|shiba|husky)\b/.test(L)) return 'Dog';
  if (/\b(bird|parrot|cockatiel|budgie|finch|macaw)\b/.test(L)) return 'Bird';
  if (/\b(rabbit|bunny)\b/.test(L)) return 'Rabbit';
  if (/\b(hamster|gerbil|guinea pig|ferret)\b/.test(L)) return 'Small Pet';
  if (/\b(reptile|lizard|gecko|iguana|snake|python|turtle|tortoise)\b/.test(L)) return 'Reptile';
  if (/\b(fish|betta|goldfish|cichlid)\b/.test(L)) return 'Fish';
  return 'Pet';
}

/** Make vague tips concrete & step-by-step. NO generic catch-all fallback. */
function enrichCareTip(text: string): string {
  let t = s(text).trim();

  // Upgrade common vague phrases into concrete, single actions
  t = t.replace(/check for debris\b\.?/i,
    'Check for debris between paw pads; remove with a damp cloth and snip tiny mats using blunt-nose scissors (don’t pull).'
  );
  t = t.replace(/clean teeth\b\.?/i,
    'Brush teeth with pet-safe toothpaste tonight (30–60s per side); heavy tartar → schedule a dental exam.'
  );
  t = t.replace(/trim nails\b\.?/i,
    'Trim nails just above the quick; if unsure, use a grinder and take tiny passes once a week.'
  );
  t = t.replace(/wipe eyes\b\.?/i,
    'Wipe tear stains with sterile saline on a soft pad; yellow/green discharge → vet check.'
  );
  t = t.replace(/groom coat\b\.?/i,
    'Brush the coat in sections toward growth; for a mat, hold hair at the base and work slowly with detangler.'
  );

  // If still too short or generic, return empty to trigger mood-specific fallback
  if (t.length < 24 || /not clearly visible/i.test(t)) return '';

  return t;
}

/** Choose ONE actually useful care tip; guarantee something actionable and specific. */
function pickUsefulCareTip(care: ApiRaw['care'] | undefined, emotionLabel: string): string {
  const candidates = [s(care?.teeth), s(care?.paws), s(care?.eyes)]
    .map((x) => tc(x))         // <-- wrap tc to avoid passing index/array
    .map((x) => enrichCareTip(x))
    .filter(Boolean);

  if (candidates[0]) return candidates[0];

  // If nothing actionable from the model, synthesize ONE precise action from mood
  const mood = lc(s(emotionLabel));
  if (/angry|anxious|fearful|stressed/.test(mood)) {
    return 'Create a calm space: lights low, white-noise on; offer a long-lasting chew for 10–15 minutes to reduce arousal.';
  }
  if (/bored/.test(mood)) {
    return 'Scatter-feed ¼ cup of kibble across a snuffle mat to provide scent work and slow eating.';
  }
  if (/tired/.test(mood)) {
    return 'Offer water and a quiet bed; postpone vigorous play and reassess energy in 30 minutes.';
  }
  if (/sad/.test(mood)) {
    return 'Use a lick mat with xylitol-free peanut butter for 5–10 minutes of calming oral enrichment.';
  }
  if (/excited|playful|happy|curious|alert/.test(mood)) {
    return 'After play, inspect paw pads for abrasions; wipe with pet-safe wipes and let them dry fully.';
  }

  // Last-resort single, concrete action (not a generic checklist)
  return 'Brush teeth with pet-safe toothpaste tonight (30–60s per side); book a dental cleaning if tartar is heavy.';
}


/** Assertive, species-aware “Why” — removes “The Pet is The Dog is…” and polishes wording. */
function makeAssertiveWhySpecies(input: string, species: string): string {
  let t = s(input).trim();
  if (!t) return '';

  // Normalize hedging
  t = t.replace(/\b(appears to be|appears|seems to be|seems)\b/gi, 'is');

  // Remove any leading "The pet is", "The animal is", and repeated "The <Species> is"
  t = t.replace(/^\s*(the\s+(pet|animal)\s+is\s+)/i, '');
  // Remove duplicates like "The Dog is The Dog is ..."
  t = t.replace(new RegExp(`^\\s*The\\s+${species}\\s+is\\s+`, 'i'), '');
  t = t.replace(new RegExp(`^\\s*The\\s+${species}\\s+is\\s+`, 'i'), ''); // run twice to be safe

  // Improve connectors & terms
  t = t.replace(/\s+or\s+/gi, ' and ');
  t = t.replace(/\bgrowl\b/gi, 'growling');
  t = t.replace(/\baggression\b/gi, 'aggressive behavior');
  t = t.replace(/\bshowing\s+showing\b/gi, 'showing ');

  // Ensure it reads naturally after our removals
  // If it starts with "is", prepend a subject
  t = t.replace(/^\s*is\s+/i, '');
  // Lowercase first word to blend with "The Dog is ..."
  t = t.replace(/^([A-Z])/, (m) => m.toLowerCase());

  // Final build
  let out = `The ${species} is ${t}`;
  // Clean any accidental "is is"
  out = out.replace(/\bis\s+is\b/gi, 'is ');
  // Punctuate
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

/** Reusable Analyze button (always under the preview in this layout). */
function AnalyzeBtn({
  onClick,
  disabled,
  loading,
  className = '',
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pm-primary ${disabled ? 'pm-disabled' : ''} ${className}`}
    >
      {loading ? (
        <span className="pm-inline">
          <span className="pm-spinner" aria-hidden="true" />
          <span>Analyzing…</span>
        </span>
      ) : (
        'Analyze'
      )}
    </button>
  );
}

export default function HomeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeKB, setSizeKB] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ApiRaw | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const timerRef = useRef<number | null>(null);
  const STEP_MS = 2000;

  // Reveal animation timing
  useEffect(() => {
    if (!result || result.blocked) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setRevealStep(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const id = window.setInterval(() => {
      setRevealStep((n) => {
        if (n >= 9) {
          clearInterval(id);
          timerRef.current = null;
          return n;
        }
        return n + 1;
      });
    }, STEP_MS);

    timerRef.current = id;
    return () => clearInterval(id);
  }, [animKey, result]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setSizeKB(Math.round(f.size / 1024));
    setResult(null);
    setErr(null);
  }

  function isApiError(x: unknown): x is ApiError {
    return typeof x === 'object' && x !== null && 'error' in x && typeof (x as { error: unknown }).error === 'string';
  }

  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: form });
      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = 'Please upload a clear photo of your pet.';
        if (isApiError(data)) msg = data.error;
        setErr(msg);
        setResult(null);
        return;
      }

      setResult(data as ApiRaw);
      setAnimKey((k) => k + 1);
    } catch (e) {
      console.error('Analyze error:', e);
      setErr('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const view = useMemo(() => {
    if (!result || result.blocked) return null;

    const breedLabel = tc(result.breed_guess?.label || '');
    const species = speciesFromBreed(breedLabel);
    const breedConf = Math.round((result.breed_guess?.confidence ?? 0) * 100);
    const breed = breedLabel ? `${breedLabel} (${breedConf}%)` : 'Best Guess (Low Confidence)';

    const emotionLabel = tc(result.emotion?.label || '');
    const emotionConf = Math.round((result.emotion?.confidence ?? 0) * 100);

    // Why — assertive + species-aware; no duplicates
    const whyRaw = tc(result.mood_reason || '');
    const why = makeAssertiveWhySpecies(whyRaw, species);

    const activity = tc(result.activity_suggestion || '');
    const toys = (result.toy_ideas || []).map((t) => tc(t)).slice(0, 2);
    const treat = tc(result.recommended_treat || result.favorite_treat || '');

    // Exactly ONE actionable care tip
    const careOne = pickUsefulCareTip(result.care, emotionLabel);

    const ctas = (result.cta_links || []).filter((c) => c?.label && c?.url);

    return { species, breed, emotionLabel, emotionConf, why, activity, toys, treat, careOne, ctas };
  }, [result]);

  return (
    <main className="pm-wrap">
      <div className="pm-shell pm-centered">
        <header className="pm-header">
          <div className="pm-brand">
            <span className="pm-logo">🐾</span>
            <h1>Pet Mood</h1>
            <span className="pm-chip">AI</span>
          </div>
          <p>Discover your pet’s mood, species, and care tips instantly.</p>
        </header>

        <section className="pm-card">
          {/* Upload Section — vertical: button → preview → analyze */}
          <div className="pm-uploader pm-uploader-vertical">
            <label className="pm-uploadBtn">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPick}
                style={{ display: 'none' }}
              />
              <span>Take / Choose Photo</span>
            </label>

            {preview && (
              <div className="pm-preview pm-previewCenter">
                <Image
                  className="pm-img"
                  src={preview}
                  alt="preview"
                  width={360}
                  height={360}
                  style={{ width: '100%', height: 'auto' }}
                  unoptimized
                  priority
                />
                <div className="pm-meta">~{sizeKB} KB</div>
              </div>
            )}

            <AnalyzeBtn onClick={onAnalyze} disabled={loading || !file} loading={loading} />

            {err && (
              <div className="pm-alert">
                <strong>Error:</strong> {err}
              </div>
            )}
            {result?.blocked && <div className="pm-note">Please upload a clear pet photo.</div>}
          </div>

          {/* Results Section */}
          {view && (
            <div className="pm-resultPanel pm-resultFixed">
              <h3>Result</h3>
              <div className="pm-rows">
                <Reveal step={revealStep} index={1}>
                  <Row label="Breed" value={view.breed} />
                </Reveal>
                <Reveal step={revealStep} index={2}>
                  <Row label="Emotion" value={`${view.emotionLabel} (${view.emotionConf}%)`} />
                </Reveal>
                <Reveal step={revealStep} index={3}>
                  <Row label="Why" value={view.why} />
                </Reveal>
                <Reveal step={revealStep} index={4}>
                  <Row label="Suggested Activity" value={view.activity} />
                </Reveal>
                <Reveal step={revealStep} index={5}>
                  <Row label="Toy Ideas" value={view.toys.join('\n')} />
                </Reveal>
                <Reveal step={revealStep} index={6}>
                  <Row label="Recommended Treat" value={view.treat} />
                </Reveal>
                <Reveal step={revealStep} index={7}>
                  <Row label="Care Tip" value={view.careOne} />
                </Reveal>
              </div>

              <Reveal step={revealStep} index={8}>
                {(view.ctas || []).length > 0 && (
                  <div className="pm-ctas">
                    {view.ctas!.map((c, i) => (
                      <a key={i} className="pm-cta" href={c.url} target="_blank" rel="noreferrer">
                        {c.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </Reveal>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="pm-bubbleRowCard">
      <div className="pm-bubbleRow">
        <div className="pm-bubbleLabel">{label}</div>
        <div className="pm-bubbleValue" style={{ whiteSpace: 'pre-line' }}>{value}</div>
      </div>
    </div>
  );
}

function Reveal({ step, index, children }: { step: number; index: number; children: React.ReactNode }) {
  const visible = step >= index;
  return (
    <div className={`pm-reveal ${visible ? 'show' : 'hide'}`} aria-hidden={!visible}>
      {visible ? children : null}
    </div>
  );
}
