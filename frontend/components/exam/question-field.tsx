"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ExamQuestion = {
  id: number;
  type: "multiple-choice" | "true-false-not-given" | "fill-gap";
  questionText: string;
  options?: string[];
};

const TFNG = [
  { value: "TRUE", label: "True" },
  { value: "FALSE", label: "False" },
  { value: "NOT GIVEN", label: "Not given" },
];

export const questionTypeLabel: Record<ExamQuestion["type"], string> = {
  "true-false-not-given": "True / False / Not given",
  "multiple-choice": "Multiple choice",
  "fill-gap": "Complete the sentence",
};

/** How a stored answer reads back to the learner ("NOT GIVEN" -> "Not given"). */
export function answerLabel(question: ExamQuestion | undefined, value: string | undefined) {
  if (!value) return "";
  if (question?.type === "true-false-not-given") {
    return TFNG.find((o) => o.value === value.toUpperCase())?.label ?? value;
  }
  if (question?.type === "multiple-choice") {
    const option = question.options?.find((o) => o.charAt(0).toUpperCase() === value.charAt(0).toUpperCase());
    return option ?? value;
  }
  return value;
}

function splitOption(option: string) {
  const match = option.match(/^([A-Z])[).:]\s*(.*)$/);
  return match ? { letter: match[1], text: match[2] } : { letter: option.charAt(0), text: option };
}

/** One exam question with large controls; `value` keeps the backend's answer format. */
export function QuestionField({
  question,
  value,
  onChange,
  disabled,
  textClass = "text-[16px]",
}: {
  question: ExamQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  textClass?: string;
}) {
  const answered = value.trim() !== "";
  const labelId = `q-${question.id}-label`;

  return (
    <fieldset id={`q-${question.id}`} className="scroll-mt-6 border-0 p-0" aria-labelledby={labelId}>
      <div className="flex gap-3">
        <span
          className={cn(
            "tabular inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-medium transition-colors duration-[var(--duration-quick)]",
            answered ? "bg-ink text-white" : "bg-sheet text-ink ring-1 ring-input ring-inset"
          )}
        >
          {question.id}
        </span>
        <p id={labelId} className={cn("pt-1 leading-normal text-ink", textClass)}>
          {question.questionText}
        </p>
      </div>

      <div className="mt-3 pl-11">
        {question.type === "true-false-not-given" && (
          <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
            {TFNG.map((option) => {
              const selected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(option.value)}
                  className={cn(
                    "h-11 rounded-full text-[15px] font-medium transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50",
                    selected
                      ? "bg-ink text-white"
                      : "bg-sheet text-ink ring-1 ring-input ring-inset hover:bg-panel-strong"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {question.type === "multiple-choice" && (
          <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
            {(question.options ?? []).map((option) => {
              const { letter, text } = splitOption(option);
              const selected = value === option.charAt(0);
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(option.charAt(0))}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] leading-snug transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50",
                    selected
                      ? "bg-ink text-white"
                      : "bg-sheet text-ink ring-1 ring-input ring-inset hover:bg-panel-strong"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium",
                      selected ? "bg-white text-ink" : "bg-panel-strong text-ink"
                    )}
                  >
                    {letter}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === "fill-gap" && (
          <Input
            aria-labelledby={labelId}
            placeholder="Your answer"
            value={value}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 bg-sheet text-[16px]"
          />
        )}
      </div>
    </fieldset>
  );
}

/** The bottom bar of the CBT: every question number, filled once answered. */
export function QuestionNavigator({
  questions,
  answers,
  onJump,
}: {
  questions: ExamQuestion[];
  answers: Record<number, string>;
  onJump?: (id: number) => void;
}) {
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;

  const jump = (id: number) => {
    onJump?.(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`q-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
    });
  };

  return (
    <nav aria-label="Questions" className="flex items-center gap-4 overflow-x-auto px-4 py-2.5 sm:px-5">
      <p className="shrink-0 text-[14px] text-soft">
        <span className="tabular text-ink">{answeredCount}</span> of <span className="tabular">{questions.length}</span>{" "}
        answered
      </p>
      <ol className="flex items-center gap-1.5">
        {questions.map((q) => {
          const answered = (answers[q.id] ?? "").trim() !== "";
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => jump(q.id)}
                aria-label={`Question ${q.id}, ${answered ? "answered" : "not answered"}`}
                className={cn(
                  "tabular inline-flex size-11 items-center justify-center rounded-full text-[15px] font-medium transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:size-10",
                  answered ? "bg-ink text-white hover:bg-ink-hover" : "text-ink ring-1 ring-input ring-inset hover:bg-panel-strong"
                )}
              >
                {q.id}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const groupInstruction: Record<ExamQuestion["type"], string> = {
  "true-false-not-given":
    "Do the following statements agree with the information given? Choose True if the statement agrees, False if it contradicts, Not given if there is no information on this.",
  "multiple-choice": "Choose the correct letter.",
  "fill-gap": "Complete the sentence. Write no more than two words and/or a number.",
};

/** Questions in runs of the same type, each run headed by its exam instruction ("Questions 1–3"). */
export function QuestionGroups({
  questions,
  answers,
  onAnswer,
  disabled,
  textClass,
}: {
  questions: ExamQuestion[];
  answers: Record<number, string>;
  onAnswer: (id: number, value: string) => void;
  disabled?: boolean;
  textClass?: string;
}) {
  const groups: ExamQuestion[][] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last[0].type === q.type) last.push(q);
    else groups.push([q]);
  }
  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => {
        const first = group[0].id;
        const last = group[group.length - 1].id;
        return (
          <section key={first} aria-label={`Questions ${first} to ${last}`}>
            <h3 className="text-[15px] font-semibold text-ink">
              {first === last ? `Question ${first}` : `Questions ${first}–${last}`}
            </h3>
            <p className="mt-1 max-w-[60ch] text-[14px] leading-normal text-soft">{groupInstruction[group[0].type]}</p>
            <div className="mt-5 flex flex-col gap-7">
              {group.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? ""}
                  onChange={(value) => onAnswer(q.id, value)}
                  disabled={disabled}
                  textClass={textClass}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
