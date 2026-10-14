import { redis, redisError } from "./kv";
import type { AnalyzeReport } from "./report";
import type { AnalyzeErrorCode } from "./analyzeError";
import type { StepKey } from "./scanSteps";

/**
 * Coalesces identical analyses: the first request for a URL leads and
 * publishes its progress; concurrent ones follow that progress instead of
 * spending another PageSpeed run. The lock expires on its own, so a leader
 * that dies can't block a URL for longer than LOCK_TTL_MS.
 */

// Longer than the route's maxDuration (60s), so a live leader never loses it.
const LOCK_TTL_MS = 75_000;
const STATE_TTL_MS = 120_000;
const POLL_MS = 1000;
const MAX_READ_ERRORS = 3;

export type Snapshot = {
  steps: StepKey[];
  partial?: AnalyzeReport;
  final?: AnalyzeReport;
  failed?: AnalyzeErrorCode;
  // The leader's visitor left; a follower should take over.
  aborted?: true;
};

type Store = {
  claim(lockKey: string, runId: string): Promise<boolean>;
  owner(lockKey: string): Promise<string | null>;
  read(lockKey: string, stateKey: string): Promise<{ owner: string | null; state: Snapshot | null }>;
  write(stateKey: string, snapshot: Snapshot): Promise<void>;
  release(lockKey: string, runId: string): Promise<void>;
};

const lockKeyFor = (cacheKey: string) => `inflight:${cacheKey}`;
const stateKeyFor = (runId: string) => `inflight:${runId}:state`;

function redisStore(client: NonNullable<typeof redis>): Store {
  // Deletes the lock only if this run still owns it, so a late release can't
  // free a lock a newer leader took after ours expired.
  const releaseScript = client.createScript<number>(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
  );
  return {
    claim: async (lockKey, runId) => (await client.set(lockKey, runId, { nx: true, px: LOCK_TTL_MS })) === "OK",
    owner: (lockKey) => client.get<string>(lockKey),
    read: async (lockKey, stateKey) => {
      const [owner, state] = await client.mget<[string | null, Snapshot | null]>(lockKey, stateKey);
      return { owner, state };
    },
    write: async (stateKey, snapshot) => {
      await client.set(stateKey, snapshot, { px: STATE_TTL_MS });
    },
    release: async (lockKey, runId) => {
      await releaseScript.exec([lockKey], [runId]);
    },
  };
}

const MAX_MEMORY_ENTRIES = 1000;

// Same behavior inside one server instance: dev, tests, no Redis configured.
function memoryStore(): Store {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  // Each run leaves a state key nobody reads again, so expired ones are swept on write.
  const put = (key: string, value: unknown, ttl: number) => {
    const now = Date.now();
    for (const [existing, entry] of entries) if (entry.expiresAt <= now) entries.delete(existing);
    while (entries.size >= MAX_MEMORY_ENTRIES) entries.delete(entries.keys().next().value!);
    entries.set(key, { value, expiresAt: now + ttl });
  };
  const get = <T>(key: string): T | null => {
    const entry = entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry.value as T;
  };
  return {
    claim: async (lockKey, runId) => {
      if (get(lockKey) !== null) return false;
      put(lockKey, runId, LOCK_TTL_MS);
      return true;
    },
    owner: async (lockKey) => get<string>(lockKey),
    read: async (lockKey, stateKey) => ({ owner: get<string>(lockKey), state: get<Snapshot>(stateKey) }),
    write: async (stateKey, snapshot) => {
      put(stateKey, snapshot, STATE_TTL_MS);
    },
    release: async (lockKey, runId) => {
      if (get(lockKey) === runId) entries.delete(lockKey);
    },
  };
}

let store: Store = redis ? redisStore(redis) : memoryStore();

// Tests swap in their own store.
export function setInflightStore(next: Store | null): void {
  store = next ?? (redis ? redisStore(redis) : memoryStore());
}

export type Leader = {
  publish(snapshot: Snapshot): void;
  // Writes the last snapshot, then frees the URL.
  finish(snapshot: Snapshot): Promise<void>;
};

/**
 * Tries to become the one request analyzing this URL. null means another
 * request got there first. If the store fails, this run leads without a
 * lock: no coalescing, which is how the scanner worked before.
 */
export async function claimAnalysis(cacheKey: string): Promise<Leader | null> {
  const lockKey = lockKeyFor(cacheKey);
  const runId = crypto.randomUUID();
  let locked = false;
  try {
    locked = await store.claim(lockKey, runId);
    if (!locked) return null;
  } catch (error) {
    console.error("inflight: lock claim failed, running uncoalesced:", redisError(error));
  }

  const stateKey = stateKeyFor(runId);
  // Writes go out in order, so a follower never sees an older snapshot last.
  let writes: Promise<void> = Promise.resolve();
  const write = (snapshot: Snapshot) => {
    if (!locked) return writes;
    writes = writes.then(() => store.write(stateKey, snapshot)).catch((error) => console.error("inflight: state write failed:", redisError(error)));
    return writes;
  };

  return {
    publish: (snapshot) => void write(snapshot),
    finish: async (snapshot) => {
      await write(snapshot);
      if (!locked) return;
      await store.release(lockKey, runId).catch((error) => console.error("inflight: lock release failed:", redisError(error)));
    },
  };
}

export type FollowOutcome =
  | { kind: "final"; report: AnalyzeReport }
  | { kind: "failed"; code: AnalyzeErrorCode }
  // The leader is gone without a result: aborted, crashed or expired.
  | { kind: "orphaned" }
  | { kind: "timeout" }
  | { kind: "aborted" };

// Removes its abort listener either way, so a long poll doesn't pile them up.
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(id);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const id = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Relays another request's progress until it ends, this request's deadline, or an abort. */
export async function followAnalysis(
  cacheKey: string,
  { signal, deadline, onSnapshot, pollMs = POLL_MS }: { signal: AbortSignal; deadline: number; onSnapshot: (snapshot: Snapshot) => void; pollMs?: number },
): Promise<FollowOutcome> {
  const lockKey = lockKeyFor(cacheKey);
  let runId: string | null = null;
  let errors = 0;
  let sawPartial = false;

  while (!signal.aborted) {
    if (Date.now() >= deadline) return { kind: "timeout" };
    try {
      if (!runId) {
        runId = await store.owner(lockKey);
        if (!runId) return { kind: "orphaned" };
      }
      const { owner, state } = await store.read(lockKey, stateKeyFor(runId));
      errors = 0;
      if (state) {
        onSnapshot(state);
        if (state.final) return { kind: "final", report: state.final };
        if (state.failed) return { kind: "failed", code: state.failed };
        if (state.aborted) return { kind: "orphaned" };
        sawPartial ||= Boolean(state.partial);
      }
      if (owner !== runId) return { kind: "orphaned" };
    } catch (error) {
      console.error("inflight: progress read failed:", redisError(error));
      if (++errors >= MAX_READ_ERRORS) return { kind: "failed", code: "analysis-failed" };
    }
    // After the partial report only PageSpeed is left, which takes a while.
    await pause(sawPartial ? pollMs * 2 : pollMs, signal);
  }
  return { kind: "aborted" };
}
