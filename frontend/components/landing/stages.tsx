"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion/reveal";

type Stage = {
  name: string;
  minutes: string;
  clause: string;
  body: string;
  picture: { src: string; width: number; height: number; alt: string; caption: string };
};

const STAGES: Stage[] = [
  {
    name: "Listening",
    minutes: "30 min",
    clause: "First, 30 minutes of listening.",
    body: "Four recordings, forty questions, each recording played once. Answers are checked and your raw score becomes a band.",
    picture: {
      src: "/landing/university-of-edinburgh-lecture-theatre-28779436435.jpg",
      width: 1920,
      height: 1440,
      alt: "Empty rows of wooden benches in a university lecture theatre",
      caption: "Lecture theatre, University of Edinburgh.",
    },
  },
  {
    name: "Reading",
    minutes: "60 min",
    clause: "Then 60 minutes of reading.",
    body: "Three long passages and forty questions: True / False / Not given, matching headings, sentence completion. A one-line reason comes back for every miss.",
    picture: {
      src: "/landing/graz-university-library-reading-room.jpg",
      width: 1600,
      height: 1200,
      alt: "A long library reading room with rows of wooden desks and white reading lamps",
      caption: "Reading room, Graz University Library.",
    },
  },
  {
    name: "Writing",
    minutes: "60 min",
    clause: "Then 60 minutes of writing.",
    body: "Task 1 in 20 minutes and at least 150 words, Task 2 in 40 minutes and at least 250. Each is marked on the four criteria.",
    picture: {
      src: "/landing/test-student-assessment.jpg",
      width: 1920,
      height: 1316,
      alt: "Students writing a test at separate desks in a bright university room",
      caption: "End-of-term test, University of Vienna, June 2005.",
    },
  },
  {
    name: "Speaking",
    minutes: "11–14 min",
    clause: "Last, 11–14 minutes of speaking.",
    body: "Three parts with an examiner. In Part 2 you get a cue card, one minute to prepare and up to two minutes to speak.",
    picture: {
      src: "/landing/interview-room-empty-chair.jpg",
      width: 1696,
      height: 954,
      alt: "An empty wooden chair on the far side of a table, in front of a blackboard",
      caption: "The chair across the table.",
    },
  },
];

function useCountdown(active: boolean, from: number) {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : from)), 1000);
    return () => window.clearInterval(id);
  }, [active, from]);
  return left;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; // taste-skill-ignore: a clock

function ListeningFragment({ active }: { active: boolean }) {
  const left = useCountdown(active, 28 * 60 + 41);
  return (
    <div className="lp-ui" data-ui>
      <div className="lp-ui-bar">
        <span>Listening · Part 1</span>
        <span className="lp-ui-timer" aria-label={`${clock(left)} left`}>
          {clock(left)}
        </span>
      </div>
      <div className="lp-ui-body">
        <p className="lp-ui-note">Questions 1–4. Complete the form. Write ONE WORD AND/OR A NUMBER for each answer.</p>
        <p className="mt-3 font-medium">Library membership form</p>
        <ol className="mt-2 space-y-2.5">
          <li>
            Surname: <span className="lp-ui-field">Morgan</span> <span className="lp-ui-note">1</span>
          </li>
          <li>
            Postcode: <span className="lp-ui-field">CB2 1TN</span> <span className="lp-ui-note">2</span>
          </li>
          <li>
            Preferred day: <span className="lp-ui-field is-active">Thurs</span> <span className="lp-ui-note">3</span>
          </li>
          <li>
            Annual fee: £<span className="lp-ui-field" aria-label="empty answer">&nbsp;</span>{" "}
            <span className="lp-ui-note">4</span>
          </li>
        </ol>
        <div className="lp-ui-audio" aria-hidden="true">
          <span className="lp-ui-note tabular">1:12</span>
          <span className="lp-ui-audio-bar">
            <span style={{ transform: "scaleX(0.34)" }} />
          </span>
          <span className="lp-ui-note">Played once</span>
        </div>
      </div>
    </div>
  );
}

function ReadingFragment({ active }: { active: boolean }) {
  const left = useCountdown(active, 54 * 60 + 10);
  return (
    <div className="lp-ui" data-ui>
      <div className="lp-ui-bar">
        <span>Reading · Passage 1</span>
        <span className="lp-ui-timer" aria-label={`${clock(left)} left`}>
          {clock(left)}
        </span>
      </div>
      <div className="lp-ui-body">
        <p className="lp-ui-note">
          Questions 8–10. Do the following statements agree with the information in the passage?
        </p>
        <p className="mt-3">
          <span className="lp-ui-note">8 </span>The reading room was first opened to students in 1895.
        </p>
        <div role="radiogroup" aria-label="Question 8">
          {["True", "False", "Not given"].map((c) => (
            <div key={c} className={`lp-ui-choice ${c === "Not given" ? "is-picked" : ""}`} role="radio" aria-checked={c === "Not given"}>
              <span className="lp-ui-dot" />
              {c}
            </div>
          ))}
        </div>
        <p className="lp-ui-note mt-3">Question 8 of 40</p>
      </div>
    </div>
  );
}

