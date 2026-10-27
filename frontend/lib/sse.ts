/**
 * Reads the backend's POST-based server-sent event stream.
 *
 * The backend sends `data: {json}` events and finishes with `data: [DONE]`. Events can be split
 * across network chunks, so lines are buffered until complete. Resolves when the stream ends.
 * Throws if the response is not OK (using the backend's `error` message when present) or if the
 * stream reports `{ error }`.
 */
export async function readSseEvents<T = Record<string, unknown>>(
  response: Response,
  onEvent: (event: T) => void
): Promise<void> {
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" ? body.error : `Request failed (${response.status})`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data);
    if (event && typeof event.error === "string") throw new Error(event.error);
    onEvent(event as T);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(handleLine);
    }
    handleLine(buffer + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
