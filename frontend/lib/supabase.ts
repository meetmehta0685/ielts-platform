import { createBrowserClient } from "@supabase/ssr";

// Stores the session in cookies so the proxy and Server Components can read and refresh it.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