function WritingFragment() {
  return (
    <div className="lp-ui" data-ui>
      <div className="lp-ui-bar">
        <span>Writing Task 2 · marked</span>
        <span className="tabular">263 words</span>
      </div>
      <div className="lp-ui-body">
        <p className="lp-ui-essay">
          Many people <del>believes</del> <ins>believe</ins> that universities should prepare graduates for work,
          while others argue that knowledge has value for its own sake.
        </p>
        <p className="lp-ui-note mt-2">Subject–verb agreement: a plural subject takes “believe”.</p>
        <div className="lp-ui-crit">
          <span>Task response</span>
          <b>6.5</b>
          <span>Coherence and cohesion</span>
          <b>7</b>
          <span>Lexical resource</span>
          <b>6.5</b>
          <span>Grammatical range and accuracy</span>
          <b>6</b>
        </div>
      </div>
    </div>
  );
}

function SpeakingFragment({ active }: { active: boolean }) {
  const left = useCountdown(active, 60);
  return (
    <div className="lp-ui" data-ui>
      <div className="lp-ui-bar">
        <span>Speaking · Part 2</span>
        <span className="lp-ui-timer" aria-label={`${clock(left)} to prepare`}>
          {clock(left)}
        </span>
      </div>
      <div className="lp-ui-body">
        <div className="lp-ui-cue">
          <p className="font-medium">Describe a place where you like to study.</p>
          <p className="lp-ui-note mt-1">You should say:</p>
          <ul>
            <li>where it is</li>
            <li>when you go there</li>
            <li>what you do there</li>
          </ul>
          <p>and explain why it is a good place for you to study.</p>
        </div>
        <p className="lp-ui-note mt-3">One minute to prepare. Then speak for up to two minutes.</p>
      </div>
    </div>
  );
}

export function Stages() {
  const [stage, setStage] = useState(0);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLElement>(null);
  const current = STAGES[stage];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const stops = STAGES.map((s, i) => (
    <button
      key={s.name}
      type="button"
      className="lp-stop"
      aria-pressed={i === stage}
      onClick={() => setStage(i)}
      style={
        i === 0
          ? { left: 0 }
          : i === STAGES.length - 1
            ? { right: 0 }
            : { left: `calc(16px + (100% - 32px) * ${i / 3})`, transform: "translateX(-50%)" }
      }
    >
      {s.name} <span className="lp-soft">{s.minutes}</span>
    </button>
  ));

  return (
    <section id="how-it-works" ref={root} className="lp-stages" aria-labelledby="stage-clause">
      <div className="lp-stage-text">
        <Reveal>
          <h2 id="stage-clause" key={`c-${stage}`} className="lp-head lp-stage-clause lp-fade t-stagger-line" aria-live="polite">
            {current.clause}
          </h2>
        </Reveal>
        <div className="lp-stage-body" key={`b-${stage}`}>
          <figure className="lp-fade">
            <div className="lp-frame lp-stage-pic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="lp-photo"
                src={current.picture.src}
                width={current.picture.width}
                height={current.picture.height}
                alt={current.picture.alt}
                loading="lazy"
              />
            </div>
            <figcaption className="lp-caption">{current.picture.caption}</figcaption>
          </figure>
          <p className="lp-fade">{current.body}</p>
        </div>
      </div>

      <div className="lp-stage-field">
        <div key={`f-${stage}`} className="lp-fade w-full grid place-items-center">
          {stage === 0 && <ListeningFragment active={inView} />}
          {stage === 1 && <ReadingFragment active={inView} />}
          {stage === 2 && <WritingFragment />}
          {stage === 3 && <SpeakingFragment active={inView} />}
        </div>
      </div>

      <div className="lp-slider">
        <div className="lp-slider-half" aria-hidden="true" />
        <div className="lp-slider-inner">
          <div className="lp-track">
            <span className="lp-track-bg" aria-hidden="true" />
            <span className="lp-track-fill" aria-hidden="true" style={{ transform: `scaleX(${stage / 3})` }} />
            <input
              className="lp-range"
              type="range"
              min={0}
              max={3}
              step={1}
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
              aria-label="Stage of the test"
              aria-valuetext={`${current.name}, ${current.minutes}`}
            />
          </div>
          <div className="lp-stops">{stops}</div>
          <div className="lp-stops-grid">
            {STAGES.map((s, i) => (
              <button key={s.name} type="button" aria-pressed={i === stage} onClick={() => setStage(i)}>
                {s.name} <span className="lp-soft">{s.minutes}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
