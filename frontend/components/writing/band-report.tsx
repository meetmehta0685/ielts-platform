import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A band prints with one decimal; a missing or non-numeric band prints as an em dash. */
export function formatBand(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";
}

/** The overall band: the largest figure on a result screen, set in the display face. */
export function OverallBand({ band, caption }: { band: number; caption: ReactNode }) {
  return (
    <section className="flex h-full flex-col justify-between gap-6 rounded-2xl bg-panel p-5">
      <h2 className="text-[15px] font-semibold text-ink">Overall band</h2>
      <p className="t-pop font-display tabular text-[112px] leading-[0.8] text-ink sm:text-[128px]">
        {formatBand(band)}
      </p>
      <p className="text-sm leading-normal text-soft">{caption}</p>
    </section>
  );
}

/** The four marking criteria as a ruled table: name, a bar out of 9, the band right-aligned. */
export function CriteriaTable({
  rows,
  title = "Band by criterion",
  aside,
}: {
  rows: { label: string; band: number }[];
  title?: string;
  aside?: ReactNode;
}) {
  return (
    <section className="h-full rounded-2xl bg-panel p-5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {aside && <p className="text-sm text-soft">{aside}</p>}
      </div>
      <table className="w-full border-collapse text-left">
        <thead className="sr-only">
          <tr>
            <th scope="col">Criterion</th>
            <th scope="col">Out of 9</th>
            <th scope="col">Band</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const valid = Number.isFinite(row.band);
            const pct = valid ? Math.max(0, Math.min(1, row.band / 9)) * 100 : 0;
            return (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-4 pr-4 align-middle text-[15px] font-normal text-ink sm:w-[46%]">
                  {row.label}
                </th>
                <td className="hidden py-4 pr-6 align-middle sm:table-cell">
                  <div className="relative h-1.5 rounded-full bg-putty" aria-hidden>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${pct}%` }} />
                  </div>
                </td>
                <td className={cn("tabular py-4 text-right align-middle text-[28px] leading-none text-ink", !valid && "text-soft")}>
                  {formatBand(row.band)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** A plain numbered-free list of next steps, each one a line of advice. */
export function NextSteps({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-[15px] leading-relaxed text-soft">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => (
        <li key={i} className="border-b border-border py-3 text-[15px] leading-relaxed text-ink first:pt-0 last:border-b-0 last:pb-0">
          {item}
        </li>
      ))}
    </ul>
  );
}
