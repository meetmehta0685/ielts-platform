"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; dot?: string };

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Your prep",
    items: [
      { href: "/dashboard", label: "Home" },
      { href: "/planner", label: "Study plan" },
      { href: "/records", label: "Results" },
    ],
  },
  {
    heading: "Practise",
    items: [
      { href: "/writing", label: "Writing", dot: "bg-writing" },
      { href: "/speaking", label: "Speaking", dot: "bg-speaking" },
      { href: "/reading", label: "Reading", dot: "bg-reading" },
      { href: "/listening", label: "Listening", dot: "bg-listening" },
      { href: "/chat", label: "Ask the mentor" },
    ],
  },
  {
    heading: "Exam day",
    items: [{ href: "/simulator", label: "Full mock test" }],
  },
];

/** The product mark: a band-score cell, the box an IELTS result is printed in. */
export function ProductMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[7px] bg-brand font-display text-[16px] leading-none text-white",
        className
      )}
    >
      9
    </span>
  );
}

function useAccount() {
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const email = user.email ?? "";
      const name = (user.user_metadata?.full_name as string | undefined) || email.split("@")[0];
      setAccount({ name, email });
    });
  }, []);
  return account;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.heading}>
          <p className="mb-1.5 px-3 text-[13px] font-medium text-soft">{group.heading}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-[15px] transition-[background-color,box-shadow,color] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)]",
                      active ? "bg-sheet font-medium text-ink shadow-tile" : "text-ink/75 hover:bg-panel-hover hover:text-ink"
                    )}
                  >
                    {item.dot && <span aria-hidden className={cn("size-2 rounded-full", item.dot)} />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountRow() {
  const router = useRouter();
  const account = useAccount();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      setSigningOut(false);
      return;
    }
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 px-3">
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
      >
        {account?.name.charAt(0).toUpperCase() ?? ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{account?.name ?? " "}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="text-[13px] text-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

/**
 * The signed-in frame: a cool grey sidebar forming an L with the window edge, and the page on a
 * white sheet inset 8px. `title` labels the phone top bar; the page itself renders its own h1.
 */
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh bg-chrome">
      <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col justify-between py-5 lg:flex">
        <div className="flex flex-col gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-6">
            <ProductMark />
            <span className="text-[15px] font-medium text-ink">IELTS Prep</span>
          </Link>
          <div className="px-3">
            <NavList />
          </div>
        </div>
        <div className="px-3">
          <AccountRow />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-chrome px-4 lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="IELTS Prep home">
            <ProductMark className="size-6 text-[15px]" />
          </Link>
          <span className="text-[15px] font-medium text-ink">{title}</span>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-panel-hover"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>

        <div
          data-open={menuOpen}
          className="fixed inset-x-0 top-12 bottom-0 z-20 origin-top bg-chrome px-3 pt-4 pb-6 transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] data-[open=false]:pointer-events-none data-[open=false]:-translate-y-2 data-[open=false]:opacity-0 lg:hidden motion-reduce:transition-none"
        >
          <div className="flex h-full flex-col justify-between overflow-y-auto">
            <NavList onNavigate={() => setMenuOpen(false)} />
            <div className="pt-6">
              <AccountRow />
            </div>
          </div>
        </div>

        <main className="min-w-0 flex-1 bg-sheet lg:rounded-[14px] lg:shadow-tile">{children}</main>
      </div>
    </div>
  );
}

/**
 * The centred working column used on every app page: 1100px wide (12 columns of 77px with 16px
 * gutters), 72px from the top on desktop. The h1 sits first, with its one plain line beneath.
 */
export function PageColumn({
  title,
  lead,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1132px] px-4 pt-8 pb-16 sm:px-6 lg:pt-[72px] lg:pb-24", className)}>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-[50px]">
        <div className="max-w-[760px]">
          <h1 className="font-display text-[32px] text-balance text-ink sm:text-[44px]">{title}</h1>
          {lead && <p className="mt-3 text-[17px] leading-normal text-soft">{lead}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** One tonal tile: a step off white, its title and content directly inside, no border or shadow. */
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-panel p-5 sm:p-6", className)}>
      {(title || aside) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {aside && <div className="text-sm text-soft">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
