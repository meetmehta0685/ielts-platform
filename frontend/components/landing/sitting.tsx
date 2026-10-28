import type { CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";

/** The four modules in exam order, with the minutes each takes (speaking at its 14-minute upper end). */
const MODULES = [
  {
    name: "Listening",
    hue: "--listening",
    minutes: 30,
    time: "30 min",
    body: "Four recordings, forty questions, each recording played once. Your raw score becomes a band.",
  },
  {
    name: "Reading",
    hue: "--reading",
    minutes: 60,
    time: "60 min",
    body: "Three long passages and forty questions. A one-line reason comes back for every miss.",
  },
  {
    name: "Writing",
    hue: "--writing",
    minutes: 60,
    time: "60 min",
    body: "Task 1 in 20 minutes, Task 2 in 40. Each is marked on the four criteria, with every sentence to fix.",
  },
  {
    name: "Speaking",
    hue: "--speaking",
    minutes: 14,
    time: "11–14 min",
    body: "Three parts with an examiner. In the full mock, a live AI examiner runs the interview by voice.",
  },
] as const;

export function Sitting() {
  return (
    <section id="how-it-works" className="lp-wrap scroll-mt-28 py-20 lg:py-28" aria-labelledby="sitting-title">
      <Reveal>
        <div className="t-stagger-line flex flex-col justify-between gap-4 md:flex-row md:items-end" style={{ "--i": 0 } as CSSProperties}>
          <h2 id="sitting-title" className="max-w-[16ch] font-display text-[36px] text-balance sm:text-[52px]">
            A full sitting, in exam order.
          </h2>
          <p className="max-w-[36ch] text-[17px] text-soft">
            Take one module when you have half an hour, or all four in the full mock, ending in one combined report.
          </p>
        </div>

        <div className="mt-12 flex h-3 gap-1.5" aria-hidden>
          {MODULES.map((m, i) => (
            <span
              key={m.name}
              className="lp-seg rounded-full"
              style={{ flex: m.minutes, background: `var(${m.hue})`, "--i": i } as CSSProperties}
            />
          ))}
        </div>

        <ol className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <li key={m.name} className="t-stagger-line" style={{ "--i": i + 1 } as CSSProperties}>
              <p className="flex items-baseline justify-between border-t border-border pt-4">
                <span className="flex items-center gap-2 text-[17px] font-semibold">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${m.hue})` }} />
                  {m.name}
                </span>
                <span className="tabular text-[15px] text-soft">{m.time}</span>
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-soft">{m.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}
