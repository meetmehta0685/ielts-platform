"use client";

import { useState, type CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";

const FEATURES = [
  {
    sentence: "Get every essay marked on all four criteria.",
    consequence:
      "Four criterion bands, each correction with the rule behind it, and a rewritten version of your essay. Task 1 from 150 words, Task 2 from 250.",
    fill: "var(--putty-deep)",
    dark: false,
  },
  {
    sentence: "Have every spoken answer scored.",
    consequence:
      "Groq Whisper writes out what you said, then you get four bands: fluency and coherence, lexical resource, grammatical range, pronunciation.",
    fill: "var(--ink)",
    dark: true,
  },
  {
    sentence: "Turn a reading score into a band.",
    consequence:
      "Reading and listening raw marks out of 40 become a band on the standard table, with a one-line reason for every answer you got wrong.",
    fill: "var(--sheet)",
    dark: false,
  },
  {
    sentence: "Let your plan chase your weakest module.",
    consequence:
      "Weekly milestones built from your target band and exam date, rebuilt around the module where your scores sit lowest.",
    fill: "#c9c4bb",
    dark: false,
  },
];

export function Switches() {
  const [on, setOn] = useState<boolean[]>([true, false, true, false]);

  return (
    <section className="lp-switches" aria-labelledby="switch-0">
      <Reveal>
        {FEATURES.map((f, i) => (
          <div
            key={f.sentence}
            className={`lp-band t-stagger-line ${on[i] ? "is-on" : ""} ${f.dark ? "is-dark" : ""}`}
            style={{ "--i": i, backgroundColor: on[i] ? f.fill : "var(--putty)" } as CSSProperties}
          >
            <div className="lp-band-inner lp-wrap">
              <div className="lp-band-text">
                {i === 0 ? (
                  <h2 id="switch-0" className="lp-band-sentence">
                    {f.sentence}
                  </h2>
                ) : (
                  <h3 id={`switch-${i}`} className="lp-band-sentence">
                    {f.sentence}
                  </h3>
                )}
                <div className="lp-band-more" id={`switch-more-${i}`}>
                  <div>
                    <p aria-hidden={!on[i]}>{f.consequence}</p>
                  </div>
                </div>
              </div>
              <div className="lp-band-switch" data-ui>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on[i]}
                  aria-labelledby={`switch-${i}`}
                  aria-controls={`switch-more-${i}`}
                  className="lp-switch-hit"
                  onClick={() => setOn((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                >
                  <span className="lp-switch" data-on={on[i]} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
