"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#features", label: "Modules" },
  { href: "#demo", label: "AI Guide" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#journey", label: "Dashboard" },
  { href: "#testimonials", label: "Stories" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-stone-200/80 bg-white/90 backdrop-blur-lg shadow-sm"
          : "border-b border-transparent bg-white/70 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-7xl h-18 sm:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logo.png" alt="AI IELTS Logo" className="h-14 sm:h-16 w-auto object-contain" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-slate-500 hover:text-blue-950 transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-0.5 after:w-0 after:bg-amber-500 after:transition-all hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/auth/login" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="font-semibold text-slate-600 hover:text-blue-950">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="sm" className="bg-blue-950 hover:bg-blue-900 text-white font-semibold rounded-xl shadow-sm">
              Get Started
            </Button>
          </Link>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-stone-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 top-[72px] z-40 transition-all duration-300 ${
          mobileOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-blue-950/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <nav className="relative bg-white border-b border-stone-200 shadow-xl px-4 py-6 flex flex-col gap-1">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-base font-semibold text-slate-700 hover:bg-amber-50 hover:text-blue-950 transition-colors"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-2">
            <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full font-semibold rounded-xl">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup" onClick={() => setMobileOpen(false)}>
              <Button className="w-full bg-blue-950 hover:bg-blue-900 text-white font-semibold rounded-xl">
                Start Preparing Free
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
