import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductMark } from "@/components/app/app-shell";

export function Cta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="lp-wrap pb-6" aria-labelledby="cta-title">
      <div className="relative overflow-hidden rounded-[32px] bg-brand px-6 py-16 text-center text-white sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2"
        >
          <span className="flex-[30] bg-listening" />
          <span className="flex-[60] bg-reading" />
          <span className="flex-[60] bg-writing" />
          <span className="flex-[14] bg-speaking" />
        </div>
        <h2 id="cta-title" className="mx-auto max-w-[14ch] font-display text-[40px] text-balance sm:text-[64px]">
          Sit your first test today.
        </h2>
        <p className="mx-auto mt-5 max-w-[38ch] text-[17px] text-white/80">
          Practise one module or sit the full mock. Both start from a free account, and every result is saved to your
          records.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          <Button asChild size="lg" className="bg-white text-ink shadow-none hover:bg-white/90">
            <Link href={signedIn ? "/dashboard" : "/auth/signup"}>{signedIn ? "Go to your dashboard" : "Create a free account"}</Link>
          </Button>
          <Button asChild size="lg" className="bg-white/12 text-white shadow-none hover:bg-white/20">
            <Link href="/simulator">Sit the full mock</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="lp-wrap flex flex-col gap-6 py-10 text-[14px] text-soft md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2.5 text-ink">
        <ProductMark className="size-6 text-[14px]" />
        <span className="font-semibold">IELTS Prep</span>
      </div>
      <p className="max-w-[60ch] md:text-center">
        An independent practice tool, not affiliated with IELTS, the British Council, IDP or Cambridge University Press
        &amp; Assessment. Bands shown here are estimates.
      </p>
      <nav aria-label="Footer" className="flex gap-4">
        <a href="#top" className="hover:text-ink">
          Back to top
        </a>
        <Link href={signedIn ? "/dashboard" : "/auth/login"} className="hover:text-ink">
          {signedIn ? "Dashboard" : "Log in"}
        </Link>
      </nav>
    </footer>
  );
}
