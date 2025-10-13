// src/app/page.tsx (server component)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomeClient from './home-client';

export default async function Page() {
  const email = (await cookies()).get('pm_email')?.value;

  // If no email cookie, send user to the join page BEFORE rendering anything
  if (!email) {
    redirect('/join');
  }

  // If email exists, show the tool UI
  return <HomeClient />;
}
