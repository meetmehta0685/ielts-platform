"use client";

import { useCallback } from "react";

/**
 * Replays the error-state shake (recipe 12) on the given `.t-input` elements. Removing the class
 * and forcing a reflow first lets a second failed submit shake again.
 */
export function useShake() {
  return useCallback((targets: (HTMLElement | null | undefined)[]) => {
    for (const el of targets) {
      if (!el) continue;
      el.classList.remove("is-shaking");
      void el.offsetWidth;
      el.classList.add("is-shaking");
      window.setTimeout(() => el.classList.remove("is-shaking"), 300);
    }
  }, []);
}

/** The `.t-input` wrappers of the named fields inside a form (`data-field="email"`). */
export function fieldEls(form: HTMLFormElement | undefined, names: string[]) {
  if (!form) return [];
  return names.map((n) => form.querySelector<HTMLElement>(`[data-field="${n}"]`));
}
