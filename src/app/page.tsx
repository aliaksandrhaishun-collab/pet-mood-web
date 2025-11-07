// src/app/page.tsx (server component)
import HomeClient from './home-client';

export default async function Page() {
  // Render the app immediately — no email gate / redirect
  return <HomeClient />;
}
