"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Staggered entrance for a block's parts. Children marked with `t-stagger-line` (and an optional
 * `--i` index in their style) rise in once the block scrolls into view. Content stays visible
 * if this never runs: the hidden state only applies after mount.
 */
export function Reveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("t-stagger");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-shown");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
