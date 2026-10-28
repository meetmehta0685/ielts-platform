"use client";

import { useState, type ReactNode } from "react";

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: "Is this an official IELTS score?",
    a: (
      <>
        <p>
          No. It is an estimate. Writing and speaking are marked by AI against the public band descriptors, and
          reading and listening raw marks are converted with the usual 40-question table.
        </p>
        <p>
          Only a test centre issues a Test Report Form. This is an independent practice tool, not affiliated with
          IELTS, the British Council, IDP or Cambridge University Press &amp; Assessment.
        </p>
      </>
    ),
  },
  {
    q: "Which modules can I practise?",
    a: (
      <p>
        All four. Listening and Reading as timed tests, Writing Task 1 and Task 2, and Speaking Parts 1, 2 and 3. Take
        them one at a time, or together in the full mock, which ends in one combined report.
      </p>
    ),
  },
  {
    q: "Is it free?",
    a: (
      <p>
        Yes. Create an account with your email or with Google and every module is open. There is no paid plan and no
        card to enter.
      </p>
    ),
  },
  {
    q: "How is speaking marked?",
    a: (
      <>
        <p>
          In practice mode your browser records the answer, Groq Whisper turns it into a transcript, and the AI scores
          it on fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation.
          Pronunciation is judged from the transcript, so read that band as a guide.
        </p>
        <p>In the full mock, a live AI examiner runs the three-part interview with you by voice.</p>
      </>
    ),
  },
  {
    q: "Academic or General Training?",
    a: (
      <p>
        The bundled reading and listening tests are Academic-style. Writing Task 1 offers both an Academic chart task
        and a General Training letter, and Task 2 essays are the same for both.
      </p>
    ),
  },
  {
    q: "Where do my results go?",
    a: (
      <p>
        Every attempt is saved to your records, and the dashboard tracks your bands against the target you set. Your
        work is visible to your account only.
      </p>
    ),
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="questions" className="lp-wrap scroll-mt-24 py-20 lg:py-28" aria-labelledby="faq-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
        <h2 id="faq-title" className="max-w-[12ch] font-display text-[36px] text-balance sm:text-[52px] lg:col-span-5">
          Questions before you start.
        </h2>
        <div className="flex flex-col border-b border-border lg:col-span-7">
          {QUESTIONS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="lp-acc border-t border-border" data-open={isOpen}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="group flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-medium"
                  >
                    {item.q}
                    <svg className="lp-acc-chevron size-4 shrink-0 text-soft transition-colors group-hover:text-ink" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="lp-acc-panel">
                  <div className="lp-acc-inner">
                    <div className="flex max-w-[60ch] flex-col gap-3 pb-6 text-[15px] leading-relaxed text-soft">
                      {item.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
