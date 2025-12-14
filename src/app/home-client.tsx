'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import MonetizationCTAs from '../components/MonetizationCTAs';

// Optional analytics globals
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
  }
}

function safeFbq(...args: any[]) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq(...args);
    }
  } catch {
    // ignore
  }
}

function safeGtag(...args: any[]) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag(...args);
    }
  } catch {
    // ignore
  }
}

// Wait for Meta Pixel to be ready before firing an event (prevents missing events due to async load)
function fireFbqWhenReady(callback: () => void, timeoutMs = 2000) {
  const start = Date.now();

  const tick = () => {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      callback();
      return;
    }
    if (Date.now() - start >= timeoutMs) return;
    setTimeout(tick, 50);
  };

  tick();
}

/* -------------------- FIRST-PARTY EVENT LOGGER -------------------- */
async function logEvt(type: string, data: Record<string, unknown> = {}) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

/* Small cookie helper (to read which CTA variant the user was assigned) */
function getCookie(name: string) {
  return document.cookie.split('; ').find((r) => r.startsWith(name + '='))?.split('=')[1];
}

/* -------------------- API TYPES -------------------- */
type ApiRaw = {
  blocked?: boolean;
  reason?: string;
  imageUrl?: string;
  uploadId?: string;
  emotion?: { label?: string; confidence?: number };
  breed_guess?: { label?: string; confidence?: number };
  activity_suggestion?: string;
  toy_ideas?: string[];
  recommended_treat?: string;
  favorite_treat?: string;
  care?: { teeth?: string; paws?: string; eyes?: string };
  cta_links?: { label?: string; url?: string }[];
};

type ApiError = { error: string };

