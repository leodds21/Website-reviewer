export type SseEvent = { event: string; data: string };

/**
 * Incremental Server-Sent Events parser.
 *
 * The obvious version — decode a chunk, split it on "\n\n" — silently
 * loses data, because chunk boundaries have nothing to do with event
 * boundaries: a single event routinely arrives split across two reads,
 * and two events can arrive in one. This keeps a buffer across calls
 * and only emits frames it has actually seen terminated.
 *
 * Deliberately partial: this parses the subset the analyze route emits
 * (named events with a single-line JSON `data:`), not the full spec —
 * no id/retry handling, no reconnection, no multi-line data folding,
 * since nothing here produces those.
 */
export function createSseParser() {
  let buffer = "";

  return {
    /** Feeds a decoded chunk in, returns whatever events completed. */
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

  // A frame with no data line is a comment/keepalive, not an event.
  return dataLines.length > 0 ? { event, data: dataLines.join("\n") } : null;
}
