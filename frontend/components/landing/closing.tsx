import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductMark } from "@/components/app/app-shell";

export function Cta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="lp-wrap pb-6" aria-labelledby="cta-title">
      <div className="grid gap-8 rounded-2xl bg-brand px-6 py-12 text-white sm:px-10 sm:py-16 lg:grid-cols-12 lg:items-end lg:gap-6">
        <div className="lg:col-span-7">
          <h2 id="cta-title" className="max-w-[14ch] font-display text-[40px] text-balance sm:text-[60px]">
            Sit your first test today.
          </h2>
          <p className="mt-5 max-w-[40ch] text-[17px] text-white/85">
            Practise one module or sit the full mock. Both start from a free account, and every result is saved to your
            records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 lg:col-span-5 lg:justify-end">
          <Button asChild size="lg" className="bg-white text-ink hover:bg-white/90">
            <Link href={signedIn ? "/dashboard" : "/auth/signup"}>{signedIn ? "Go to your dashboard" : "Create a free account"}</Link>
          </Button>
          <Button asChild size="lg" className="bg-transparent text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45)] hover:bg-white/10">
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
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
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