/* -------------------- TEXT UTILS -------------------- */
const s = (v: unknown, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
const lc = (t: string) => t.toLowerCase();

function titleCase(input: string): string {
  const small = new Set([
    'and',
    'or',
    'the',
    'a',
    'an',
    'to',
    'of',
    'in',
    'on',
    'for',
    'at',
    'by',
    'with',
    'from',
  ]);
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

/* -------------------- DOMAIN HELPERS -------------------- */
function speciesFromBreed(label: string): string {
  const L = lc(label || '');
  if (/\b(cat|feline|siamese|maine coon|ragdoll|tabby)\b/.test(L)) return 'Cat';
  if (/\b(dog|canine|shepherd|retriever|bulldog|poodle|terrier|dachshund|chihuahua|shiba|husky)\b/.test(L))
    return 'Dog';
  if (/\b(bird|parrot|cockatiel|budgie|finch|macaw)\b/.test(L)) return 'Bird';
  if (/\b(rabbit|bunny)\b/.test(L)) return 'Rabbit';
  if (/\b(hamster|gerbil|guinea pig|ferret)\b/.test(L)) return 'Small Pet';
  if (/\b(reptile|lizard|gecko|iguana|snake|python|turtle|tortoise)\b/.test(L)) return 'Reptile';
  if (/\b(fish|betta|goldfish|cichlid)\b/.test(L)) return 'Fish';
  return 'Pet';
}

/** Make vague tips concrete & step-by-step. */
function enrichCareTip(text: string): string {
  let t = s(text).trim();

  t = t.replace(
    /check for debris\b\.?/i,
    'Check for debris between paw pads; remove with a damp cloth and snip tiny mats using blunt-nose scissors (don’t pull).',
  );
  t = t.replace(
    /clean teeth\b\.?/i,
    'Brush teeth with pet-safe toothpaste tonight (30–60s per side); heavy tartar → schedule a dental exam.',
  );
  t = t.replace(
    /trim nails\b\.?/i,
    'Trim nails just above the quick; if unsure, use a grinder and take tiny passes once a week.',
  );
  t = t.replace(
    /wipe eyes\b\.?/i,
    'Wipe tear stains with sterile saline on a soft pad; yellow/green discharge → vet check.',
  );
  t = t.replace(
    /groom coat\b\.?/i,
    'Brush the coat in sections toward growth; for a mat, hold hair at the base and work slowly with detangler.',
  );

  if (t.length < 24 || /not clearly visible/i.test(t)) return '';
  return t;
}

/** Choose ONE actually useful care tip. */
function pickUsefulCareTip(care: ApiRaw['care'] | undefined, emotionLabel: string): string {
  const candidates = [s(care?.teeth), s(care?.paws), s(care?.eyes)]
    .map((x) => tc(x))
    .map((x) => enrichCareTip(x))
    .filter(Boolean);

  if (candidates[0]) return candidates[0];

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

  return 'Brush teeth with pet-safe toothpaste tonight (30–60s per side); book a dental cleaning if tartar is heavy.';
}

/* -------------------- UI: Analyze button -------------------- */
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

/* -------------------- MAIN -------------------- */
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
        if (n >= 8) {
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
    return (
      typeof x === 'object' &&
      x !== null &&
      'error' in x &&
      typeof (x as { error: unknown }).error === 'string'
    );
  }

  /* -------------------- TRACKED ANALYZE FLOW -------------------- */
  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setErr(null);

    // First-party event: user started an upload
    logEvt('Upload_Start');

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

      const payload = data as ApiRaw;
      setResult(payload);
      setAnimKey((k) => k + 1);

      // First-party “completed” event
      if (payload?.uploadId) {
        logEvt('Upload_Complete', { uploadId: payload.uploadId });
      } else {
        logEvt('Upload_Complete');
      }

      // 🔵 Fire Meta (Facebook) custom event for successful, unblocked photo analysis
      if (!payload.blocked) {
        const variant = getCookie('pm_variant');

        fireFbqWhenReady(() => {
          window.fbq?.('trackCustom', 'PhotoUpload', {
            uploadId: payload.uploadId ?? null,
            variant: variant ?? null,
            emotion: payload.emotion?.label ?? null,
            breed: payload.breed_guess?.label ?? null,
          });
        });
      }
    } catch (e) {
      console.error('Analyze error:', e);
      setErr('Analyze failed');
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

    const activity = tc(result.activity_suggestion || '');
    const toys = (result.toy_ideas || []).map((t) => tc(t)).slice(0, 2);
    const treat = tc(result.recommended_treat || result.favorite_treat || '');

    const careOne = pickUsefulCareTip(result.care, emotionLabel);

    const ctas = (result.cta_links || []).filter((c) => c?.label && c?.url);

    return { species, breed, emotionLabel, emotionConf, activity, toys, treat, careOne, ctas };
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
          <div className="pm-uploader pm-uploader-vertical">
            {/* File input (visually hidden but clickable via label) */}
            <input
              id="pm-file"
              type="file"
              accept="image/*"
              onChange={onPick}
              // Do NOT use the `capture` attribute if you want the chooser.
              // Keep the element focusable; don't use display:none on iOS.
              style={{
                position: 'absolute',
                left: '-9999px',
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />
            <label className="pm-uploadBtn" htmlFor="pm-file">
              <span>Upload or Take Photo</span>
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
                  <Row label="Suggested Activity" value={view.activity} />
                </Reveal>
                <Reveal step={revealStep} index={4}>
                  <Row label="Toy Ideas" value={view.toys.join('\n')} />
                </Reveal>
                <Reveal step={revealStep} index={5}>
                  <Row label="Recommended Treat" value={view.treat} />
                </Reveal>
                <Reveal step={revealStep} index={6}>
                  <Row label="Care Tip" value={view.careOne} />
                </Reveal>
              </div>

              <Reveal step={revealStep} index={7}>
                <MonetizationCTAs uploadId={result?.uploadId} />
              </Reveal>

              <Reveal step={revealStep} index={8}>
                {(view.ctas || []).length > 0 && (
                  <div className="pm-ctas">
                    {view.ctas!.map((c, i) => (
                      <a
                        key={i}
                        className="pm-cta"
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          const variant = getCookie('pm_variant');
                          logEvt('Product_Click', {
                            variant,
                            label: c.label,
                            url: c.url,
                            uploadId: result?.uploadId,
                          });
                          fireFbqWhenReady(() => {
                            safeFbq('trackCustom', 'Product_Click', {
                              variant,
                              label: c.label,
                              uploadId: result?.uploadId,
                            });
                          });
                          safeGtag('event', 'Product_Click', {
                            variant,
                            label: c.label,
                            uploadId: result?.uploadId,
                          });
                        }}
                      >
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

/* -------------------- UI Bits -------------------- */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="pm-bubbleRowCard">
      <div className="pm-bubbleRow">
        <div className="pm-bubbleLabel">{label}</div>
        <div className="pm-bubbleValue" style={{ whiteSpace: 'pre-line' }}>
          {value}
        </div>
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