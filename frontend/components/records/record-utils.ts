import type { TrackRecordEntry } from "@/lib/track-record";

/** The band as a number, or null when the attempt was never graded ("Not graded"). */
export function bandOf(record: Pick<TrackRecordEntry, "score">): number | null {
  if (!record.score.startsWith("Band ")) return null;
  const v = parseFloat(record.score.replace("Band ", ""));
  return Number.isNaN(v) ? null : v;
}

/** "6.5", or an em dash when there is no band. */
export function formatBand(record: Pick<TrackRecordEntry, "score">) {
  const b = bandOf(record);
  return b == null ? "—" : b.toFixed(1);
}

export function attemptHref(record: Pick<TrackRecordEntry, "module" | "id">) {
  return record.module === "Writing"
    ? `/writing?attempt_id=${record.id}`
    : record.module === "Speaking"
      ? `/speaking?attempt_id=${record.id}`
      : record.module === "Reading"
        ? `/reading?attempt_id=${record.id}`
        : `/listening?attempt_id=${record.id}`;
}
