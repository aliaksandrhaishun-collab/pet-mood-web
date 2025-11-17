// src/app/layout.tsx
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter } from 'next/font/google';
import './globals.css';
import FacebookPixel from './fbpixel';

const inter = Inter({ subsets: ['latin'] }); // <— simple className, no variables

export const metadata: Metadata = {
  title: "Pet Mood – What's your pet feeling?",
  description:
    "Upload your pet’s photo and let AI guess their mood, breed, and toy ideas. Entertainment only — not diagnostic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Apply Inter directly to body to avoid any CSS override issues */}
      <body className={inter.className}>
        <FacebookPixel />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
