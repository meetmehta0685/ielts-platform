import { supabase } from "@/lib/supabase";

const APP_ORIGIN = "https://ielts-app.local";

export const OAUTH_NEXT_PATH_KEY = "ielts-oauth-next-path";

export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, APP_ORIGIN);
    return url.origin === APP_ORIGIN
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sends the learner to Google through Supabase, then back to /auth/callback and on to `nextPath`.
 * Checks first that the auth server is up and has Google switched on, so a misconfigured server
 * fails here with a message instead of on a dead browser page.
 */
export async function startGoogleSignIn(nextPath: string) {
  let googleEnabled = false;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    googleEnabled = Boolean(settings.external?.google);
  } catch {
    throw new Error("Can't reach the sign-in server right now. Try again in a moment, or use your email.");
  }
  if (!googleEnabled) {
    throw new Error("Google sign-in isn't available yet. Use your email and password for now.");
  }

  window.sessionStorage.setItem(OAUTH_NEXT_PATH_KEY, nextPath);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback", window.location.origin).toString() },
  });
  if (error) {
    window.sessionStorage.removeItem(OAUTH_NEXT_PATH_KEY);
    throw error;
  }
}
