"use client";

import { AppShell, PageColumn } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

/** Loading: the intro's own shape in skeleton, inside the normal shell. */
export function ExamLoading({ shellTitle, label }: { shellTitle: string; label: string }) {
  return (
    <AppShell title={shellTitle}>
      <PageColumn title={<span className="t-pending">{label}</span>}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-hidden>
          <div className="t-skel h-[260px] rounded-2xl lg:col-span-8" />
          <div className="t-skel h-[260px] rounded-2xl lg:col-span-4" />
        </div>
      </PageColumn>
    </AppShell>
  );
}

/** Error: what failed, in plain words, and the one way forward. */
export function ExamError({
  shellTitle,
  title,
  detail,
  action,
}: {
  shellTitle: string;
  title: string;
  detail: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AppShell title={shellTitle}>
      <PageColumn
        title={title}
        lead={detail}
        actions={
          action ?? (
            <Button variant="accent" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )
        }
      >
        <div />
      </PageColumn>
    </AppShell>
  );
}

/** Intro panel row: a label and its value, right-aligned figures. */
export function FactRow({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div>
        <p className="text-[15px] text-ink">{label}</p>
        {note && <p className="mt-0.5 text-[14px] text-soft">{note}</p>}
      </div>
      <p className="tabular text-right text-[15px] text-ink">{value}</p>
    </div>
  );
}
