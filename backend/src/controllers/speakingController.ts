import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { OpenRouterService, ChatMessage } from "../services/openrouter";
import { z } from "zod";
import axios from "axios";

const evaluateSpeakingSchema = z.object({
  part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().min(5, "Prompt must be at least 5 characters"),
  transcript: z.string().min(10, "Transcript must be at least 10 characters"),
});

export class SpeakingController {
  /**
   * Transcribe user speech audio using Groq Whisper.
   */
  static async transcribeAudio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided in request." });
        return;
      }

      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      if (!GROQ_API_KEY) {
        res.status(500).json({ error: "Groq API key not configured on server." });
        return;
      }

      console.log(`[Speaking] Transcribing file: ${req.file.originalname}, size: ${req.file.size} bytes`);

      // Construct native FormData
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype || "audio/wav" });
      
      // Append fields required by Groq Whisper API
      formData.append("file", blob, req.file.originalname || "audio.wav");
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "json");
      formData.append("language", "en");
      formData.append("prompt", "IELTS speaking test response. Candidate speech with natural pauses and filler words like um, uh, well, like.");

      // Send post to Groq
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq Whisper API returned error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const rawTranscript = result.text || "";
      const cleanedTranscript = cleanTranscript(rawTranscript);

      res.status(200).json({
        transcript: cleanedTranscript,
      });
    } catch (error: any) {
      console.error("[Transcribe Audio Error]:", error);
      res.status(500).json({ error: error.message || "Failed to transcribe speech." });
    }
  }

  /**
   * Evaluate a speaking answer transcript against IELTS grading standards.
   */
  static async evaluateSpeaking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validate inputs
      const parsed = evaluateSpeakingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.format() });
        return;
      }

      const { part, prompt, transcript } = parsed.data;
      const user_id = req.user.id;

      // 2. Fetch target band score
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_band")
        .eq("id", user_id)
        .single();

      const targetBand = profile?.target_band || 7.0;

      // 3. Construct the prompt
      const systemPrompt = `You are a certified IELTS Speaking Examiner. Your job is to evaluate the candidate's transcribed spoken response for Part ${part} of the speaking test.
Evaluate the response strictly against the official IELTS speaking descriptors:
- Fluency and Coherence
- Lexical Resource (Vocabulary)
- Grammatical Range and Accuracy
- Pronunciation (Note: You are reviewing a transcript, so provide constructive advice on how filler words, pauses, and sentence flows affect their apparent pronunciation and pacing score. Suggest specific phonemes or intonation features that might need focus based on typical errors for their target range).

The candidate's target band score is ${targetBand}. Give precise, feedback.

You MUST respond with a JSON object ONLY. Do not include markdown wraps (like \`\`\`json) or conversational preamble.
Your JSON must strictly match this schema:
{
  "band_score": number, // Overall speaking band score (0.0 to 9.0 in steps of 0.5)
  "fluency_coherence": number, // score (0.0 to 9.0 in steps of 0.5)
  "lexical_resource": number, // score (0.0 to 9.0 in steps of 0.5)
  "grammatical_range": number, // score (0.0 to 9.0 in steps of 0.5)
  "pronunciation": number, // estimated score (0.0 to 9.0 in steps of 0.5)
  "examiner_comments": "Write a professional paragraph from the examiner summarizing strengths and key weaknesses.",
  "improvements": [
    "bullet point 1 highlighting how to improve lexical diversity or reduce pauses",
    "bullet point 2 outlining specific grammar or pronunciation exercises"
  ]
}

Ensure all scores are floating point numbers (e.g. 6.5, 7.0, 7.5). Make sure the output is pure JSON.`;

      const userContent = `IELTS SPEAKING PART: Part ${part}
EXAMINER QUESTION/PROMPT: "${prompt}"
CANDIDATE TRANSCRIPT:
"${transcript}"`;

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
            // Parse JSON
            let cleanText = assistantResponse.trim();
            if (cleanText.startsWith("```json")) {
              cleanText = cleanText.substring(7);
            }
            if (cleanText.endsWith("```")) {
              cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            const resultJSON = JSON.parse(cleanText.trim());

            // Save the speaking response to supabase
            const { data: dbRecord, error: dbErr } = await supabase
              .from("speaking_submissions")
              .insert({
                user_id,
                part,
                prompt,
                transcript,
                band_score: resultJSON.band_score,
                fluency_coherence: resultJSON.fluency_coherence,
                lexical_resource: resultJSON.lexical_resource,
                grammatical_range: resultJSON.grammatical_range,
                pronunciation: resultJSON.pronunciation,
                feedback_json: {
                  examiner_comments: resultJSON.examiner_comments || "",
                  improvements: resultJSON.improvements || [],
                },
              })
              .select()
              .single();

            if (dbErr) {
              console.error("[DB Store Error for Speaking Submission]:", dbErr);
            }

            // Send SSE done signal containing the dbRecord id and parsed JSON
            res.write(`data: ${JSON.stringify({ done: true, id: dbRecord?.id, result: resultJSON })}\n\n`);
          } catch (parseErr) {
            console.error("[Speaking Evaluation Parse/Store Error] Raw text:", assistantResponse, parseErr);
            res.write(`data: ${JSON.stringify({ error: "AI returned an invalid JSON response structure." })}\n\n`);
          } finally {
            res.write("data: [DONE]\n\n");
            res.end();
          }
        },
        (error) => {
          console.error("[Speaking Streaming Error]:", error);
          res.write(`data: ${JSON.stringify({ error: error.message || "Failed to stream message" })}\n\n`);
          res.end();
        },
        "openai/gpt-oss-20b:free"
      );
    } catch (error: any) {
      console.error("[Speaking Evaluation Router Error]:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  /**
   * Get user's speaking history.
   */
  static async getSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.id;
      const { data, error } = await supabase
        .from("speaking_submissions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error("[Get Speaking Submissions Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch speaking submissions" });
    }
  }

  /**
   * Synthesize text to speech using ElevenLabs API.
   * If ELEVENLABS_API_KEY is not defined, returns { fallback: true }.
   */
  static async synthesizeText(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ error: "Text is required for synthesis" });
        return;
      }

      const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        console.log("[ElevenLabs] API key not found. Using browser fallback.");
        res.status(200).json({ fallback: true, message: "ElevenLabs API Key not configured" });
        return;
      }

      const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
      const modelId = "eleven_monolingual_v1";

      const response = await axios({
        method: "post",
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          accept: "audio/mpeg",
        },
        data: {
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        responseType: "arraybuffer",
      });

      res.set({
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      });
      res.send(Buffer.from(response.data));
    } catch (error: any) {
      const errorMsg = error?.response?.data
        ? Buffer.isBuffer(error.response.data)
          ? error.response.data.toString()
          : JSON.stringify(error.response.data)
        : error.message;
      console.error("[ElevenLabs Synthesis Error]:", errorMsg);
      res.status(200).json({ fallback: true, error: errorMsg || "ElevenLabs synthesis failed" });
    }
  }
}

