import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage handler that persists session tokens in cookies so they are accessible to Server Components and Middleware
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${key}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(";").shift() || "");
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    
    let cookieValue = value;
    if (key === "sb-auth-token") {
      try {
        const parsed = JSON.parse(value);
        if (parsed && parsed.access_token) {
          // Strip the large user object to prevent exceeding the browser's 4KB cookie limit.
          // The middleware and page components only read the access_token anyway.
          const lightSession = {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
            expires_at: parsed.expires_at,
            expires_in: parsed.expires_in,
            token_type: parsed.token_type,
          };
          cookieValue = JSON.stringify(lightSession);
        }
      } catch (err) {
        console.error("[supabaseClient] Error trimming session for cookie storage:", err);
      }
    }

    // Set cookie path to root so it applies to all routes, lax SameSite, and secure in production
    const isSecure = window.location.protocol === "https:";
    document.cookie = `${key}=${encodeURIComponent(cookieValue)}; path=/; max-age=31536000; SameSite=Lax${isSecure ? "; Secure" : ""}`;
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    // Expire the cookie to clear it
    document.cookie = `${key}=; path=/; max-age=-1; SameSite=Lax`;
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "sb-auth-token",
    storage: cookieStorage,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});