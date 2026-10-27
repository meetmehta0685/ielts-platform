import type { CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

const CREDITS = [
  {
    title: "Back view of students writing examination in Augustine University",
    page: "https://commons.wikimedia.org/wiki/File:BACK_VIEW_OF_STUDENTS_WRITING_EXAMINATION_IN_AUGUSTINE_UNIVERSITY,_ILARA_EPE,_EPE,_LAGOS_STATE.jpg",
    by: "Addjimedu",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
  },
  {
    title: "Side view of students writing examination in Augustine University",
    page: "https://commons.wikimedia.org/wiki/File:SIDE_VIEW_OF_STUDENTS_WRITING_EXAMINATION_IN_AUGUSTINE_UNIVERSITY,_ILARA_EPE,_EPE,_LAGOS_STATE.jpg",
    by: "Addjimedu",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
  },
  {
    title: "University of Edinburgh Lecture Theatre",
    page: "https://commons.wikimedia.org/wiki/File:University_of_Edinburgh_Lecture_Theatre_(28779436435).jpg",
    by: "Open Ed",
    licence: "CC BY 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0",
  },
  {
    title: "Graz University-Library reading-room",
    page: "https://commons.wikimedia.org/wiki/File:Graz_University-Library_reading-room.jpg",
    by: "Dr. Marcus Gossler",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    title: "Writing with fountain pen",
    page: "https://commons.wikimedia.org/wiki/File:Writing_with_fountain_pen.mpg",
    by: "Wasiul Bahar",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    title: "Interview room empty chair",
    page: "https://commons.wikimedia.org/wiki/File:Interview_room_empty_chair.jpg",
    by: "Blsamue",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    title: "Test (student assessment)",
    page: "https://commons.wikimedia.org/wiki/File:Test_(student_assessment).jpeg",
    by: "KF",
    licence: "public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
  },
];

export function Cta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="lp-cta" aria-labelledby="cta-title">
      <h2 id="cta-title" className="contents">
        <span className="lp-cta-line block">Practise one module,</span>
        <span className="lp-cta-line block self-end order-last">or sit the full mock?</span>
      </h2>
      <Reveal className="lp-cta-mid">
        <div className="lp-cta-choice">
          <Button asChild variant="accent" size="lg" className="t-stagger-line min-w-[220px] text-[17px]" style={{ "--i": 0 } as CSSProperties}>
            <Link href={signedIn ? "/dashboard" : "/auth/signup"}>Practise one module</Link>
          </Button>
          <span className="lp-cta-or t-stagger-line" style={{ "--i": 1 } as CSSProperties}>
            or
          </span>
          <Button
            asChild
            size="lg"
            className="lp-btn-light t-stagger-line min-w-[220px] text-[17px]"
            style={{ "--i": 2 } as CSSProperties}
          >
            <Link href="/simulator">Sit the full mock</Link>
          </Button>
        </div>
        <p className="lp-cta-note t-stagger-line" style={{ "--i": 3 } as CSSProperties}>
          Both start from a free account, and every result is saved to your records.
        </p>
      </Reveal>
    </section>
  );
}

export function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="lp-foot" aria-labelledby="foot-name">
      <Reveal className="lp-wrap">
        <p id="foot-name" className="lp-wordmark t-stagger-line" aria-label="IELTS AI Prep">
          IELTS AI Prep
        </p>

        <div className="lp-grid lp-foot-row">
          <nav className="lp-foot-ways t-stagger-line" style={{ "--i": 1 } as CSSProperties} aria-label="Practise">
            <ul>
              <li>
                <Link className="lp-link" href="/listening">
                  Listening
                </Link>
              </li>
              <li>
                <Link className="lp-link" href="/reading">
                  Reading
                </Link>
              </li>
              <li>
                <Link className="lp-link" href="/writing">
                  Writing
                </Link>
              </li>
              <li>
                <Link className="lp-link" href="/speaking">
                  Speaking
                </Link>
              </li>
              <li>
                <Link className="lp-link" href="/simulator">
                  The full mock
                </Link>
              </li>
            </ul>
          </nav>

          <div className="lp-foot-cols t-stagger-line" style={{ "--i": 2 } as CSSProperties}>
            <div>
              <h3>Account</h3>
              <ul>
                {signedIn ? (
                  <li>
                    <Link className="lp-link" href="/dashboard">
                      Dashboard
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link className="lp-link" href="/auth/signup">
                        Create an account
                      </Link>
                    </li>
                    <li>
                      <Link className="lp-link" href="/auth/login">
                        Log in
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link className="lp-link" href="/records">
                    Your records
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3>Between tests</h3>
              <ul>
                <li>
                  <Link className="lp-link" href="/chat">
                    AI mentor
                  </Link>
                </li>
                <li>
                  <Link className="lp-link" href="/planner">
                    Study planner
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3>On this page</h3>
              <ul>
                <li>
                  <a className="lp-link" href="#your-bands">
                    Overall band
                  </a>
                </li>
                <li>
                  <a className="lp-link" href="#how-it-works">
                    How a sitting runs
                  </a>
                </li>
                <li>
                  <a className="lp-link" href="#questions">
                    Questions
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="lp-credits t-stagger-line" style={{ "--i": 3 } as CSSProperties}>
          Pictures and footage, shown in black and white:{" "}
          {CREDITS.map((c, i) => (
            <span key={c.page}>
              <a href={c.page} rel="noopener">
                “{c.title}”
              </a>{" "}
              by {c.by},{" "}
              <a href={c.licenceUrl} rel="noopener license">
                {c.licence}
              </a>
              , via Wikimedia Commons{i < CREDITS.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
      </Reveal>

      <div className="lp-legal lp-wrap">
        <span>
          An independent practice tool, not affiliated with IELTS, the British Council, IDP or Cambridge University
          Press &amp; Assessment. Bands shown here are estimates.
        </span>
        <a className="lp-link whitespace-nowrap" href="#top">
          Back to the top
        </a>
      </div>
    </footer>
  );
}
