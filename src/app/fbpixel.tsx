'use client';

import { useEffect } from 'react';

type FbqFn = ((...args: any[]) => void) & {
  queue?: any[];
  callMethod?: (...args: any[]) => void;
  push?: (...args: any[]) => void;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

/**
 * Initializes Facebook Pixel once per app load.
 * Uses NEXT_PUBLIC_FB_PIXEL_ID from env.
 */
export default function FacebookPixel() {
  useEffect(() => {
    const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    if (!pixelId) return;

    // Prevent re-init during Fast Refresh or re-renders
    if (window.fbq && window.fbq.version === '2.0') {
      return;
    }

    // Create fbq stub queue
    const fbq: FbqFn = function (...args: any[]) {
      fbq.queue = fbq.queue || [];
      fbq.queue.push(args);
    };

    fbq.queue = [];
    fbq.version = '2.0';
    fbq.push = fbq;
    fbq.callMethod = undefined;

    window.fbq = fbq;
    window._fbq = fbq;

    // Inject the real pixel script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    // Startup events
    fbq('init', pixelId);
    fbq('track', 'PageView');
  }, []);

  return null;
}