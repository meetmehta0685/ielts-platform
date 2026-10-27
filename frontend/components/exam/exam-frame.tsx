"use client";

import "./exam.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ProductMark } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

/** 59:07 style clock; hours roll into minutes like the real CBT timer. */
export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** The candidate's display name: their full name when the profile has one, else the email handle. */
export function candidateNameFrom(user: { email?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return "Candidate";
  const full = user.user_metadata?.full_name;
  if (typeof full === "string" && full.trim()) return full.trim();
  return user.email?.split("@")[0] || "Candidate";
}

export type TextScale = "sm" | "base" | "lg";

/** "Passage 1: Rise of the Skyscraper" -> "Rise of the Skyscraper" (the number is shown separately). */
export const stripPassagePrefix = (title: string) => title.replace(/^passage\s*\d+\s*[:.\-–]\s*/i, "");

export const passageSize: Record<TextScale, string> = {
  sm: "text-[15px]",
  base: "text-[17px]",
  lg: "text-[19px]",
};

/* ------------------------------------------------------------------------------------------------
 * Confirm dialog (transitions recipe 06).
 * --------------------------------------------------------------------------------------------- */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep going",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "accent";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="x-scrim fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,10,10,0.32)] p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="x-confirm-title"
        className="x-modal w-full max-w-[420px] rounded-2xl bg-sheet p-6 shadow-[0_12px_40px_rgba(10,10,10,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="x-confirm-title" className="text-[17px] font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-[15px] leading-normal text-soft">{body}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "accent" ? "accent" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Success check (transitions recipe 10).
 * --------------------------------------------------------------------------------------------- */
