'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

declare const fbq: ((...args: unknown[]) => void) | undefined;
declare const gtag: ((...args: unknown[]) => void) | undefined;

async function logEvt(type: string, data: Record<string, unknown> = {}) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
      keepalive: true,
    });
  } catch { /* no-op */ }
}

const COPY: Record<string, { title: string; desc: string }> = {
  vet:     { title: 'AI Vet — Coming Soon',       desc: 'Quick triage: eyes, fur, posture checks and when to see a vet.' },
  trainer: { title: 'AI Trainer — Coming Soon',   desc: 'Structured sessions to teach tricks like “Give Paw” and reinforce calm.' },
  tracker: { title: 'Mood Tracker — Coming Soon', desc: 'Track emotional trends and get tips based on weekly patterns.' },
  dna:     { title: 'Ancestry — Coming Soon',     desc: 'Explore likely lineage and breed traits using AI analysis.' },
};

export default function LearnMorePage({ params }: { params: { variant: string } }) {
  const v = (params.variant || '').toLowerCase();

  // Landing impression (fires once per mount)
  useEffect(() => {
    const url = new URL(window.location.href);
    const u = url.searchParams.get('u') || undefined;
    logEvt('CTA_Land', { variant: v, uploadId: u });
    try { if (typeof fbq === 'function') fbq('trackCustom', 'CTA_Land', { variant: v, uploadId: u }); } catch {}
    try { if (typeof gtag === 'function') gtag('event', 'CTA_Land', { variant: v, uploadId: u }); } catch {}
  }, [v]);

  const [price, setPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submitWTP() {
    if (!price || submitting || done) return;
    setSubmitting(true);
    try {
      const url = new URL(window.location.href);
      const u = url.searchParams.get('u') || undefined;

      // FIRST-PARTY event — logs ONLY on submit
      await logEvt('WTP_Submit', { variant: v, price, uploadId: u });

      // Optional mirrors
      try { if (typeof fbq === 'function') fbq('trackCustom', 'WTP_Submit', { variant: v, price, uploadId: u }); } catch {}
      try { if (typeof gtag === 'function') gtag('event', 'WTP_Submit', { variant: v, price, uploadId: u }); } catch {}

      setDone(true);
    } catch {
      // Even if network fails, show a completion state so UX isn't stuck.
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[v] || { title: 'Coming Soon', desc: 'Stay tuned!' };

  return (
    <main style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{
        maxWidth: 560, width: '100%', background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 16, boxShadow: '0 10px 30px rgba(2,6,23,0.06)', padding: 20
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{copy.title}</h1>
        <p style={{ color: '#475569', marginBottom: 16 }}>{copy.desc}</p>

        {!done ? (
          <div style={{ marginTop: 14, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <label
              htmlFor="wtp"
              style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}
            >
              Would you pay for this?
            </label>
            <select
              id="wtp"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={submitting}
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px' }}
            >
              <option value="">Select one…</option>
              <option>$2.99/m</option>
              <option>$4.99/m</option>
              <option>$7.99/m</option>
              <option>Not interested</option>
            </select>

            <button
              type="button"
              onClick={submitWTP}
              disabled={!price || submitting}
              style={{
                marginLeft: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid #0ea5e9',
                background: 'linear-gradient(180deg,#38bdf8 0%,#0ea5e9 100%)', color: '#fff',
                fontWeight: 700, opacity: (!price || submitting) ? 0.7 : 1, cursor: (!price || submitting) ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        ) : (
          <div style={{
            marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 14,
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 12
          }}>
            <div style={{ color: '#075985', fontWeight: 700, marginBottom: 6 }}>
              Thanks! Your feedback was recorded.
            </div>
            <div style={{ color: '#0f172a' }}>
              We’ll use this to guide what we build next.
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: '#0ea5e9', textDecoration: 'none' }}>← Back to app</Link>
        </div>
      </div>
    </main>
  );
}