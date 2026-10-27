"use client";

import { cn } from "@/lib/utils";
import "./planner.css";

/**
 * One checkable plan task. The whole row is the hit target (44px minimum); the 20px box fills
 * teal and the tick draws in when it is checked.
 */
export function TaskCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="group/task -mx-2 flex min-h-11 w-[calc(100%+16px)] items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors duration-[var(--duration-quick)] hover:bg-panel-strong focus-visible:outline-2 focus-visible:outline-teal"
    >
      <span
        aria-hidden
        data-checked={checked}
        className={cn(
          "t-check mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px]",
          checked ? "border-teal bg-teal" : "border-[#c4bfb6] bg-sheet group-hover/task:border-[#9e988e]"
        )}
      >
        <svg viewBox="0 0 10.17 10.17" className="size-[11px]" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 5.52L3.92 9.17L9.17 1" />
        </svg>
      </span>
      <span className={cn("text-[15px] leading-snug transition-colors duration-[var(--duration-quick)]", checked ? "text-soft" : "text-ink")}>
        {label}
      </span>
    </button>
  );
}
