import { redis } from "./kv";
import { newReportId, isReportId } from "./reportId";
import type { AnalyzeReport } from "./report";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_REPORTS = 500;

// Shared links outlive the analysis cache: long enough to send a report and
// have it opened, short enough not to keep analyzed URLs around for long.
export function reportTtlMs(): number {
  const days = Number(process.env.REPORT_TTL_DAYS);
  return (Number.isFinite(days) && days >= 1 && days <= 365 ? days : 30) * DAY_MS;
}

/** What a shared report link points to. Never the analyzed page's HTML. */
export type StoredReport = {
  version: 1;
  id: string;
  targetUrl: string;
  domain: string;
  report: AnalyzeReport;
  createdAt: string;
  expiresAt: string;
};

const keyFor = (id: string) => `report:${id}`;

const memory = new Map<string, StoredReport>();

function rememberInMemory(stored: StoredReport): void {
  memory.set(stored.id, stored);
  // Map keeps insertion order, so the first keys are the oldest.
  while (memory.size > MAX_MEMORY_REPORTS) memory.delete(memory.keys().next().value!);
}

export async function saveReport(report: AnalyzeReport, targetUrl: string, now = Date.now()): Promise<StoredReport> {
  const ttl = reportTtlMs();
  const id = newReportId();
  const stored: StoredReport = {
    version: 1,
    id,
    targetUrl,
    domain: report.domain,
    report: { ...report, id },
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };

  if (redis) {
    try {
      await redis.set(keyFor(id), stored, { px: ttl });
      return stored;
    } catch (error) {
      console.error("reportStore: Redis write failed, keeping it in memory", error);
    }
  }
  rememberInMemory(stored);
  return stored;
}

/** null for an unknown, expired or malformed id. */
export async function getStoredReport(id: string, now = Date.now()): Promise<StoredReport | null> {
  if (!isReportId(id)) return null;

  let stored: StoredReport | null = null;
  if (redis) {
    try {
      stored = await redis.get<StoredReport>(keyFor(id));
    } catch (error) {
      console.error("reportStore: Redis read failed", error);
    }
  }
  stored ??= memory.get(id) ?? null;

  if (!stored || stored.version !== 1 || Date.parse(stored.expiresAt) <= now) return null;
  return stored;
}
