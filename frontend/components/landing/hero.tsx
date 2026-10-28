"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductMark } from "@/components/app/app-shell";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="sticky top-3 z-40 px-3 pt-3 sm:top-4 sm:px-4">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-[1132px] items-center justify-between rounded-full bg-sheet/80 pr-2 pl-4 shadow-tile backdrop-blur-xl"
      >
        <Link href="/" className="flex items-center gap-2.5 rounded-full">
          <ProductMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">IELTS Prep</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {[
            ["#modules", "Modules"],
            ["#your-bands", "Band calculator"],
            ["#questions", "Questions"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3.5 py-2 text-[14px] text-soft transition-colors duration-[var(--duration-quick)] hover:bg-panel-strong hover:text-ink"
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <Button asChild variant="accent" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button asChild variant="accent" size="sm">
                <Link href="/auth/signup">Start free</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="lp-wrap pt-16 pb-20 sm:pt-24 lg:pb-28">
      <div className="mx-auto flex max-w-[860px] flex-col items-center text-center">
        <p className="lp-rise flex items-center gap-2 text-[14px] text-soft" style={rise(0)}>
          <span className="flex -space-x-1" aria-hidden>
            {["bg-listening", "bg-reading", "bg-writing", "bg-speaking"].map((c) => (
              <span key={c} className={`size-2.5 rounded-full ring-2 ring-sheet ${c}`} />
            ))}
          </span>
          Listening, Reading, Writing and Speaking
        </p>
        <h1
          className="lp-rise mt-5 font-display text-[44px] leading-[0.98] text-balance sm:text-[68px] lg:text-[84px]"
          style={rise(1)}
        >
          Know your band before exam day.
        </h1>
        <p className="lp-rise mt-6 max-w-[34em] text-[17px] text-pretty text-soft sm:text-[19px]" style={rise(2)}>
          Timed practice for all four IELTS modules, with every answer marked by AI against the official band
          descriptors.
        </p>
        <div className="lp-rise mt-9 flex flex-wrap items-center justify-center gap-2.5" style={rise(3)}>
          <Button asChild variant="accent" size="lg">
            <Link href={signedIn ? "/dashboard" : "/auth/signup"}>
              {signedIn ? "Go to your dashboard" : "Start practising free"}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="#your-bands">Work out an Overall band</a>
          </Button>
        </div>
      </div>

      <div id="modules" className="mt-16 grid scroll-mt-28 gap-4 sm:mt-20 md:grid-cols-2 lg:grid-cols-12">
        <ModuleTile i={4} hue="--listening" name="Listening" time="30 minutes" className="lg:col-span-5">
          <ListeningUi />
        </ModuleTile>
        <ModuleTile i={5} hue="--reading" name="Reading" time="60 minutes" className="lg:col-span-7">
          <ReadingUi />
        </ModuleTile>
        <ModuleTile i={6} hue="--writing" name="Writing" time="60 minutes" className="lg:col-span-7">
          <WritingUi />
        </ModuleTile>
        <ModuleTile i={7} hue="--speaking" name="Speaking" time="11 to 14 minutes" className="lg:col-span-5">
          <SpeakingUi />
        </ModuleTile>
      </div>
    </header>
  );
}

function ModuleTile({
  i,
  hue,
  name,
  time,
  className,
  children,
}: {
  i: number;
  hue: string;
  name: string;
  time: string;
  className?: string;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = outer.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--tilt-rx", `${(0.5 - y) * 5}deg`);
    el.style.setProperty("--tilt-ry", `${(x - 0.5) * 5}deg`);
    el.style.setProperty("--tilt-gx", `${x * 100}%`);
    el.style.setProperty("--tilt-gy", `${y * 100}%`);
    el.classList.add("is-tilting", "is-hover");
  };
  const onLeave = () => {
    const el = outer.current;
    if (!el) return;
    el.style.setProperty("--tilt-rx", "0deg");
    el.style.setProperty("--tilt-ry", "0deg");
    el.classList.remove("is-tilting", "is-hover");
  };

  return (
    <div
      ref={outer}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`lp-tilt lp-rise ${className ?? ""}`}
      style={{ ...rise(i), "--hue": `var(${hue})` } as CSSProperties}
    >
      <article className="lp-tilt-card lp-wash flex h-full flex-col gap-5 overflow-hidden rounded-[24px] p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--hue)" }} />
            {name}
          </h2>
          <span className="text-[14px] text-soft">{time}</span>
        </div>
        <div className="flex-1">{children}</div>
        <div className="lp-tilt-glare" aria-hidden />
      </article>
    </div>
  );
}

