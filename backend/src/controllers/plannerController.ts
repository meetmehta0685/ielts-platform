import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { ChatMessage, completeJson } from "../services/ai";

export class PlannerController {
  /**
   * Generate a personalized IELTS study roadmap based on the user's onboarding profiles data.
   */
  static async generatePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;

      // 1. Fetch user onboarding profile
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user_id)
        .single();

      if (profileErr || !profile) {
        res.status(404).json({ error: "User onboarding profile not found. Please complete profile first." });
        return;
      }

      // Fetch averages for each module to adapt plan based on actual scores
      const [writingRes, speakingRes, readingRes, listeningRes] = await Promise.all([
        supabase.from("writing_submissions").select("band_score").eq("user_id", user_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("speaking_submissions").select("band_score").eq("user_id", user_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("reading_attempts").select("band_score").eq("user_id", user_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("listening_attempts").select("band_score").eq("user_id", user_id).order("created_at", { ascending: false }).limit(5),
      ]);

      const getAverage = (resObj: any) => {
        const data = resObj?.data;
        if (!data || data.length === 0) return null;
        const valid = data.filter((item: any) => item.band_score !== null && item.band_score !== undefined);
        if (valid.length === 0) return null;
        const sum = valid.reduce((acc: number, curr: any) => acc + Number(curr.band_score), 0);
        return parseFloat((sum / valid.length).toFixed(1));
      };

      const writingAvg = getAverage(writingRes);
      const speakingAvg = getAverage(speakingRes);
      const readingAvg = getAverage(readingRes);
      const listeningAvg = getAverage(listeningRes);

      const moduleAverages = [
        { name: "Writing", score: writingAvg },
        { name: "Speaking", score: speakingAvg },
        { name: "Reading", score: readingAvg },
        { name: "Listening", score: listeningAvg },
      ];

      // 2. Construct prompt
      const systemPrompt = `You are an expert IELTS prep curriculum director.
Your goal is to generate a personalized, structured study plan for a candidate based on their target metrics, actual module averages, weak areas, study commitment, and exam date.
Generate the response strictly as a JSON object matching this schema:
{
  "weekly_plans": [
    {
      "week": number,
      "focus": "Overall core focus for this week",
      "tasks": [
        "specific daily task 1",
        "specific daily task 2",
        "specific daily task 3"
      ]
    }
  ],
  "mock_schedule": [
    {
      "date": "estimated date for mock (YYYY-MM-DD or 'Week X')",
      "test_type": "Full Exam Simulator / Specific section drill",
      "objective": "Target focus metric"
    }
  ],
  "mentor_advice": "A summary advice paragraph from the AI mentor on how to tackle their weak modules."
}

Do not write any markdown code blocks, preamble, or conversational notes. Respond in pure, valid JSON.`;

      const userContent = `IELTS STUDY PROFILE:
- Current Date (Today): ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
- Target Band: ${profile.target_band}
- Onboarding Declared Weak Modules: ${profile.weak_areas?.join(", ") || "None"}
- Daily Study Commitment: ${profile.study_hours_per_day} hours/day
- Exam Date: ${profile.exam_date || "Not set"}

ACTUAL PERFORMANCE MODULE SCORES (AVERAGE OF RECENT ATTEMPTS):
${moduleAverages.map(m => `- ${m.name}: ${m.score !== null ? `Band ${m.score.toFixed(1)}` : "No attempts recorded yet"}`).join("\n")}

DIAGNOSTIC ADAPTATION INSTRUCTIONS:
- Restructure and prioritize focus weeks and tasks for modules where actual scores are lowest or below target.
- If a candidate has a high average (e.g. Band 8.0) in a module, allocate very minimal tasks for it, focusing major scheduling on their weakest sections.
- Make sure to recommend taking Mock Simulator exams periodically on the platform.`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      let resultJSON: any;
      try {
        resultJSON = await completeJson(messages);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        res.status(502).json({ error: "AI returned an invalid study plan. Please try again." });
        return;
      }

      const { error: dbErr } = await supabase
        .from("study_plans")
        .upsert({ user_id, plan_json: resultJSON }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;

      res.status(200).json(resultJSON);
    } catch (error: any) {
      console.error("[Planner Generation Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate study plan" });
    }
  }

  /**
   * Get user's active study plan.
   */
  static async getPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;
      const { data, error } = await supabase
        .from("study_plans")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        res.status(200).json(null);
        return;
      }

      res.status(200).json(data.plan_json);
    } catch (error: any) {
      console.error("[Get Plan Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch study plan" });
    }
  }

  /**
   * Update the user's active study plan (used for tracking progress/checkmarks).
   */
  static async updatePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;
      const { plan_json } = req.body;

      if (!plan_json) {
        res.status(400).json({ error: "plan_json is required" });
        return;
      }

      const { data, error } = await supabase
        .from("study_plans")
        .update({ plan_json })
        .eq("user_id", user_id)
        .select("id");

      if (error) throw error;
      if (!data?.length) {
        res.status(404).json({ error: "No active study plan found to update." });
        return;
      }

      res.status(200).json({ success: true, message: "Study plan updated successfully." });
    } catch (error: any) {
      console.error("[Update Plan Error]:", error);
      res.status(500).json({ error: error.message || "Failed to update study plan" });
    }
  }
}
