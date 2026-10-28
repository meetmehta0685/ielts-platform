"use client";

import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control with a sliding pill (transitions recipe 16). The active option's offsetLeft and
 * offsetWidth are written onto the pill; CSS owns the tween. First paint and resizes snap without
 * animating. The pill transition is dropped under prefers-reduced-motion. Arrow keys move the choice.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  size = "default",
  className,
}: {
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);

  const place = useCallback(
    (animate: boolean) => {
      const bar = barRef.current;
      const pill = pillRef.current;
      if (!bar || !pill) return;
      const tab = bar.querySelector<HTMLButtonElement>(`[data-value="${value}"]`);
      if (!tab) return;
      if (!animate) pill.style.transition = "none";
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      if (!animate) {
        void pill.offsetWidth;
        pill.style.transition = "";
      }
    },
    [value]
  );

  useLayoutEffect(() => {
    place(mounted.current);
    mounted.current = true;
  }, [place]);

  useLayoutEffect(() => {
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => place(false));
    return () => window.removeEventListener("resize", onResize);
  }, [place]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    barRef.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };

  const height = size === "sm" ? "h-8 text-sm" : "h-10 text-[15px]";

  return (
    <div
      ref={barRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex items-center gap-[3px] rounded-full bg-panel-strong p-[3px]",
        disabled && "opacity-60",
        className
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-[3px] left-0 w-0 rounded-full bg-sheet shadow-[0_0_0_1px_var(--border)] transition-[transform,width] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none",
          size === "sm" ? "h-8" : "h-10"
        )}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            tabIndex={active ? 0 : -1}
            data-value={option.value}
            disabled={disabled}
            onClick={() => !active && onChange(option.value)}
            className={cn(
              "relative z-[1] rounded-full px-4 whitespace-nowrap outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed",
              height,
              active ? "font-medium text-ink" : "text-soft hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
