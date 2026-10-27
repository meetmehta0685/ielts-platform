"use client";

import { useEffect, useRef } from "react";

/** A silent loop that plays only while on screen, and never under reduced motion (the poster stays). */
export function LoopVideo({
  src,
  poster,
  width,
  height,
  label,
}: {
  src: string;
  poster: string;
  width: number;
  height: number;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !reduce.matches) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.1 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className="lp-photo"
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      width={width}
      height={height}
      aria-label={label}
    >
      <source src={src} type="video/webm" />
    </video>
  );
}
