"use client";

import type { ReactNode } from "react";

export interface Correction {
  original: string;
  correction: string;
  explanation: string;
}

/**
 * The candidate's essay with each correction set inline: the original struck through, the
 * correction beside it, and the examiner's reason on hover or keyboard focus. Matching and overlap
 * handling are unchanged from the original page.
 */
export function MarkedEssay({ essayText, corrections }: { essayText: string; corrections: Correction[] }) {
  if (!corrections || corrections.length === 0) {
    return <p className="whitespace-pre-wrap">{essayText}</p>;
  }

  interface Match {
    start: number;
    end: number;
    original: string;
    correction: string;
    explanation: string;
  }

  const matches: Match[] = [];

  corrections.forEach((corr) => {
    if (!corr.original || corr.original.trim() === "") return;

    let idx = essayText.indexOf(corr.original);
    while (idx !== -1) {
      matches.push({
        start: idx,
        end: idx + corr.original.length,
        original: corr.original,
        correction: corr.correction,
        explanation: corr.explanation,
      });
      idx = essayText.indexOf(corr.original, idx + 1);
    }
  });

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const nonOverlapping: Match[] = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  const nodes: ReactNode[] = [];
  let currentIdx = 0;

  nonOverlapping.forEach((match, i) => {
    if (match.start > currentIdx) nodes.push(essayText.slice(currentIdx, match.start));

    nodes.push(
      <span
        key={`corr-${i}`}
        tabIndex={0}
        className="group/fix relative rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <del className="text-soft decoration-bad decoration-[1.5px]">{match.original}</del>{" "}
        <ins className="rounded-[4px] bg-brand-tint px-0.5 text-ink no-underline">{match.correction}</ins>
        {match.explanation && (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-72 animate-[t-rise_var(--duration-quick)_var(--ease-smooth-out)_both] rounded-xl bg-ink p-3 text-sm leading-normal text-white md:group-hover/fix:block md:group-focus/fix:block motion-reduce:animate-none"
          >
            {match.explanation}
          </span>
        )}
      </span>
    );

    currentIdx = match.end;
  });

  if (currentIdx < essayText.length) nodes.push(essayText.slice(currentIdx));

  return <div className="whitespace-pre-wrap">{nodes}</div>;
}

/** Every correction as its own ruled row: the sentence struck, the fix beside it, then why. */
export function CorrectionList({ corrections }: { corrections: Correction[] }) {
  if (!corrections.length) {
    return <p className="text-[15px] text-soft">The marker found no sentences to correct in this essay.</p>;
  }
  return (
    <ol className="flex flex-col">
      {corrections.map((corr, idx) => (
        <li key={idx} className="grid gap-x-6 gap-y-2 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-2">
          <p className="text-[15px] leading-relaxed text-soft">
            <del className="decoration-bad decoration-[1.5px]">{corr.original}</del>
          </p>
          <p className="text-[15px] leading-relaxed font-medium text-ink">
            <ins className="no-underline">{corr.correction}</ins>
          </p>
          {corr.explanation && (
            <p className="text-sm leading-normal text-soft md:col-span-2">{corr.explanation}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
