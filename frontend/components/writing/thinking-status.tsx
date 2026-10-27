"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * An AI status line that narrates the work (transitions recipe 28, adapted): the current state
 * shimmers while it holds, and each new state rises in through a small blur. Pass one state to
 * hold it; pass several to cycle every `holdMs`. Both animations respect prefers-reduced-motion
 * through the shared `t-swap` and `t-shimmer` utilities.
 */
export function ThinkingStatus({
  states,
  holdMs = 2200,
  className,
}: {
  states: string[];
  holdMs?: number;
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  const cycles = states.length > 1;

  useEffect(() => {
    if (!cycles) return;
    const timer = setInterval(() => setTick((t) => t + 1), holdMs);
    return () => clearInterval(timer);
  }, [cycles, holdMs]);

  const text = states[cycles ? tick % states.length : 0] ?? "";

  return (
    <span role="status" aria-live="polite" className={cn("inline-block", className)}>
      <span key={text} className="t-swap inline-block">
        <span className="t-shimmer">{text}</span>
      </span>
    </span>
  );
}

/**
 * Picks the stage the marker has reached from the JSON it is streaming: the latest field name to
 * appear wins. Before any token arrives, `fallback` states cycle.
 */
export function stageFromStream(stream: string, stages: [field: string, label: string][], fallback: string[]) {
  if (!stream) return fallback;
  let best: { at: number; label: string } | null = null;
  for (const [field, label] of stages) {
    const at = stream.lastIndexOf(`"${field}"`);
    if (at !== -1 && (!best || at > best.at)) best = { at, label };
  }
  return [best ? best.label : fallback[0]];
}
