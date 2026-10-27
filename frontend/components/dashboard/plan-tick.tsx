import { cn } from "@/lib/utils";

/** A read-only tick for a study-plan task: filled teal with a check when done, an empty box when not. */
export function PlanTick({ done }: { done: boolean }) {
  return (
    <span
      role="img"
      aria-label={done ? "Done" : "Not done"}
      className={cn(
        "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px]",
        done ? "bg-teal" : "border-[1.5px] border-[#c9c4bb] bg-sheet"
      )}
    >
      {done && (
        <svg viewBox="0 0 10.17 10.17" className="size-2.5" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 5.52L3.92 9.17L9.17 1" />
        </svg>
      )}
    </span>
  );
}
