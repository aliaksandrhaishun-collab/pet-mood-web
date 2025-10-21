'use client';
import React, { useEffect, useMemo, useState } from 'react';

// Page copy per variant
const COPY: Record<string, { title: string; body: string }> = {
  vet:     { title: 'AI Vet — Coming Soon',     body: 'We’re building a quick visual check for eyes, ears, fur and posture to flag early issues and suggest next steps.' },
  trainer: { title: 'AI Trainer — Coming Soon', body: 'Structured sessions to teach tricks like “Give Paw” and reinforce calm, with step-by-step, daily guidance.' },
  tracker: { title: 'Mood History — Coming Soon', body: 'See your pet’s mood trends over days and weeks, correlate with sleep, weather, playtime and diet.' },
  dna:     { title: 'Breed & Ancestry — Coming Soon', body: 'Explore likely breed mix and ancestry with AI analysis — a fun preview while we research DNA partners.' },
};

// Dropdown choices
const WTP_OPTIONS = [
  { value: '2.99', label: "I'd pay $2.99/mo" },
  { value: '4.99', label: "I'd pay $4.99/mo" },
  { value: '7.99', label: "I'd pay $7.99/mo" },
  { value: '0',    label: 'Not interested' },
];

// Safe, no-throw logger. If /api/event doesn't exist yet, it just no-ops.
async function logEvt(type: string, payload: Record<string, any>) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload }),
    });
  } catch {}
}

export default function LearnMorePage({ params }: { params: { variant: string } }) {
  const variant = useMemo(() => (params.variant || '').toLowerCase(), [params.variant]);
  const copy = COPY[variant] ?? { title: 'Coming Soon', body: 'This feature is in exploration. Thanks for your interest!' };

  // Read ?u=uploadId from URL (optional)
  const [uploadId, setUploadId] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const u = url.searchParams.get('u') || undefined;
      setUploadId(u);

      // Landing event (optional analytics)
      logEvt('CTA_Land', { variant, uploadId: u });
      // Meta Pixel
      try { /* @ts-ignore */ if (typeof fbq === 'function') fbq('trackCustom', 'CTA_Land', { variant, uploadId: u }); } catch {}
      // GA4
      try { /* @ts-ignore */ if (typeof gtag === 'function') gtag('event', 'CTA_Land', { variant, uploadId: u }); } catch {}
    } catch {}
  }, [variant]);

  // WTP UI state
  const [price, setPrice] = useState<string>('');       // '' means not selected yet
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!price) return; // guard
    setSubmitting(true);

    // First-party event (optional)
    await logEvt('WTP_Select', { variant, uploadId, price });

    // Third-party (optional)
    try { /* @ts-ignore */ if (typeof fbq === 'function') fbq('trackCustom', 'WTP_Select', { variant, uploadId, price }); } catch {}
    try { /* @ts-ignore */ if (typeof gtag === 'function') gtag('event', 'WTP_Select', { variant, uploadId, price }); } catch {}

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>{copy.title}</h1>
        <p style={styles.body}>{copy.body}</p>

        {/* WTP block */}
        <form onSubmit={onSubmit} style={styles.wtpWrap}>
          <label htmlFor="wtp" style={styles.wtpLabel}>Would you pay for this?</label>
          <select
            id="wtp"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={styles.select}
            required
          >
            <option value="" disabled>Select an option…</option>
            {WTP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button type="submit" disabled={!price || submitting} style={styles.btn}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>

          {submitted && (
            <div style={styles.thanks}>
              Thanks! Your feedback helps us decide what to build first.
            </div>
          )}
        </form>

        <a href="/" style={styles.link}>← Back to app</a>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f7f8fb', padding: 20 },
  card: {
    maxWidth: 560, width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
    boxShadow: '0 10px 30px rgba(2,6,23,0.08)', padding: 24
  },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 },
  body: { color: '#475569', fontSize: 15, lineHeight: 1.6, marginBottom: 16 },
  wtpWrap: { display: 'grid', gap: 10, marginBottom: 16 },
  wtpLabel: { fontSize: 14, color: '#334155', fontWeight: 700 },
  select: {
    border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#fff', outline: 'none'
  },
  btn: {
    padding: '12px 16px', borderRadius: 10, border: '1px solid #0ea5e9',
    background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)',
    color: '#fff', fontWeight: 700, cursor: 'pointer', width: '100%'
  },
  thanks: {
    border: '1px solid #bae6fd', background: '#eff6ff', color: '#0c4a6e',
    borderRadius: 10, padding: '10px 12px', fontSize: 13
  },
  link: { color: '#0ea5e9', fontWeight: 700, textDecoration: 'none' },
};