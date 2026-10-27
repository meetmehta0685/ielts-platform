import type { CSSProperties, ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { LoopVideo } from "./loop-video";

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
  return (
    <section id="questions" className="lp-section lp-wrap" aria-labelledby="faq-title">
      <Reveal className="lp-grid lp-faq-row">
        <h2 id="faq-title" className="lp-faq-q lp-soft t-stagger-line" style={{ "--i": 0 } as CSSProperties}>
          Questions people ask before they start
        </h2>
        <figure className="lp-faq-pic t-stagger-line" style={{ "--i": 1 } as CSSProperties}>
          <div className="lp-frame lp-open">
            <LoopVideo
              src="/landing/writing-with-fountain-pen.webm"
              poster="/landing/writing-with-fountain-pen-poster.jpg"
              width={854}
              height={436}
              label="A hand writing on white paper with a fountain pen"
            />
          </div>
          <figcaption className="lp-caption">Writing with a fountain pen.</figcaption>
        </figure>
      </Reveal>
      {QUESTIONS.map((item) => (
        <Reveal key={item.q} className="lp-grid lp-faq-row">
          <h3 className="lp-faq-q t-stagger-line" style={{ "--i": 0 } as CSSProperties}>
            {item.q}
          </h3>
          <div className="lp-faq-a t-stagger-line" style={{ "--i": 1 } as CSSProperties}>
            {item.a}
          </div>
        </Reveal>
      ))}
    </section>
  );
}