function cleanTranscript(text: string): string {
  if (!text) return "";
  
  let cleaned = text.trim();

  // Remove instruction prompt remnants
  cleaned = cleaned.replace(/transcribe\s+strictly\s+in\s+english\.?/gi, "");
  cleaned = cleaned.replace(/english\s+speech\s+response\s+for\s+ielts\.?/gi, "");
  
  // Remove common Whisper silence hallucinations
  const silenceHallucinations = [
    "thank you for watching",
    "thank you for watching.",
    "please subscribe",
    "please subscribe.",
    "subscribe to my channel",
    "subscribe to my channel.",
    "transcribe strictly in english",
    "transcribe strictly in english."
  ];

  const lowerText = cleaned.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  for (const phrase of silenceHallucinations) {
    const normalizedPhrase = phrase.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    if (lowerText === normalizedPhrase) {
      return "";
    }
  }

  // Remove consecutive identical sentence repetitions (e.g. "Sentence. Sentence. Sentence.")
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  if (sentences.length > 2) {
    const uniqueSentences: string[] = [];
    let repeatCount = 0;
    let lastSentence = "";
    
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const normalizedLast = lastSentence.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      
      if (normalized === normalizedLast && normalized.length > 0) {
        repeatCount++;
        if (repeatCount < 1) {
          uniqueSentences.push(sentence);
        }
      } else {
        repeatCount = 0;
        uniqueSentences.push(sentence);
        lastSentence = sentence;
      }
    }
    cleaned = uniqueSentences.join(" ");
  }

  return cleaned.trim();
}
