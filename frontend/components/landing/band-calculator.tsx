"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";
import { MODULE_HUE } from "@/lib/module-hue";
import { MODULES, formatBand, formatMean, overallBand, parseBands } from "./band";

const START = "7.5 6.5 6 6.5";
const EXAMPLES = [
  { value: "6.5 6 6 6.5", note: "averages 6.25" },
  { value: "7 7 6.5 6.5", note: "averages 6.75" },
  { value: "6.5 6 6 6", note: "averages 6.125" },
];

export function BandCalculator() {
  const [value, setValue] = useState(START);
  const [focused, setFocused] = useState(false);
  const [caretX, setCaretX] = useState<number | null>(null);
  const [changes, setChanges] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);

  const parsed = useMemo(() => parseBands(value), [value]);
  const result = parsed.ok ? overallBand(parsed.bands) : null;

  // Place the block caret after the last character while the field is not being edited.
  useLayoutEffect(() => {
    const m = mirror.current;
    const i = input.current;
    if (!m || !i) return;
    const measure = () => {
      const w = m.getBoundingClientRect().width;
      setCaretX(w + 46 < i.clientWidth ? w + 6 : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value]);

  const fill = (next: string) => {
    setValue(next);
    setChanges((c) => c + 1);
    input.current?.focus();
  };

  return (
    <section id="your-bands" className="lp-wrap scroll-mt-28 py-20 lg:py-28" aria-labelledby="bands-title">
      <Reveal className="grid items-start gap-10 lg:grid-cols-12 lg:gap-6">
        <div className="t-stagger-line lg:col-span-5" style={{ "--i": 0 } as CSSProperties}>
          <h2 id="bands-title" className="max-w-[14ch] font-display text-[36px] text-balance sm:text-[52px]">
            Work out an Overall band.
          </h2>
          <p className="mt-4 max-w-[36ch] text-[17px] text-soft">
            <label htmlFor="bands-input">Type your four module bands in report order.</label> The rounding follows the
            published rule, quarters and all.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-[14px] text-soft">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.value}
                type="button"
                className="tabular h-9 rounded-full bg-panel-strong px-3.5 text-[14px] transition-[background-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-panel-hover active:scale-[0.97]"
                onClick={() => fill(ex.value)}
                aria-label={`Fill in ${ex.value}, which ${ex.note}`}
              >
                {ex.value}
              </button>
            ))}
          </div>
        </div>

        <div className="t-stagger-line tile p-5 sm:p-7 lg:col-span-7" style={{ "--i": 1 } as CSSProperties}>
          <div className="relative">
            <input
              ref={input}
              id="bands-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setChanges((c) => c + 1);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-describedby="bands-result"
              className="tabular h-16 w-full rounded-2xl bg-panel px-5 font-display text-[28px] caret-brand outline-none ring-brand transition-shadow duration-[var(--duration-quick)] focus:ring-2 sm:text-[34px]"
            />
            <span
              ref={mirror}
              className="tabular pointer-events-none invisible absolute top-0 left-5 font-display text-[28px] whitespace-pre sm:text-[34px]"
              aria-hidden="true"
            >
              {value}
            </span>
            {!focused && caretX !== null && (
              <span
                className="lp-caret pointer-events-none absolute top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full bg-brand"
                style={{ left: caretX + 20 }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Module bands and Overall band">
            {MODULES.map((name, i) => (
              <div key={name} className="rounded-2xl bg-panel p-3.5">
                <div className="flex items-center gap-1.5 text-[13px] text-soft">
                  <span aria-hidden className={`size-1.5 rounded-full ${MODULE_HUE[name]}`} />
                  {name}
                </div>
                <div className="tabular mt-2 font-display text-[28px]">
                  <span key={`${changes}-${i}`} className={parsed.ok ? "t-pop" : undefined}>
                    {parsed.ok ? formatBand(parsed.bands[i]) : "—"}
                  </span>
                </div>
              </div>
            ))}
            <div className="col-span-2 rounded-2xl bg-brand p-3.5 text-white sm:col-span-1">
              <div className="text-[13px] text-white/80">Overall band</div>
              <div className="tabular mt-2 font-display text-[28px]">
                <span key={`o-${result?.overall ?? "x"}`} className={result ? "t-pop" : undefined}>
                  {result ? formatBand(result.overall) : "—"}
                </span>
              </div>
            </div>
          </div>

          <p
            id="bands-result"
            className={`mt-4 min-h-[3em] text-[14px] ${parsed.ok ? "text-soft" : "text-bad"}`}
            aria-live="polite"
          >
            {parsed.ok && result ? (
              <>
                ({parsed.bands.map(formatBand).join(" + ")}) ÷ 4 = {formatMean(result.mean)}. {result.why}
              </>
            ) : (
              !parsed.ok && parsed.message
            )}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
