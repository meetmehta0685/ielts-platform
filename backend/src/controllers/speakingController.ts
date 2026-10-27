import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { ChatMessage } from "../services/ai";
import { streamJsonEvaluation } from "../utils/sse";
import { z } from "zod";

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
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
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

      await streamJsonEvaluation<any>(res, messages, async (result) => {
        const { data, error } = await supabase
          .from("speaking_submissions")
          .insert({
            user_id,
            part,
            prompt,
            transcript,
            band_score: result.band_score,
            fluency_coherence: result.fluency_coherence,
            lexical_resource: result.lexical_resource,
            grammatical_range: result.grammatical_range,
            pronunciation: result.pronunciation,
            feedback_json: {
              examiner_comments: result.examiner_comments || "",
              improvements: result.improvements || [],
            },
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      });
    } catch (error: any) {
      console.error("[Speaking Evaluation Router Error]:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message || "Internal server error" });
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

      const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // premade "Sarah"
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        console.error("[ElevenLabs Synthesis Error]:", errorMsg);
        res.status(200).json({ fallback: true, error: "ElevenLabs synthesis failed" });
        return;
      }

      res.set("Content-Type", "audio/mpeg");
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error: any) {
      console.error("[ElevenLabs Synthesis Error]:", error);
      res.status(200).json({ fallback: true, error: "ElevenLabs synthesis failed" });
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
    "transcribe strictly in english.",
    "thank you",
    "thank you very much",
    "thanks for watching",
    "you",
    "bye",
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
