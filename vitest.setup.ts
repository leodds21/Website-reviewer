import { vi } from "vitest";

// lib/safeFetch.ts sends target-site requests through undici's own
// fetch, so its connection guard applies. Tests control the network by
// stubbing the global fetch; routing undici's fetch through it keeps
// every one of those stubs in charge. guardedLookup, the guard itself,
// is tested directly in lib/safeFetch.test.ts.
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<typeof import("undici")>()),
  fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => globalThis.fetch(input, init),
}));
