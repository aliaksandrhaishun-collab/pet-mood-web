'use client';
import React, { useEffect, useState } from 'react';

type Variant = 'vet' | 'trainer' | 'tracker' | 'dna';

const VARIANTS: Record<
  Variant,
  { id: Variant; desc: string; button: string; evClick: string; evImpr: string }
> = {
  vet:     { id: 'vet',     desc: 'Scan your pet’s eyes, fur, and posture for early signs of illness.', button: 'Ask AI Vet',            evClick: 'CTA_Vet_Click',     evImpr: 'CTA_Vet_Impression' },
  trainer: { id: 'trainer', desc: 'Step-by-step guidance to teach tricks like “Give Paw” and improve behavior.', button: 'Start Training', evClick: 'CTA_Trainer_Click', evImpr: 'CTA_Trainer_Impression' },
  tracker: { id: 'tracker', desc: 'Track your pet’s emotional well-being over time and spot trends.',   button: 'Track Mood Over Time', evClick: 'CTA_Tracker_Click', evImpr: 'CTA_Tracker_Impression' },
  dna:     { id: 'dna',     desc: 'Explore your pet’s likely breed and ancestry with AI analysis.',      button: 'Check Ancestry',       evClick: 'CTA_DNA_Click',     evImpr: 'CTA_DNA_Impression' },
};

function setCookie(name: string, value: string, days = 180) {
  const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}
function getCookie(name: string) {
  return document.cookie.split('; ').find((row) => row.startsWith(name + '='))?.split('=')[1];
}

async function logEvt(type: string, data: Record<string, any> = {}) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
    });
  } catch {}
}

export default function MonetizationCTAs({ uploadId }: { uploadId?: string }) {
  const [variant, setVariant] = useState<Variant | null>(null);

  // Decide/lock variant per user (sticky cookie); allow ?v= override for QA
  useEffect(() => {
    const url = new URL(window.location.href);
    const forced = url.searchParams.get('v') as Variant | null;
    const saved  = (getCookie('pm_variant') as Variant | null) ?? null;

    if (forced && VARIANTS[forced]) {
      setVariant(forced); setCookie('pm_variant', forced); return;
    }
    if (saved && VARIANTS[saved]) {
      setVariant(saved); return;
    }
    const keys = Object.keys(VARIANTS) as Variant[];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    setVariant(pick); setCookie('pm_variant', pick);
  }, []);

  // Fire IMPRESSION once the CTA is known/rendered
  useEffect(() => {
    if (!variant) return;
    const v = VARIANTS[variant];
    // first-party
    logEvt(v.evImpr, { variant: v.id, uploadId });
    // optional third-party mirrors
    try { /* @ts-ignore */ if (typeof fbq === 'function') fbq('trackCustom', v.evImpr, { variant: v.id, uploadId }); } catch {}
    try { /* @ts-ignore */ if (typeof gtag === 'function') gtag('event', v.evImpr, { variant: v.id, uploadId }); } catch {}
  }, [variant, uploadId]);

  if (!variant) return null;
  const v = VARIANTS[variant];

  const href = `/learn-more/${v.id}?u=${encodeURIComponent(uploadId || '')}`;

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.desc}>{v.desc}</div>
        <a
          href={href}
          onClick={() => {
            // first-party click
            logEvt(v.evClick, { variant: v.id, uploadId });
            // optional third-party mirrors
            try { /* @ts-ignore */ if (typeof fbq === 'function') fbq('trackCustom', v.evClick, { variant: v.id, uploadId }); } catch {}
            try { /* @ts-ignore */ if (typeof gtag === 'function') gtag('event', v.evClick, { variant: v.id, uploadId }); } catch {}
          }}
          style={styles.btn as React.CSSProperties}
        >
          {v.button}
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 12 },
  card: { border: '1px solid #dbe2ea', borderRadius: 12, padding: 16, background: '#fff', textAlign: 'center' },
  desc: { color: '#475569', fontSize: 14, marginBottom: 12 },
  btn: {
    display: 'inline-block',
    textDecoration: 'none',
    textAlign: 'center',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #0ea5e9',
    background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
};