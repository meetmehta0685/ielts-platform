import Link from "next/link";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/app/app-shell";
import "./auth.css";

/**
 * The signed-out frame: a calm putty page with the product mark top-left and one white sheet,
 * about 420px wide, holding the form. The h1 is the only line set in Gambarino.
 */
export function AuthFrame({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-putty">
      <header className="flex h-16 items-center px-4 sm:px-8">
        <Link
          href="/"
          className="-mx-2 flex items-center gap-2.5 rounded-full px-2 py-1.5 transition-colors duration-[var(--duration-quick)] hover:bg-putty-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <ProductMark />
          <span className="text-[15px] font-medium text-ink">IELTS Prep</span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0 sm:pb-24">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl bg-sheet p-6 sm:p-8">
            <h1 className="font-display text-[34px] text-ink sm:text-[40px]">{title}</h1>
            {lead && <p className="mt-3 text-[15px] leading-normal text-soft">{lead}</p>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-[15px] text-soft">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** The thin "or" rule between the email form and the Google button. */
export function OrRule() {
  return (
    <div className="my-6 flex items-center gap-3 text-sm text-soft" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}
