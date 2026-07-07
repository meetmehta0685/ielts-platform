import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";

export class DashboardController {
  /**
   * Fetch user metrics for writing, speaking, reading, and listening attempts.
   */
  static async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;

      // 1. Fetch Writing average band score
      const { data: writingData } = await supabase
        .from("writing_submissions")
        .select("band_score, created_at")
        .eq("user_id", user_id);

      // 2. Fetch Speaking average band score
      const { data: speakingData } = await supabase
        .from("speaking_submissions")
        .select("band_score, created_at")
        .eq("user_id", user_id);

      // 3. Fetch Reading attempts
      const { data: readingData } = await supabase
        .from("reading_attempts")
        .select("band_score, created_at")
        .eq("user_id", user_id);

      // 4. Fetch Listening attempts
      const { data: listeningData } = await supabase
        .from("listening_attempts")
        .select("band_score, created_at")
        .eq("user_id", user_id);

      // Compute averages
      const getAverage = (arr: any[]) => {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((acc, curr) => acc + Number(curr.band_score), 0);
        return parseFloat((sum / arr.length).toFixed(1));
      };

      const averages = {
        writing: getAverage(writingData || []),
        speaking: getAverage(speakingData || []),
        reading: getAverage(readingData || []),
        listening: getAverage(listeningData || []),
      };

      // Construct chronological chart history (recent 6 events)
      const historyEvents: any[] = [];

      if (writingData) {
        writingData.forEach((w) => {
          historyEvents.push({ module: "Writing", score: Number(w.band_score), date: new Date(w.created_at) });
        });
      }
      if (speakingData) {
        speakingData.forEach((s) => {
          historyEvents.push({ module: "Speaking", score: Number(s.band_score), date: new Date(s.created_at) });
        });
      }
      if (readingData) {
        readingData.forEach((r) => {
          historyEvents.push({ module: "Reading", score: Number(r.band_score), date: new Date(r.created_at) });
        });
      }
      if (listeningData) {
        listeningData.forEach((l) => {
          historyEvents.push({ module: "Listening", score: Number(l.band_score), date: new Date(l.created_at) });
        });
      }

      // Sort history chronologically
      historyEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      const recentHistory = historyEvents.slice(-6).map((item, idx) => ({
        index: idx + 1,
        event: `${item.module} (#${idx + 1})`,
        score: item.score,
      }));

      res.status(200).json({
        averages,
        history: recentHistory,
      });
    } catch (error: any) {
      console.error("[Dashboard Stats Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch dashboard stats" });
    }
  }
}
