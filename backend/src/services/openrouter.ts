import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class OpenRouterService {
  /**
   * Send a standard non-streaming prompt to OpenRouter and return the text content.
   */
  static async getCompletion(
    messages: ChatMessage[],
    model = "openrouter/optimus-alpha",
    jsonMode = false,
    attemptedModels: string[] = []
  ): Promise<string> {
    try {
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model,
          messages,
          response_format: jsonMode ? { type: "json_object" } : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/meetmehta/ielts-ai-platform",
            "X-Title": "IELTS AI Platform",
          },
          timeout: 15000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenRouter");
      }
      return content;
    } catch (error: any) {
      console.error("[OpenRouter Error]:", error?.response?.data || error.message);
      const nextAttempted = [...attemptedModels, model];
      const fallbackList = [
        "openrouter/optimus-alpha",
        "nvidia/nemotron-nano-9b-v2:free",
        "openai/gpt-oss-20b:free"
      ];
      const nextModel = fallbackList.find(m => !nextAttempted.includes(m));
      if (nextModel) {
        console.log(`[Info] Retrying with fallback model ${nextModel}...`);
        return this.getCompletion(messages, nextModel, jsonMode, nextAttempted);
      }
      throw new Error(error?.response?.data?.error?.message || "Failed to call OpenRouter");
    }
  }

  /**
   * Streams completion tokens back to the express response.
   */
  static async streamCompletion(
    messages: ChatMessage[],
    onToken: (token: string) => void,
    onEnd: () => void,
    onError: (err: any) => void,
    model = "openrouter/optimus-alpha",
    attemptedModels: string[] = []
  ): Promise<void> {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/meetmehta/ielts-ai-platform",
          "X-Title": "IELTS AI Platform",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(`OpenRouter stream request failed: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine === "data: [DONE]") continue;

          if (cleanLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(cleanLine.slice(6));
              const token = data?.choices?.[0]?.delta?.content;
              if (token) {
                onToken(token);
              }
            } catch (err) {
              // Ignore JSON parse errors on chunk divisions
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer && buffer.startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.slice(6));
          const token = data?.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch (e) {}
      }

      onEnd();
    } catch (error: any) {
      console.error("[OpenRouter Stream Error]:", error);
      const nextAttempted = [...attemptedModels, model];
      const fallbackList = [
        "openrouter/optimus-alpha",
        "nvidia/nemotron-nano-9b-v2:free",
        "openai/gpt-oss-20b:free"
      ];
      const nextModel = fallbackList.find(m => !nextAttempted.includes(m));
      if (nextModel) {
        console.log(`[Info] Retrying stream with fallback model ${nextModel}...`);
        return this.streamCompletion(messages, onToken, onEnd, onError, nextModel, nextAttempted);
      }
      onError(error);
    }
  }
}
