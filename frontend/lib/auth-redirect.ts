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
