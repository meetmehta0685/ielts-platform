"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const TIMES = [
  ["Listening", "30 minutes"],
  ["Reading", "60 minutes"],
  ["Writing", "60 minutes"],
  ["Speaking", "11 to 14 minutes"],
] as const;

export function Hero({ signedIn }: { signedIn: boolean }) {
  const shutter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = shutter.current;
    if (!el) return;
    // Two frames so the closed state paints before it opens.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => el.classList.add("is-in"));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  const primaryHref = signedIn ? "/dashboard" : "/auth/signup";

  return (
    <header className="lp-hero lp-wrap">
      <nav className="lp-nav" aria-label="Main">
        <Link href="/" className="lp-link font-medium">
          IELTS AI Prep
        </Link>
        <div className="lp-nav-links">
          <a href="#how-it-works" className="lp-link lp-nav-wide">
            How a sitting runs
          </a>
          <a href="#questions" className="lp-link lp-nav-wide">
            Questions
          </a>
          {signedIn ? (
            <Link href="/dashboard" className="lp-link">
              Dashboard
            </Link>
          ) : (
            <Link href="/auth/login" className="lp-link">
              Log in
            </Link>
          )}
        </div>
      </nav>

      <div className="lp-hero-body">
        <h1 className="lp-sentence lp-display">
          <span className="lp-word" style={{ "--i": 0 } as CSSProperties}>
            Ready
          </span>
          <span className="lp-word" style={{ "--i": 1 } as CSSProperties}>
            for
          </span>
          <span className="lp-break" aria-hidden="true" />
          <span className="lp-word" style={{ "--i": 2 } as CSSProperties}>
            the
          </span>
          <span ref={shutter} className="lp-strip lp-shutter">
            <span className="lp-strip-drift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="lp-photo"
                src="/landing/back-view-of-students-writing-examination-in.jpg"
                width={1920}
                height={1083}
                alt="exam hall"
                fetchPriority="high"
              />
            </span>
          </span>
        </h1>

        <p className="lp-hero-lead">
          Timed practice for all four IELTS modules, marked by AI against the official band descriptors.
        </p>
        <div className="lp-hero-actions">
          <Button asChild variant="accent" size="lg">
            <Link href={primaryHref}>{signedIn ? "Go to your dashboard" : "Start practising free"}</Link>
          </Button>
          <a href="#your-bands" className="lp-link text-[17px]">
            Or work out an Overall band first
          </a>
        </div>
      </div>

      <ol className="lp-hero-times" aria-label="The four modules, in exam order">
        {TIMES.map(([name, time], i) => (
          <li key={name} className="lp-word" style={{ "--i": 5 + i } as CSSProperties}>
            <b>{name}</b>
            <span className="lp-soft">{time}</span>
          </li>
        ))}
      </ol>
    </header>
  );
}
