import { expect, test, type Page } from "@playwright/test";
import { PARTIAL_REPORT, REPORT_WITH_FINDINGS, analyze, mockAnalysis, mockAnalysisError } from "./fixtures";

test.describe("report", () => {
  test("leads with the score, a severity summary and the most important findings", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    await expect(page.getByText("2 críticos")).toBeVisible();
    await expect(page.getByText("2 de atenção")).toBeVisible();
    await expect(page.getByText("1 sugestão")).toBeVisible();

    // Collapsed: only the two critical findings, critical ones first.
    const findings = page.getByRole("listitem").filter({ has: page.getByText(/crítico|atenção|sugestão/i) });
    await expect(findings).toHaveCount(2);
    await expect(findings.first()).toContainText("O site não é servido em HTTPS.");

    await page.getByRole("button", { name: /Ver todos os 5 pontos/ }).click();
    await expect(findings).toHaveCount(5);
    // Suggestions come last.
    await expect(findings.last()).toContainText("Content-Security-Policy");
  });

  test("shows how to fix a finding and which elements it's about, as plain text", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    const altFinding = page.getByRole("listitem").filter({ hasText: "3 de 4 imagens sem texto alternativo." });
    await altFinding.getByText("Como resolver").click();

    await expect(altFinding.getByText(/usar alt="" nas que são só decorativas/)).toBeVisible();
    await expect(altFinding.getByText("As 3 imagens afetadas")).toBeVisible();
    await expect(altFinding.getByText("/img/hero.jpg")).toBeVisible();
    await expect(altFinding.getByText("(imagem sem endereço no HTML)")).toBeVisible();
    // Addresses from the analyzed site are never rendered as links.
    await expect(altFinding.getByRole("link")).toHaveCount(0);
  });

  test("explains unmeasured categories and offers a manual review for a blocking site", async ({ page }) => {
    await mockAnalysis(page, PARTIAL_REPORT);
    await analyze(page, "bloqueado.com.br");

    await expect(page.getByText("Nota baseada em 1 de 4 categorias", { exact: false })).toBeVisible();
    await expect(page.getByText("O site recusou nosso acesso automático.").first()).toBeVisible();
    await expect(page.getByText("A medição demorou demais. Vale tentar de novo.")).toBeVisible();

    await page.getByRole("button", { name: "Pedir análise manual →" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /sem depender de robô/ })).toBeVisible();
    await expect(page.getByLabel("Mensagem")).toHaveValue("Quero uma análise manual de bloqueado.com.br.");
  });

  test("goes from the report to the contact step", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    await page.getByRole("button", { name: "Ver como corrigir →" }).click();

    await expect(page.getByRole("heading", { name: "O que pode ser feito", exact: true })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("never scrolls sideways", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    await page.getByRole("button", { name: /Ver todos os 5 pontos/ }).click();
    for (const toggle of await page.getByText("Como resolver").all()) await toggle.click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// Next.js keeps an empty role="alert" route announcer on every page;
// the form's own error is the one with text.
function formError(page: Page) {
  return page.getByRole("alert").filter({ hasText: /\S/ });
}

test.describe("errors", () => {
  test("says what's wrong with an invalid address, and keeps it in the field to fix", async ({ page }) => {
    await mockAnalysisError(page, 400, { code: "invalid-url" });
    await analyze(page, "isso não é um site");

    await expect(formError(page)).toHaveText(/Esse endereço não parece válido/);
    await expect(page.getByLabel("Analisar")).toHaveValue("isso não é um site");
  });

  test("tells a rate-limited visitor how long to wait", async ({ page }) => {
    await mockAnalysisError(page, 429, { code: "rate-limited", retryAfterSeconds: 1500 });
    await analyze(page, "exemplo.com.br");

    await expect(formError(page)).toHaveText(/Tenta de novo em 25 minutos/);
  });
});
