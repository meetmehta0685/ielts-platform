"use client";

import { useMemo, useRef, useState } from "react";
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
  const [changes, setChanges] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseBands(value), [value]);
  const result = parsed.ok ? overallBand(parsed.bands) : null;

  const fill = (next: string) => {
    setValue(next);
    setChanges((c) => c + 1);
    input.current?.focus();
  };

  return (
    <section id="your-bands" className="lp-wrap scroll-mt-24 py-20 lg:py-28" aria-labelledby="bands-title">
      <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5">
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
                className="tabular h-9 rounded-[8px] bg-panel-strong px-3 text-[14px] transition-[background-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-panel-hover active:scale-[0.97]"
                onClick={() => fill(ex.value)}
                aria-label={`Fill in ${ex.value}, which ${ex.note}`}
              >
                {ex.value}
              </button>
            ))}
          </div>
        </div>

        <div className="tile p-5 sm:p-7 lg:col-span-7">
          <div>
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
              aria-describedby="bands-result"
              className="tabular h-16 w-full rounded-[12px] bg-panel px-5 font-display text-[28px] tracking-[-0.02em] caret-brand shadow-[inset_0_0_0_1px_var(--border)] outline-none transition-shadow duration-[var(--duration-quick)] hover:shadow-[inset_0_0_0_1px_var(--input)] focus:shadow-[inset_0_0_0_2px_var(--brand)] sm:text-[34px]"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Module bands and Overall band">
            {MODULES.map((name, i) => (
              <div key={name} className="rounded-[12px] bg-panel p-3.5">
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
            <div className="col-span-2 rounded-[12px] bg-brand p-3.5 text-white sm:col-span-1">
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
      </div>
    </section>
  );
}
