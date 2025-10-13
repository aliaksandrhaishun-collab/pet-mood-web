'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function JoinForm() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to save email');
      }
      router.replace(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Enter your email</h1>
        <p style={styles.sub}>We’ll use this to personalize your Pet Mood experience.</p>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </form>

        {err && <div style={styles.err}>⚠️ {err}</div>}

        <p style={styles.footnote}>By continuing you agree to our <a href="/privacy">Privacy Policy</a>.</p>
      </div>
    </main>
  );
}

export default function JoinPage() {
  // Wrap component that uses useSearchParams in Suspense
  return (
    <Suspense fallback={<div />}>
      <JoinForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, #f7f8fb 0%, #eef1f6 100%)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    boxShadow: '0 10px 30px rgba(2,6,23,0.10)',
    padding: 20,
    textAlign: 'center',
  },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 },
  sub: { color: '#475569', fontSize: 14, marginBottom: 16 },
  form: { display: 'grid', gap: 10 },
  input: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #0ea5e9',
    background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  err: {
    marginTop: 10,
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#7f1d1d',
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: 13,
  },
  footnote: { marginTop: 10, fontSize: 12, color: '#64748b' },
};
