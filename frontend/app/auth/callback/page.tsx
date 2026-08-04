"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OAUTH_NEXT_PATH_KEY, safeInternalPath } from "@/lib/auth-redirect";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Verifying connection...");

  useEffect(() => {
    const nextPath = safeInternalPath(
      window.sessionStorage.getItem(OAUTH_NEXT_PATH_KEY)
    );
    window.sessionStorage.removeItem(OAUTH_NEXT_PATH_KEY);
    let cancelled = false;
    let hasNavigated = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | undefined;

    const navigateOnce = (path: string) => {
      if (cancelled || hasNavigated) return;
      hasNavigated = true;

      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
      router.push(path);
      router.refresh();
    };

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          console.error("Auth callback session verification error:", error);
          toast.error("Authentication failed: " + error.message);
          navigateOnce("/auth/login");
          return;
        }

        if (session) {
          setStatus("Secure connection established. Setting up your workspace...");
          toast.success("Successfully logged in!");
          navigateOnce(nextPath);
        } else {
          const { data } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (currentSession) {
                setStatus("Session synchronized. Loading dashboard...");
                toast.success("Successfully logged in!");
                navigateOnce(nextPath);
              }
            }
          );
          subscription = data.subscription;

          if (hasNavigated) {
            subscription.unsubscribe();
            return;
          }

          timeoutId = setTimeout(() => {
            if (cancelled || hasNavigated) return;
            toast.error("Authentication timed out. Please try logging in again.");
            navigateOnce("/auth/login");
          }, 6000);
        }
      } catch (err: unknown) {
        console.error("Unexpected error in auth callback handler:", err);
        navigateOnce("/auth/login");
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/20 px-4">
      <div className="text-center space-y-4 max-w-sm p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div className="relative flex justify-center">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-xl w-16 h-16 mx-auto animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-indigo-950 relative" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Signing you in</h2>
        <p className="text-sm text-slate-500">{status}</p>
      </div>
    </div>
  );
}
