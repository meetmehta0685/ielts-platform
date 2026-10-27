const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// OpenRouter tries these in order, falling back when one is rate-limited or down. Free models
// churn often, so override with OPENROUTER_MODELS (comma-separated, up to three) as needed.
const MODELS = (
  process.env.OPENROUTER_MODELS ||
  "google/gemma-4-31b-it:free,poolside/laguna-s-2.1:free,google/gemma-4-26b-a4b-it:free"
).split(",").map((m) => m.trim());

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function request(messages: ChatMessage[], stream: boolean, json: boolean, retries = 1) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "IELTS AI Platform",
    },
    body: JSON.stringify({
      models: MODELS,
      messages,
      stream,
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  // Free models share upstream rate limits; one short backoff usually clears it.
  if (response.status === 429 && retries > 0) {
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return request(messages, stream, json, retries - 1);
  }
  return response;
}

async function failure(response: globalThis.Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  console.error(`[OpenRouter] ${response.status}: ${body}`);
  return new Error(`AI provider returned ${response.status}`);
}

export async function complete(messages: ChatMessage[], json = false): Promise<string> {
  const response = await request(messages, false, json);
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
  const response = await request(messages, true, json);
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
export async function completeJson<T = any>(messages: ChatMessage[]): Promise<T> {
  try {
    return parseJsonReply<T>(await complete(messages, true));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn("[OpenRouter] Malformed JSON reply, retrying once");
    return parseJsonReply<T>(await complete(messages, true));
  }
}
