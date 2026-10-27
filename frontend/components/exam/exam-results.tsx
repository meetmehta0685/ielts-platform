"use client";

import Link from "next/link";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BandDigits, SuccessCheck } from "./exam-frame";
import { answerLabel, type ExamQuestion } from "./question-field";

export interface ObjectiveResult {
  score: number;
  total_questions: number;
  band_score: number;
  details: Record<number, { correct: boolean; correctAnswer: string; submittedAnswer: string }>;
  explanations: Record<number, string>;
}

/** The marked paper: band, raw score, then every question with the learner's answer and the key. */
export function ObjectiveResults({
  module,
  result,
  questions,
  justMarked,
}: {
  module: "Reading" | "Listening";
  result: ObjectiveResult;
  questions: ExamQuestion[];
  justMarked: boolean;
}) {
  const details = result.details ?? {};
  const explanations = result.explanations ?? {};
  const incorrect = questions.filter((q) => details[q.id] && !details[q.id].correct);
  const unanswered = questions.filter((q) => details[q.id] && !details[q.id].submittedAnswer?.trim());
  const missingExplanations = incorrect.filter((q) => !explanations[q.id]?.trim());
  const band = Number.isFinite(result.band_score) ? result.band_score.toFixed(1) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <Panel className="sm:col-span-2 lg:col-span-6" title={`${module} band`} aside={justMarked ? <MarkedNow /> : "From your saved attempt"}>
          <p className="font-display text-[104px] leading-[0.92] text-ink sm:text-[128px]">
            {band ? <BandDigits value={band} /> : "—"}
          </p>
          <p className="mt-4 text-[15px] text-soft">
            Estimated on the 40-question IELTS scale from {result.score} of {result.total_questions} correct.
          </p>
        </Panel>
        <Panel className="lg:col-span-3" title="Raw score">
          <p className="tabular text-[48px] leading-none text-ink">
            {result.score}
            <span className="text-soft"> / {result.total_questions}</span>
          </p>
          <p className="mt-3 text-[15px] text-soft">Questions answered correctly</p>
        </Panel>
        <Panel className="lg:col-span-3" title="To review">
          <p className={cn("tabular text-[48px] leading-none", incorrect.length > 0 ? "text-bad" : "text-ink")}>
            {incorrect.length}
          </p>
          <p className="mt-3 text-[15px] text-soft">
            {incorrect.length === 0
              ? "Nothing missed on this paper"
              : unanswered.length > 0
                ? `Incorrect, including ${unanswered.length} left blank`
                : "Incorrect answers"}
          </p>
        </Panel>
      </div>

      <section className="rounded-2xl bg-panel p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Question by question</h2>
          <p className="text-[14px] text-soft">Your answer, the answer key, and why</p>
        </div>

        {missingExplanations.length > 0 && (
          <p className="mb-2 rounded-xl bg-sheet px-4 py-3 text-[14px] leading-normal text-soft">
            {missingExplanations.length === incorrect.length ? "No AI explanations came back" : "Some AI explanations did not come back"}{" "}
            for this attempt. The marking is done locally and is final; only the written commentary is missing.
          </p>
        )}

        <div className="hidden pt-2 pb-1 text-[13px] text-soft md:grid md:grid-cols-[32px_minmax(0,1fr)_180px_180px_96px] md:gap-x-5">
          <span />
          <span>Question</span>
          <span>Your answer</span>
          <span>Answer key</span>
          <span className="text-right">Mark</span>
        </div>
        <ol>
          {questions.map((q, index) => {
            const detail = details[q.id];
            const explanation = explanations[q.id]?.trim();
            const correct = detail?.correct;
            const submitted = detail?.submittedAnswer?.trim();
            return (
              <li
                key={q.id}
                className="t-rise grid grid-cols-[32px_1fr] gap-x-3 gap-y-3 border-t border-[#e4e0d8] py-4 md:grid-cols-[32px_minmax(0,1fr)_180px_180px_96px] md:gap-x-5"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <span className="tabular pt-0.5 text-[15px] font-medium text-ink">{q.id}</span>
                <div className="min-w-0">
                  <p className="text-[15px] leading-normal text-ink">{q.questionText}</p>
                </div>
                <dl className="col-start-2 grid grid-cols-2 gap-3 md:contents">
                  <div>
                    <dt className="text-[13px] text-soft md:sr-only">Your answer</dt>
                    <dd className={cn("text-[15px]", submitted ? "text-ink" : "text-soft")}>
                      {submitted ? answerLabel(q, submitted) : "Not answered"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-soft md:sr-only">Answer key</dt>
                    <dd className="text-[15px] text-ink">{detail ? answerLabel(q, detail.correctAnswer) : "—"}</dd>
                  </div>
                </dl>
                <p
                  className={cn(
                    "col-start-2 text-[15px] font-medium md:col-start-auto md:text-right",
                    !detail ? "text-soft" : correct ? "text-good" : "text-bad"
                  )}
                >
                  {!detail ? "—" : correct ? "Correct" : "Incorrect"}
                </p>
                {detail && !correct && (
                    <p className="col-start-2 text-[14px] leading-normal text-soft md:col-span-4 md:-mt-1 md:max-w-[72ch]">
                      {explanation ? (
                        <>
                          <span className="font-medium text-ink">Why: </span>
                          {explanation}
                        </>
                      ) : (
                        "Explanation unavailable for this question."
                      )}
                    </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function MarkedNow() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <SuccessCheck />
      Marked just now
    </span>
  );
}

export function ResultActions({ onRetry, retryLabel }: { onRetry: () => void; retryLabel: string }) {
  return (
    <>
      <Button variant="secondary" asChild>
        <Link href="/records">All results</Link>
      </Button>
      <Button variant="accent" onClick={onRetry}>
        {retryLabel}
      </Button>
    </>
  );
}
