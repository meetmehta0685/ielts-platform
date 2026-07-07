"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Verifying connection...");

  useEffect(() => {
    // Supabase will automatically process the hash/query parameters containing the tokens,
    // update cookieStorage, and set the user session.
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback session verification error:", error);
          toast.error("Authentication failed: " + error.message);
          router.push("/auth/login");
          return;
        }

        if (session) {
          setStatus("Secure connection established. Setting up your workspace...");
          toast.success("Successfully logged in!");
          router.push("/dashboard");
          router.refresh();
        } else {
          // If no session is found, wait a moment or subscribe to auth state changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (currentSession) {
                subscription.unsubscribe();
                setStatus("Session synchronized. Loading dashboard...");
                router.push("/dashboard");
                router.refresh();
              }
            }
          );

          // Timeout after 6 seconds if no session is detected
          const timeout = setTimeout(() => {
            subscription.unsubscribe();
            toast.error("Authentication timed out. Please try logging in again.");
            router.push("/auth/login");
          }, 6000);

          return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
          };
        }
      } catch (err: any) {
        console.error("Unexpected error in auth callback handler:", err);
        router.push("/auth/login");
      }
    };

    checkSession();
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
