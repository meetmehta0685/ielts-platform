"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A status line that narrates the marking: the current state breathes while it holds, and each
 * new state settles in from below. Pass one state to hold it; pass several to cycle every
 * `holdMs`. Both animations respect prefers-reduced-motion through `t-swap` and `t-pending`.
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
        <span className="t-pending">{text}</span>
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
