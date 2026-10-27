import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";

const MODULE_TABLES = {
  writing: "writing_submissions",
  speaking: "speaking_submissions",
  reading: "reading_attempts",
  listening: "listening_attempts",
} as const;

type Module = keyof typeof MODULE_TABLES;

export class DashboardController {
  /**
   * Average band per module plus the six most recent scored attempts across all modules.
   */
  static async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;
      const modules = Object.keys(MODULE_TABLES) as Module[];

      const results = await Promise.all(
        modules.map(async (module) => {
          const { data, error } = await supabase
            .from(MODULE_TABLES[module])
            .select("band_score, created_at")
            .eq("user_id", user_id)
            .not("band_score", "is", null);
          if (error) throw error;
          return data.map((row) => ({
            module,
            score: Number(row.band_score),
            date: new Date(row.created_at).getTime(),
          }));
        })
      );

      const averages = Object.fromEntries(
        modules.map((module, i) => {
          const scores = results[i].map((r) => r.score);
          const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          return [module, parseFloat(avg.toFixed(1))];
        })
      );

      const history = results
        .flat()
        .sort((a, b) => a.date - b.date)
        .slice(-6)
        .map((item, idx) => ({
          index: idx + 1,
          event: `${item.module[0].toUpperCase()}${item.module.slice(1)} (#${idx + 1})`,
          score: item.score,
        }));

      res.status(200).json({ averages, history });
    } catch (error: any) {
      console.error("[Dashboard Stats Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch dashboard stats" });
    }
  }
}
