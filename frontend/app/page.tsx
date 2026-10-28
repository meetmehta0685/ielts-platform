"use client";

import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { OAUTH_NEXT_PATH_KEY, safeInternalPath } from "@/lib/auth-redirect";
import { Hero, Nav } from "@/components/landing/hero";
import { BandCalculator } from "@/components/landing/band-calculator";
import { Sitting } from "@/components/landing/sitting";
import { Faq } from "@/components/landing/faq";
import { Cta, Footer } from "@/components/landing/closing";
import "@/components/landing/landing.css";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);

  // Load the session; finish an OAuth return by sending the learner on to where they were going.
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.slice(1));
    const isOAuthReturn =
      currentUrl.searchParams.has("code") ||
      currentUrl.searchParams.has("error") ||
      hashParams.has("access_token") ||
      hashParams.has("error");
    let isRedirecting = false;

    const finishOAuthReturn = (hasSession: boolean) => {
      if (!isOAuthReturn || isRedirecting) return;

      isRedirecting = true;
      const nextPath = safeInternalPath(window.sessionStorage.getItem(OAUTH_NEXT_PATH_KEY));
      window.sessionStorage.removeItem(OAUTH_NEXT_PATH_KEY);
      window.location.replace(hasSession ? nextPath : "/auth/login");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      finishOAuthReturn(Boolean(session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session) finishOAuthReturn(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signedIn = Boolean(currentUser);

  return (
    <div id="top" className="lp min-h-svh w-full">
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <main>
        <Sitting />
        <BandCalculator />
        <Faq />
        <Cta signedIn={signedIn} />
      </main>
      <Footer signedIn={signedIn} />
    </div>
  );
}