export function SuccessCheck({ className }: { className?: string }) {
  const [state, setState] = useState<"out" | "in">("out");
  useEffect(() => {
    const id = requestAnimationFrame(() => setState("in"));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span className={cn("x-check text-good", className)} data-state={state} aria-hidden>
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
        <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.14" />
        <path d="M6 10.4l2.6 2.6L14 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Band digits (transitions recipe 02): the band figure pops in, the decimal and tenth staggered.
 * --------------------------------------------------------------------------------------------- */
export function BandDigits({ value, className }: { value: string; className?: string }) {
  const chars = value.split("");
  return (
    <span className={cn("x-digits", className)} aria-label={value}>
      {chars.map((ch, i) => (
        <span
          key={`${value}-${i}`}
          aria-hidden
          className="x-digit"
          style={{ "--d": Math.max(0, i - (chars.length - 3)) } as CSSProperties}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The exam frame: a plain chrome top bar over a white sheet, like the computer-delivered test.
 * --------------------------------------------------------------------------------------------- */
export function ExamFrame({
  module,
  context,
  candidateName,
  timeLeft,
  timerHidden,
  onToggleTimer,
  textScale,
  onTextScale,
  submitLabel = "Submit",
  submittingLabel = "Marking…",
  submitting = false,
  submitDisabled = false,
  onSubmit,
  submitConfirm,
  exitBody = "Your answers on this paper will not be saved or marked.",
  footer,
  children,
}: {
  module: string;
  /** A short line under the module name, e.g. "Full mock · paper 2 of 4". */
  context?: ReactNode;
  candidateName: string;
  timeLeft: number;
  timerHidden?: boolean;
  onToggleTimer?: () => void;
  textScale?: TextScale;
  onTextScale?: (scale: TextScale) => void;
  submitLabel?: string;
  submittingLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  /** When set, Submit asks first with this message (e.g. unanswered questions). */
  submitConfirm?: string | null;
  exitBody?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const lastFive = timeLeft <= 300;

  const requestSubmit = () => {
    if (submitConfirm) setConfirmSubmit(true);
    else onSubmit();
  };

  const closeExit = useCallback(() => setConfirmExit(false), []);
  const closeSubmit = useCallback(() => setConfirmSubmit(false), []);

  return (
    <div className="flex h-dvh flex-col bg-chrome">
      <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <ProductMark className="hidden sm:inline-flex" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-medium text-ink">{module}</p>
            {context && <p className="hidden truncate text-[13px] text-soft sm:block">{context}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1" role="timer" aria-live="off" aria-label="Time remaining">
          <span
            className={cn(
              "tabular text-[26px] font-medium leading-none tracking-tight transition-colors duration-[var(--duration-fast)] sm:text-[30px]",
              lastFive ? "text-bad" : "text-ink"
            )}
          >
            {timerHidden ? "–:––" : formatClock(timeLeft)}
          </span>
          {onToggleTimer && (
            <button
              type="button"
              onClick={onToggleTimer}
              className="ml-1 hidden h-8 rounded-full px-2.5 text-[13px] text-soft transition-colors duration-[var(--duration-quick)] hover:bg-[#e2dfd8] hover:text-ink md:inline-flex md:items-center"
            >
              {timerHidden ? "Show time" : "Hide time"}
            </button>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {textScale && onTextScale && (
            <div className="hidden xl:block">
            <SegmentedControl
              size="sm"
              label="Text size"
              value={textScale}
              onChange={onTextScale}
              options={[
                { value: "sm", label: <span className="text-[13px]">A</span>, ariaLabel: "Smaller text" },
                { value: "base", label: <span className="text-[15px]">A</span>, ariaLabel: "Standard text" },
                { value: "lg", label: <span className="text-[18px]">A</span>, ariaLabel: "Larger text" },
              ]}
            />
            </div>
          )}
          <span className="hidden max-w-[180px] truncate text-[14px] text-soft lg:inline">{candidateName}</span>
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            className="inline-flex h-10 items-center rounded-full px-3 text-[14px] text-ink transition-colors duration-[var(--duration-quick)] hover:bg-[#e2dfd8]"
          >
            Exit
          </button>
          <Button variant="accent" onClick={requestSubmit} disabled={submitting || submitDisabled} className="min-w-[88px]">
            {submitting ? <span className="t-swap">{submittingLabel}</span> : submitLabel}
          </Button>
        </div>
      </header>

      <main className="mx-0 mb-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-sheet sm:mx-2 sm:mb-2 sm:rounded-2xl sm:border sm:border-[#e4e0d8]">
        <div className="min-h-0 flex-1">{children}</div>
        {footer && <div className="shrink-0 border-t border-[#ebe8e2]">{footer}</div>}
      </main>

      <ConfirmDialog
        open={confirmExit}
        title="Leave this test?"
        body={exitBody}
        confirmLabel="Leave test"
        onCancel={closeExit}
        onConfirm={() => {
          setConfirmExit(false);
          router.push("/dashboard");
        }}
      />
      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your answers?"
        body={submitConfirm}
        confirmLabel="Submit now"
        tone="accent"
        onCancel={closeSubmit}
        onConfirm={() => {
          setConfirmSubmit(false);
          onSubmit();
        }}
      />
    </div>
  );
}

/** Lightweight Exit link for non-frame contexts. */
export function ExitLink() {
  return (
    <Link href="/dashboard" className="text-[14px] text-soft underline-offset-4 hover:text-ink hover:underline">
      Back to home
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Split pane: two independently scrolling columns on desktop; one at a time behind tabs on phones.
 * --------------------------------------------------------------------------------------------- */
export function SplitPane({
  left,
  right,
  leftLabel,
  rightLabel,
  rightBadge,
  rightWidth = "lg:w-[46%]",
  pane: controlledPane,
  onPaneChange,
}: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  rightBadge?: ReactNode;
  rightWidth?: string;
  pane?: "left" | "right";
  onPaneChange?: (pane: "left" | "right") => void;
}) {
  const [ownPane, setOwnPane] = useState<"left" | "right">("left");
  const pane = controlledPane ?? ownPane;
  const setPane = (next: "left" | "right") => {
    setOwnPane(next);
    onPaneChange?.(next);
  };
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex shrink-0 justify-center border-b border-[#ebe8e2] px-4 py-2.5 lg:hidden">
        <SegmentedControl
          label="Show"
          value={pane}
          onChange={setPane}
          options={[
            { value: "left", label: leftLabel },
            {
              value: "right",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {rightLabel}
                  {rightBadge}
                </span>
              ),
            },
          ]}
        />
      </div>
      <section
        aria-label={leftLabel}
        className={cn("min-h-0 flex-1 overflow-y-auto lg:block", pane === "left" ? "block" : "hidden")}
      >
        {left}
      </section>
      <section
        aria-label={rightLabel}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-panel lg:block lg:flex-none lg:border-l lg:border-[#ebe8e2]",
          rightWidth,
          pane === "right" ? "block" : "hidden"
        )}
      >
        {right}
      </section>
    </div>
  );
}
