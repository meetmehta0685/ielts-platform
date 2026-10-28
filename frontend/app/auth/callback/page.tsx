"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OAUTH_NEXT_PATH_KEY, safeInternalPath } from "@/lib/auth-redirect";
import { AuthFrame } from "@/components/auth/auth-frame";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking your sign-in");

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
          toast.error("Sign-in failed: " + error.message);
          navigateOnce("/auth/login");
          return;
        }

        if (session) {
          setStatus("Signed in. Opening your practice");
          toast.success("Signed in.");
          navigateOnce(nextPath);
        } else {
          const { data } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (currentSession) {
                setStatus("Signed in. Opening your practice");
                toast.success("Signed in.");
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
            toast.error("Sign-in took too long. Try again.");
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
    <AuthFrame title="Signing you in">
      <p role="status" aria-live="polite" className="text-[15px]">
        <span key={status} className="t-swap inline-block">
          <span className="t-pending">{status}</span>
        </span>
      </p>
    </AuthFrame>
  );
}