const note = "text-[13px] text-soft";

function ListeningUi() {
  return (
    <div className="lp-ui p-4 text-[14px]" aria-hidden>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">Part 1</span>
        <span className="tabular font-display text-[22px]">28:41</span>
      </div>
      <p className={`${note} mt-2`}>Complete the form. Write ONE WORD AND/OR A NUMBER for each answer.</p>
      <p className="mt-3 font-medium">Library membership form</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {[
          ["Surname", "Morgan"],
          ["Postcode", "CB2 1TN"],
          ["Preferred day", "Thurs"],
        ].map(([k, v], n) => (
          <div key={k} className="contents">
            <dt className="text-soft">{k}</dt>
            <dd
              className={`w-fit rounded-md px-2 py-0.5 ${n === 2 ? "ring-2 ring-[var(--hue)]" : "ring-1 ring-input"}`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center gap-3">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel-strong">
          <span className="block h-full w-2/5 rounded-full" style={{ background: "var(--hue)" }} />
        </span>
        <span className={note}>Played once</span>
      </div>
    </div>
  );
}

function ReadingUi() {
  return (
    <div className="lp-ui p-4 text-[14px]" aria-hidden>
      <p className={note}>Questions 8–10. Do the following statements agree with the information in the passage?</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {[
          ["Libraries in the study lent more books each year.", "True"],
          ["Most readers preferred printed editions.", "Not given"],
          ["Opening hours were cut in every city.", "False"],
        ].map(([q, a], n) => (
          <li key={q} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="tabular mr-2 text-soft">{8 + n}</span>
              {q}
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] ${
                n === 1 ? "bg-[var(--hue)] text-white" : "bg-panel-strong"
              }`}
            >
              {a}
            </span>
          </li>
        ))}
      </ul>
      <p className={`${note} mt-3 border-t border-border pt-3`}>
        9 · The passage gives no figures on format, so this is Not given.
      </p>
    </div>
  );
}

function WritingUi() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_200px]" aria-hidden>
      <div className="lp-ui p-4 text-[14px] leading-relaxed">
        <p className={note}>Task 2 · sample marking</p>
        <p className="mt-2">
          Many people <del className="text-bad decoration-bad/60">believes</del>{" "}
          <ins className="rounded bg-[color-mix(in_oklab,var(--hue)_18%,white)] px-1 no-underline">believe</ins> that
          universities should prepare graduates for work, not only for further study.
        </p>
        <p className={`${note} mt-2`}>Subject–verb agreement: a plural subject takes “believe”.</p>
      </div>
      <div className="lp-ui p-4 text-[13px]">
        {[
          ["Task response", 6.5],
          ["Coherence and cohesion", 7],
          ["Lexical resource", 6.5],
          ["Grammatical range", 6],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 border-b border-border py-1.5 last:border-0">
            <span className="text-soft">{k}</span>
            <span className="tabular font-medium">{(v as number).toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeakingUi() {
  const bars = [6, 14, 22, 12, 28, 18, 34, 20, 26, 10, 30, 16, 24, 8, 20, 12];
  return (
    <div className="lp-ui p-4 text-[14px]" aria-hidden>
      <p className={note}>Part 2 cue card</p>
      <p className="mt-2 font-medium">Describe a place where you like to study.</p>
      <p className={`${note} mt-1`}>One minute to prepare. Then speak for up to two minutes.</p>
      <div className="mt-4 flex items-center gap-3 rounded-full bg-panel px-3 py-2">
        <span className="size-2 rounded-full bg-bad" />
        <span className="flex h-8 flex-1 items-center gap-[3px]">
          {bars.map((h, n) => (
            <span key={n} className="w-full rounded-full" style={{ height: h, background: "var(--hue)", opacity: 0.35 + (h / 34) * 0.65 }} />
          ))}
        </span>
        <span className="tabular text-[13px] text-soft">1:12</span>
      </div>
    </div>
  );
}
