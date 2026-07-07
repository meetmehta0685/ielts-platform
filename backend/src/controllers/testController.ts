import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { OpenRouterService, ChatMessage } from "../services/openrouter";
import fs from "fs";
import path from "path";
import { rawScoreToBand } from "../utils/bandScore";

// Load local JSON tests
const readingTestsPath = path.join(__dirname, "../data/readingTests.json");
const listeningTestsPath = path.join(__dirname, "../data/listeningTests.json");

const getReadingTestsData = () => JSON.parse(fs.readFileSync(readingTestsPath, "utf-8"));
const getListeningTestsData = () => JSON.parse(fs.readFileSync(listeningTestsPath, "utf-8"));

export class TestController {
  /**
   * Get list of all reading tests (excluding correct answers).
   */
  static getReadingTests(req: AuthenticatedRequest, res: Response) {
    try {
      const tests = getReadingTestsData();
      // Remove correct answers before sending to client
      const sanitized = tests.map((t: any) => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        passages: t.passages.map((p: any) => ({
          id: p.id,
          title: p.title,
          text: p.text,
          questions: p.questions.map((q: any) => {
            const { correctAnswer, ...rest } = q;
            return rest;
          }),
        })),
      }));
      res.status(200).json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch reading tests" });
    }
  }

  /**
   * Get list of all listening tests (excluding correct answers).
   */
  static getListeningTests(req: AuthenticatedRequest, res: Response) {
    try {
      const tests = getListeningTestsData();
      // Remove correct answers before sending
      const sanitized = tests.map((t: any) => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        sections: t.sections.map((s: any) => ({
          id: s.id,
          audioUrl: s.audioUrl,
          instructions: s.instructions,
          questions: s.questions.map((q: any) => {
            const { correctAnswer, ...rest } = q;
            return rest;
          }),
        })),
      }));
      res.status(200).json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch listening tests" });
    }
  }

  /**
   * Evaluate a reading test attempt.
   */
  static async submitReading(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { test_id, answers } = req.body; // answers: { [questionId: number]: string }
      if (!test_id || !answers) {
        res.status(400).json({ error: "test_id and answers are required" });
        return;
      }

      const tests = getReadingTestsData();
      const test = tests.find((t: any) => t.id === test_id);
      if (!test) {
        res.status(404).json({ error: "Reading test not found" });
        return;
      }

      // Gather all questions
      const allQuestions: any[] = [];
      test.passages.forEach((p: any) => {
        allQuestions.push(...p.questions);
      });

      let score = 0;
      const total_questions = allQuestions.length;
      const gradingReport: any = {};
      const incorrectQuestions: any[] = [];

      allQuestions.forEach((q: any) => {
        const studentAns = (answers[q.id] || "").trim().toLowerCase();
        const correctAns = q.correctAnswer.trim().toLowerCase();
        const isCorrect = studentAns === correctAns;

        if (isCorrect) score++;
        else {
          incorrectQuestions.push({
            id: q.id,
            questionText: q.questionText,
            studentAnswer: answers[q.id] || "No Answer",
            correctAnswer: q.correctAnswer,
            passageContext: test.passages[0].text, // Provide context
          });
        }

        gradingReport[q.id] = {
          correct: isCorrect,
          correctAnswer: q.correctAnswer,
          submittedAnswer: answers[q.id] || "",
        };
      });

      // Calculate estimated band score scaled to 40-question IELTS table
      const band_score = rawScoreToBand(score, total_questions);

      // Call OpenRouter in background/sync to generate AI explanations for incorrect answers
      let explanations: Record<string, string> = {};
      if (incorrectQuestions.length > 0) {
        try {
          const prompt = `You are an IELTS Reading coach. Analyze why the student made these errors and provide a brief (1-sentence) explanation for each incorrect question.
Here are the incorrect questions:
${incorrectQuestions.map(q => `Question ID ${q.id}: "${q.questionText}"
- Student Answer: "${q.studentAnswer}"
- Correct Answer: "${q.correctAnswer}"
- Passage snippet context: "${q.passageContext}"`).join("\n---\n")}

Return a JSON object only. The keys should be the Question IDs as strings, and values should be the brief explanation. Example structure:
{
  "1": "The passage states X, whereas your answer Y implies Z."
}`;
          const messages: ChatMessage[] = [
            { role: "system", content: "You are an IELTS tutor. Respond in valid JSON format only." },
            { role: "user", content: prompt }
          ];
          const completion = await OpenRouterService.getCompletion(messages, "openrouter/optimus-alpha", true);
          explanations = JSON.parse(completion.trim());
        } catch (e) {
          console.error("[AI Explanation Generation Error]:", e);
        }
      }

      // Save to database
      const { error: dbErr } = await supabase.from("reading_attempts").insert({
        user_id: req.user.id,
        test_title: test.title,
        score,
        total_questions,
        band_score,
        answers_json: gradingReport,
        explanations_json: explanations,
      });

      if (dbErr) throw dbErr;

      res.status(200).json({
        score,
        total_questions,
        band_score,
        details: gradingReport,
        explanations,
      });
    } catch (error: any) {
      console.error("[Submit Reading Attempt Error]:", error);
      res.status(500).json({ error: error.message || "Failed to submit attempt" });
    }
  }

  /**
   * Evaluate a listening test attempt.
   */
  static async submitListening(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { test_id, answers } = req.body;
      if (!test_id || !answers) {
        res.status(400).json({ error: "test_id and answers are required" });
        return;
      }

      const tests = getListeningTestsData();
      const test = tests.find((t: any) => t.id === test_id);
      if (!test) {
        res.status(404).json({ error: "Listening test not found" });
        return;
      }

      const allQuestions: any[] = [];
      test.sections.forEach((s: any) => {
        allQuestions.push(...s.questions);
      });

      let score = 0;
      const total_questions = allQuestions.length;
      const gradingReport: any = {};
      const incorrectQuestions: any[] = [];

      allQuestions.forEach((q: any) => {
        const studentAns = (answers[q.id] || "").trim().toLowerCase();
        const correctAns = q.correctAnswer.trim().toLowerCase();
        const isCorrect = studentAns === correctAns;

        if (isCorrect) score++;
        else {
          incorrectQuestions.push({
            id: q.id,
            questionText: q.questionText,
            studentAnswer: answers[q.id] || "No Answer",
            correctAnswer: q.correctAnswer,
          });
        }

        gradingReport[q.id] = {
          correct: isCorrect,
          correctAnswer: q.correctAnswer,
          submittedAnswer: answers[q.id] || "",
        };
      });

      // Calculate estimated band score scaled to 40-question IELTS table
      const band_score = rawScoreToBand(score, total_questions);

      // Call OpenRouter for Listening explanations
      let explanations: Record<string, string> = {};
      if (incorrectQuestions.length > 0) {
        try {
          const prompt = `You are an IELTS Listening coach. Analyze why the student made these errors (spelling, formatting, incorrect choices) and provide a brief (1-sentence) explanation for each.
Here are the incorrect questions:
${incorrectQuestions.map(q => `Question ID ${q.id}: "${q.questionText}"
- Student Answer: "${q.studentAnswer}"
- Correct Answer: "${q.correctAnswer}"`).join("\n---\n")}

Return a JSON object only. The keys should be the Question IDs as strings, and values should be the brief explanation. Example structure:
{
  "1": "Make sure to write the exact year digit (1923) rather than text words."
}`;
          const messages: ChatMessage[] = [
            { role: "system", content: "You are an IELTS tutor. Respond in valid JSON format only." },
            { role: "user", content: prompt }
          ];
          const completion = await OpenRouterService.getCompletion(messages, "openrouter/optimus-alpha", true);
          explanations = JSON.parse(completion.trim());
        } catch (e) {
          console.error("[AI Listening Explanation Error]:", e);
        }
      }

      // Save to database
      const { error: dbErr } = await supabase.from("listening_attempts").insert({
        user_id: req.user.id,
        test_title: test.title,
        score,
        total_questions,
        band_score,
        answers_json: gradingReport,
        explanations_json: explanations,
      });

      if (dbErr) throw dbErr;

      res.status(200).json({
        score,
        total_questions,
        band_score,
        details: gradingReport,
        explanations,
      });
    } catch (error: any) {
      console.error("[Submit Listening Attempt Error]:", error);
      res.status(500).json({ error: error.message || "Failed to submit attempt" });
    }
  }
}
