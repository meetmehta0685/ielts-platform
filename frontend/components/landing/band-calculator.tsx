"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";
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
      setCaretX(w + 6 < i.clientWidth ? w + 6 : null);
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
    <section id="your-bands" className="lp-section lp-wrap" aria-labelledby="bands-title">
      <Reveal className="lp-grid">
        <h2 id="bands-title" className="lp-showcase-title lp-lead t-stagger-line" style={{ "--i": 0 } as CSSProperties}>
          <label htmlFor="bands-input">Type your four module bands, in report order.</label>
        </h2>

        <div className="lp-typed t-stagger-line" style={{ "--i": 1 } as CSSProperties} data-ui>
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
          />
          <span ref={mirror} className="lp-mirror" aria-hidden="true">
            {value}
          </span>
          {!focused && caretX !== null && (
            <span className="lp-caret" style={{ left: caretX }} aria-hidden="true" />
          )}
          <div className="lp-typed-rule" aria-hidden="true" />
        </div>

        <div className="lp-answer t-stagger-line" style={{ "--i": 2 } as CSSProperties}>
          <div className="lp-trf" data-ui>
            <div className="lp-trf-head">
              <span>Test Report Form, estimated</span>
              <span>Academic</span>
            </div>
            <div className="lp-trf-row" role="group" aria-label="Module bands and Overall band">
              {MODULES.map((name, i) => (
                <div className="lp-trf-cell" key={name}>
                  <div className="lp-trf-label">{name}</div>
                  <div className="lp-trf-figure">
                    <span key={`${changes}-${i}`} className={parsed.ok ? "t-pop" : undefined}>
                      {parsed.ok ? formatBand(parsed.bands[i]) : "—"}
                    </span>
                  </div>
                </div>
              ))}
              <div className="lp-trf-cell">
                <div className="lp-trf-label">Overall band</div>
                <div className="lp-trf-figure">
                  <span key={`o-${result?.overall ?? "x"}`} className={result ? "t-pop" : undefined}>
                    {result ? formatBand(result.overall) : "—"}
                  </span>
                </div>
              </div>
            </div>
            <p id="bands-result" className={`lp-trf-why ${parsed.ok ? "" : "lp-trf-error"}`} aria-live="polite">
              {parsed.ok && result ? (
                <>
                  ({parsed.bands.map(formatBand).join(" + ")}) ÷ 4 = {formatMean(result.mean)}. {result.why}
                </>
              ) : (
                !parsed.ok && parsed.message
              )}
            </p>
          </div>

          <div className="lp-examples">
            <span className="lp-small lp-soft">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.value}
                type="button"
                className="lp-example"
                onClick={() => fill(ex.value)}
                aria-label={`Fill in ${ex.value}, which ${ex.note}`}
              >
                {ex.value}
              </button>
            ))}
          </div>
        </div>

        <figure className="lp-answer-photo t-stagger-line" style={{ "--i": 3 } as CSSProperties}>
          <div className="lp-frame lp-open">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="lp-photo"
              src="/landing/side-view-of-students-writing-examination-in.jpg"
              width={1920}
              height={1083}
              alt="Candidates writing an examination at rows of desks, seen from the side of the room"
              loading="lazy"
              style={{ objectPosition: "28% 40%" }}
            />
          </div>
          <figcaption className="lp-caption">An examination at Augustine University, Lagos, February 2025.</figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
