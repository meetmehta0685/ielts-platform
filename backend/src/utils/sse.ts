import { Response } from "express";
import { ChatMessage, parseJsonReply, streamCompletion } from "../services/ai";

export function startSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

export function sendSse(res: Response, data: unknown) {
  res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
}

/**
 * Streams a JSON-producing evaluation as SSE: `{token}` events while generating, then
 * `{done, id, result}` once the parsed result is saved, or `{error}`; always ends with `[DONE]`.
 */
export async function streamJsonEvaluation<T>(
  res: Response,
  messages: ChatMessage[],
  save: (result: T) => Promise<string>
): Promise<void> {
  startSse(res);
  try {
    const text = await streamCompletion(messages, (token) => sendSse(res, { token }), true);
    const result = parseJsonReply<T>(text);
    const id = await save(result);
    sendSse(res, { done: true, id, result });
  } catch (error: any) {
    console.error("[Evaluation Error]:", error);
    sendSse(res, { error: error.message || "Evaluation failed" });
  }
  sendSse(res, "[DONE]");
  res.end();
}
