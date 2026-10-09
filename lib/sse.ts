export type SseEvent = { event: string; data: string };

// Buffers across reads: one event can span two chunks. Handles only what
// the analyze route sends (named events, one-line JSON data).
export function createSseParser() {
  let buffer = "";

  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk;
      const events: SseEvent[] = [];

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const parsed = parseFrame(frame);
        if (parsed) events.push(parsed);

        separator = buffer.indexOf("\n\n");
      }

      return events;
    },
  };
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  // No data line: a comment or keepalive.
  return dataLines.length > 0 ? { event, data: dataLines.join("\n") } : null;
}
