import { vi } from "vitest";

// safeFetch uses undici's own fetch; routing it through the global one
// lets tests stub the network in one place.
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<typeof import("undici")>()),
  fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => globalThis.fetch(input, init),
}));
