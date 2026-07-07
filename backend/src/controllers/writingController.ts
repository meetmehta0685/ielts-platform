import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { OpenRouterService, ChatMessage } from "../services/openrouter";
import { z } from "zod";

const evaluateSchema = z.object({
  task_type: z.enum(["task1", "task2"]),
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  essay: z.string().min(50, "Essay must be at least 50 characters"),
});

export class WritingController {
  static async evaluateEssay(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validate request body
      const parsed = evaluateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.format() });
        return;
      }

      const { task_type, prompt, essay } = parsed.data;
      const user_id = req.user.id;

      // 2. Fetch the user's target band score to personalize the evaluation context
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_band")
        .eq("id", user_id)
        .single();

      const targetBand = profile?.target_band || 7.0;

      // 3. Construct the prompt for OpenRouter
      const systemPrompt = `You are a certified IELTS Writing Examiner with decades of experience grading IELTS academic essays.
Evaluate the candidate's essay strictly against the official IELTS criteria:
- Task Achievement / Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

The candidate's target band score is ${targetBand}. Provide detailed, constructive feedback that helps them reach this score.

You MUST return a JSON object ONLY. Your response must match the following schema:
{
  "band_score": number, // Overall band score (0.0 to 9.0 in steps of 0.5)
  "task_response": number, // score for task response/achievement (0.0 to 9.0 in steps of 0.5)
  "coherence_cohesion": number, // score for coherence & cohesion (0.0 to 9.0 in steps of 0.5)
  "lexical_resource": number, // score for lexical resource (0.0 to 9.0 in steps of 0.5)
  "grammar_accuracy": number, // score for grammar range & accuracy (0.0 to 9.0 in steps of 0.5)
  "corrections": [
    {
      "original": "exact sentence or phrase containing the error",
      "correction": "the corrected sentence or phrase",
      "explanation": "brief explanation of why this was corrected (grammar rule, styling etc.)"
    }
  ],
  "vocabulary_suggestions": [
    {
      "original": "the basic or repetitive word used in essay",
      "suggestion": "higher-level collocations or academic vocabulary alternative",
      "explanation": "why this improves lexical resource and precision"
    }
  ],
  "improved_essay": "Write a fully improved, high-scoring version of the essay (Band 8.5+) retaining the candidate's main points but elevating style, grammar, coherence, and vocabulary.",
  "improvements": [
    "bullet point 1 outlining key action item",
    "bullet point 2 outlining key action item"
  ]
}

Ensure all scores are floating point numbers (e.g. 6.5, 7.0, 7.5). Make sure there are no other characters, text, markdown blocks (like \`\`\`json), or preamble. Just valid, raw JSON.`;

      const userContent = `IELTS TASK: ${task_type === "task1" ? "Task 1 (Graph Description / Letter)" : "Task 2 (Essay)"}
PROMPT: "${prompt}"
STUDENT'S ESSAY:
"${essay}"`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      // Set headers for Server-Sent Events (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders(); // Establish connection

      let assistantResponse = "";

      await OpenRouterService.streamCompletion(
        messages,
        (token) => {
          assistantResponse += token;
          // Send SSE formatted data token
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        async () => {
          try {
            // Parse the full accumulated JSON response
            let cleanText = assistantResponse.trim();
            if (cleanText.startsWith("```json")) {
              cleanText = cleanText.substring(7);
            }
            if (cleanText.endsWith("```")) {
              cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            const resultJSON = JSON.parse(cleanText.trim());

            // Store evaluation results in public.writing_submissions
            const { data: dbRecord, error: dbErr } = await supabase
              .from("writing_submissions")
              .insert({
                user_id,
                task_type,
                prompt,
                essay,
                band_score: resultJSON.band_score,
                task_response: resultJSON.task_response,
                coherence_cohesion: resultJSON.coherence_cohesion,
                lexical_resource: resultJSON.lexical_resource,
                grammatical_range_accuracy: resultJSON.grammar_accuracy,
                feedback_json: {
                  corrections: resultJSON.corrections || [],
                  vocabulary_suggestions: resultJSON.vocabulary_suggestions || [],
                  improved_essay: resultJSON.improved_essay || "",
                  improvements: resultJSON.improvements || [],
                },
              })
              .select()
              .single();

            if (dbErr) {
              console.error("[DB Store Error for Writing Submission]:", dbErr);
            }

            // Send SSE done signal containing the dbRecord id and parsed JSON
            res.write(`data: ${JSON.stringify({ done: true, id: dbRecord?.id, result: resultJSON })}\n\n`);
          } catch (parseErr) {
            console.error("[Writing Evaluation Parse/Store Error] Raw text:", assistantResponse, parseErr);
            res.write(`data: ${JSON.stringify({ error: "AI returned an invalid JSON response structure." })}\n\n`);
          } finally {
            res.write("data: [DONE]\n\n");
            res.end();
          }
        },
        (error) => {
          console.error("[Writing Streaming Error]:", error);
          res.write(`data: ${JSON.stringify({ error: error.message || "Failed to stream message" })}\n\n`);
          res.end();
        },
        "openai/gpt-oss-20b:free"
      );
    } catch (error: any) {
      console.error("[Writing Evaluation Router Error]:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  /**
   * Get user's past writing submissions.
   */
  static async getSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;
      const { data, error } = await supabase
        .from("writing_submissions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error("[Get Submissions Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch submissions" });
    }
  }
}
