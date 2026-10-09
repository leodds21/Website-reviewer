import { describe, expect, it } from "vitest";
import { createSseParser } from "./sse";

describe("createSseParser", () => {
  it("parses a single complete event", () => {
    const parser = createSseParser();

    expect(parser.push('event: step\ndata: {"step":"https"}\n\n')).toEqual([
      { event: "step", data: '{"step":"https"}' },
    ]);
  });

  it("parses several events arriving in one chunk", () => {
    const parser = createSseParser();

    const events = parser.push('event: step\ndata: {"a":1}\n\nevent: done\ndata: {"b":2}\n\n');

    expect(events.map((e) => e.event)).toEqual(["step", "done"]);
  });

  it("holds back an event that hasn't been terminated yet", () => {
    const parser = createSseParser();

    expect(parser.push("event: step\ndata: {")).toEqual([]);
  });

  it("reassembles an event split across chunk boundaries", () => {
    // Chunk boundaries don't follow event boundaries.
    const parser = createSseParser();

    expect(parser.push('event: do')).toEqual([]);
    expect(parser.push('ne\ndata: {"score"')).toEqual([]);
    expect(parser.push(':84}\n\n')).toEqual([{ event: "done", data: '{"score":84}' }]);
  });

  it("keeps the tail of a chunk that ends mid-event for the next push", () => {
    const parser = createSseParser();

    const first = parser.push('event: step\ndata: {"step":"https"}\n\nevent: step\ndata: {"ste');
    expect(first).toHaveLength(1);

    expect(parser.push('p":"pagespeed"}\n\n')).toEqual([{ event: "step", data: '{"step":"pagespeed"}' }]);
  });

  it("ignores keepalive/comment frames that carry no data line", () => {
    const parser = createSseParser();

    expect(parser.push(": keepalive\n\n")).toEqual([]);
  });

  it("defaults to the 'message' event name when none is given", () => {
    const parser = createSseParser();

    expect(parser.push("data: hello\n\n")).toEqual([{ event: "message", data: "hello" }]);
  });
});
