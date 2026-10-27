// Free tiers cap each model separately, so requests walk a chain of providers and models and move
// on when one is rate-limited or down. Groq allows ~1,000 requests a day per model; OpenRouter's free
// tier only 50 a day in total, so it is the last resort. Override the lists with GROQ_MODELS and
// OPENROUTER_MODELS (comma-separated).
const list = (value: string | undefined, fallback: string) =>
  (value || fallback).split(",").map((m) => m.trim()).filter(Boolean);

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  body: Record<string, unknown>;
}

function providers(): Provider[] {
  const groq = list(process.env.GROQ_MODELS, "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b").map(
    (model): Provider => ({
      name: `groq ${model}`,
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      body: { model, ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }) },
    })
  );
  const openrouter: Provider = {
    name: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    body: {
      models: list(
        process.env.OPENROUTER_MODELS,
        "google/gemma-4-31b-it:free,poolside/laguna-s-2.1:free,google/gemma-4-26b-a4b-it:free"
      ),
    },
  };
  return [...groq, openrouter].filter((p) => p.key);
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function request(messages: ChatMessage[], stream: boolean, json: boolean, timeoutMs: number) {
  const chain = providers();
  // One deadline for the whole chain, so a slow provider cannot multiply the wait.
  const signal = AbortSignal.timeout(timeoutMs);
  if (chain.length === 0) throw new Error("No AI provider key is configured.");
  let last: globalThis.Response | undefined;
  for (const provider of chain) {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        "X-Title": "IELTS AI Platform",
      },
      body: JSON.stringify({
        ...provider.body,
        messages,
        stream,
        ...(json && { response_format: { type: "json_object" } }),
      }),
      signal,
    }).catch((error) => {
      console.error(`[AI] ${provider.name} unreachable:`, error.message);
      return undefined;
    });
    if (response?.ok) return response;
    if (signal.aborted) break;
    if (response) {
      if (!RETRYABLE.has(response.status)) return response;
      console.warn(`[AI] ${provider.name} returned ${response.status}, trying the next provider`);
      if (last) await last.body?.cancel();
      last = response;
    }
  }
  if (!last) throw new Error("The AI marker could not be reached. Try again in a minute.");
  return last;
}

async function failure(response: globalThis.Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  console.error(`[AI] ${response.status}: ${body}`);
  return new Error(
    response.status === 429
      ? "The AI marker is busy right now. Try again in a minute."
      : `The AI marker failed (error ${response.status}). Try again in a minute.`
  );
}

export async function complete(messages: ChatMessage[], json = false, timeoutMs = 120_000): Promise<string> {
  const response = await request(messages, false, json, timeoutMs);
  if (!response.ok) throw await failure(response);
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty response");
  return content;
}

/** Streams tokens to `onToken` and resolves with the full text. */
export async function streamCompletion(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  json = false
): Promise<string> {
  const response = await request(messages, true, json, 120_000);
  if (!response.ok || !response.body) throw await failure(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") return;
    const data = JSON.parse(trimmed.slice(6));
    if (data.error) throw new Error(data.error.message || "AI provider stream error");
    const token = data?.choices?.[0]?.delta?.content;
    if (token) {
      full += token;
      onToken(token);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer + decoder.decode());

  if (!full) throw new Error("AI provider returned an empty response");
  return full;
}

/** Extracts the JSON object from a model reply that may include fences or preamble. */
export function parseJsonReply<T = any>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new SyntaxError("AI reply did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/** Non-streaming JSON completion; asks again once if the model returns malformed JSON. */
export async function completeJson<T = any>(messages: ChatMessage[], timeoutMs?: number): Promise<T> {
  try {
    return parseJsonReply<T>(await complete(messages, true, timeoutMs));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn("[OpenRouter] Malformed JSON reply, retrying once");
    return parseJsonReply<T>(await complete(messages, true, timeoutMs));
  }
}
