import type { SupabaseClient } from "@supabase/supabase-js";

export interface TrackRecordEntry {
  id: string;
  module: "Writing" | "Speaking" | "Reading" | "Listening";
  title: string;
  score: string;
  rawScore: string | null;
  date: string;
}

const formatBand = (band: number | null) =>
  band != null ? `Band ${Number(band).toFixed(1)}` : "Not graded";

/** All of a user's attempts across the four modules, newest first. */
export async function loadTrackRecord(
  supabase: SupabaseClient,
  userId: string
): Promise<TrackRecordEntry[]> {
  const [writing, speaking, reading, listening] = await Promise.all([
    supabase.from("writing_submissions").select("id, task_type, band_score, created_at").eq("user_id", userId),
    supabase.from("speaking_submissions").select("id, part, band_score, created_at").eq("user_id", userId),
    supabase.from("reading_attempts").select("id, test_title, score, total_questions, band_score, created_at").eq("user_id", userId),
    supabase.from("listening_attempts").select("id, test_title, score, total_questions, band_score, created_at").eq("user_id", userId),
  ]);

  const entries: TrackRecordEntry[] = [
    ...(writing.data || []).map((w) => ({
      id: w.id,
      module: "Writing" as const,
      title: w.task_type === "task1" ? "Task 1: Academic Report" : "Task 2: Essay writing",
      score: formatBand(w.band_score),
      rawScore: null,
      date: w.created_at,
    })),
    ...(speaking.data || []).map((s) => ({
      id: s.id,
      module: "Speaking" as const,
      title: `Part ${s.part} Audio Interview`,
      score: formatBand(s.band_score),
      rawScore: null,
      date: s.created_at,
    })),
    ...(reading.data || []).map((r) => ({
      id: r.id,
      module: "Reading" as const,
      title: r.test_title,
      score: formatBand(r.band_score),
      rawScore: `${r.score}/${r.total_questions}`,
      date: r.created_at,
    })),
    ...(listening.data || []).map((l) => ({
      id: l.id,
      module: "Listening" as const,
      title: l.test_title,
      score: formatBand(l.band_score),
      rawScore: `${l.score}/${l.total_questions}`,
      date: l.created_at,
    })),
  ];

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
