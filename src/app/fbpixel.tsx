'use client';

import { useEffect } from 'react';

// Define a safe argument type for fbq
type FbqArgument =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | null
  | undefined;

// fbq function type: first param is event name, rest are payloads/options
type FbqFn = ((event: FbqArgument, ...rest: FbqArgument[]) => void) & {
  queue?: FbqArgument[][];
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

/**
 * Mounts the Facebook Pixel once per app load.
 * Uses NEXT_PUBLIC_FB_PIXEL_ID from env.
 */
export default function FacebookPixel() {
  useEffect(() => {
    const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    if (!pixelId) return;

    if (typeof window === 'undefined') return;

    // If already initialized, just send a PageView
    if (window.fbq && window.fbq.loaded) {
      window.fbq('track', 'PageView');
      return;
    }

    // Create stub fbq that queues calls until the script loads
    const fbq: FbqFn = ((event: FbqArgument, ...rest: FbqArgument[]) => {
      fbq.queue = fbq.queue || [];
      fbq.queue.push([event, ...rest]);
    }) as FbqFn;

    fbq.queue = [];
    fbq.version = '2.0';
    fbq.loaded = false;

    window.fbq = fbq;
    window._fbq = fbq;

    // Inject the Pixel script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => {
      fbq.loaded = true;
    };
    document.head.appendChild(script);

    // Init + PageView
    fbq('init', pixelId);
    fbq('track', 'PageView');
  }, []);

  return null;
}