import type { Page } from "@playwright/test";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";

// A site with something at every severity, including the two findings
// that carry affected elements.
export const REPORT_WITH_FINDINGS: AnalyzeReport = {
  domain: "exemplo.com.br",
  platform: "wordpress",
  checkedAt: "2026-10-05T12:00:00.000Z",
  score: {
    overall: 56,
    overallSeverity: "atencao",
    performance: { score: 100, severity: "ok", partial: false },
    seo: { score: 66, severity: "atencao", partial: false },
    accessibility: { score: 58, severity: "atencao", partial: false },
    security: { score: 0, severity: "critico", partial: false },
  },
  issues: [
    { category: "security", severity: "critico", code: "no-https" },
    { category: "security", severity: "sugestao", code: "no-csp" },
    { category: "seo", severity: "atencao", code: "no-description" },
    {
      category: "seo",
      severity: "atencao",
      code: "broken-links",
      params: { broken: 2, checked: 8 },
      affected: ["https://exemplo.com.br/servicos-antigos", "https://exemplo.com.br/contato.php"],
    },
    {
      category: "accessibility",
      severity: "critico",
      code: "missing-alt",
      params: { missing: 3, sampled: 4 },
      affected: ["/img/hero.jpg", "", "data:image/png"],
    },
  ],
};

export const PARTIAL_REPORT: AnalyzeReport = {
  domain: "bloqueado.com.br",
  platform: null,
  blocked: true,
  checkedAt: "2026-10-05T12:00:00.000Z",
  score: {
    overall: 92,
    overallSeverity: "ok",
    performance: { score: null, severity: "indisponivel", reason: "blocked" },
    seo: { score: null, severity: "indisponivel", reason: "timeout" },
    accessibility: { score: null, severity: "indisponivel", reason: "blocked" },
    security: { score: 92, severity: "ok", partial: true },
  },
  issues: [],
};

const STEPS = ["https", "securityHeaders", "metaTags", "altImages", "sitemapRobots", "brokenLinks", "pagespeed"];

function sse(events: { event: string; data: unknown }[]): string {
  return events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

/** Answers the analysis endpoint with every step and then this report. */
export async function mockAnalysis(page: Page, report: AnalyzeReport): Promise<void> {
  await page.route("**/api/analyze?**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: sse([...STEPS.map((step) => ({ event: "step", data: { step } })), { event: "done", data: report }]),
    }),
  );
}

/** Answers the analysis endpoint with an error, as the route does for bad input. */
export async function mockAnalysisError(page: Page, status: number, error: AnalyzeError): Promise<void> {
  await page.route("**/api/analyze?**", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(error) }),
  );
}

export async function analyze(page: Page, url: string): Promise<void> {
  await page.goto("/?lang=pt");
  await page.getByLabel("Endereço do site").fill(url);
  await page.getByRole("button", { name: /Rodar diagnóstico/ }).click();
}
