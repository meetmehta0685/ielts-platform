"use client";

import type { CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "./exam-frame";

/** The recording: one play/pause control, a scrubber, elapsed and total time. States are the audio's own. */
export function AudioPlayer({
  title,
  detail,
  isPlaying,
  progress,
  duration,
  status,
  onToggle,
  onSeek,
  disabled,
}: {
  title: string;
  detail?: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  status: "loading" | "ready" | "error";
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}) {
  const played = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const ended = duration > 0 && progress >= duration - 0.25 && !isPlaying;
  const stateLine =
    status === "error"
      ? "The recording could not be loaded. Check your connection and reload the page."
      : status === "loading"
        ? "Loading the recording…"
        : isPlaying
          ? "Playing"
          : ended
            ? "Recording finished"
            : progress > 0
              ? "Paused"
              : "Ready. Press play when you are ready to listen.";

  return (
    <section aria-label="Recording" className="rounded-2xl bg-panel p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || status === "error"}
          aria-label={isPlaying ? "Pause recording" : "Play recording"}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-[background-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-[#2a2926] active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40"
        >
          {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px] font-medium text-ink">{title}</p>
            <p className="tabular shrink-0 text-[14px] text-soft">
              {formatClock(progress)} <span aria-hidden>/</span> {duration > 0 ? formatClock(duration) : "—"}
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={progress}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={disabled || status !== "ready"}
            aria-label="Recording position"
            className="x-range mt-1"
            style={{ "--played": `${played}%` } as CSSProperties}
          />
          <p
            key={stateLine}
            className={cn("t-swap text-[14px]", status === "error" ? "text-bad" : "text-soft")}
            aria-live="polite"
          >
            {detail && status === "ready" && !isPlaying && progress === 0 ? detail : stateLine}
          </p>
        </div>
      </div>
    </section>
  );
}
