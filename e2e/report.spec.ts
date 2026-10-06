import { expect, test, type Page } from "@playwright/test";
import { PARTIAL_REPORT, REPORT_WITH_FINDINGS, analyze, mockAnalysis, mockAnalysisError } from "./fixtures";

test.describe("home", () => {
  test("lists the seven real checks before anything runs", async ({ page }) => {
    await page.goto("/?lang=pt");

    const plan = page.getByRole("region", { name: /plano da varredura/i });
    await expect(plan.getByRole("listitem")).toHaveCount(7);
    await expect(plan.getByText("em espera")).toHaveCount(7);
    await expect(plan.getByRole("status")).toHaveText("0 / 7 concluídas");
    await expect(plan.getByRole("progressbar", { name: "Progresso" })).toHaveAttribute("aria-valuenow", "0");
    await expect(plan.getByText("0%")).toBeVisible();
  });

  test("keeps the live progress on screen while the checks run, phone included", async ({ page }) => {
    // Never answered, so the analysis stays running for the assertion.
    await page.route("**/api/analyze?**", () => {});
    await analyze(page, "exemplo.com.br");

    await expect(page.getByRole("button", { name: "Analisando…" })).toBeDisabled();
    await expect(page.getByRole("progressbar", { name: "Progresso" })).toBeInViewport();
  });
});

test.describe("report", () => {
  test("leads with the overall score and groups findings by what to do", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    // The finished plan stays up for a moment before the report replaces it.
    await expect(page.getByRole("status")).toHaveText("7 / 7 concluídas");
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    await expect(page).toHaveTitle(/^56 · exemplo.com.br | /);
    const summary = page.getByRole("complementary", { name: "Nota geral" });
    await expect(summary.getByText("56", { exact: true })).toBeVisible();
    await expect(summary.getByText("2 críticos")).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: "Resolver primeiro" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Corrigir depois" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "O site não é servido em HTTPS." })).toBeVisible();

    // Suggestions never cost points, so they wait behind one toggle.
    const optional = page.getByRole("region", { name: "Melhorias opcionais" });
    await expect(optional.getByRole("heading", { level: 3 })).toBeHidden();
    await optional.getByText("Ver a melhoria opcional").click();
    await expect(optional.getByRole("heading", { level: 3, name: /Content-Security-Policy/ })).toBeVisible();
  });

  test("shows how to fix each finding and which elements it's about, as plain text", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    // Critical: the fix is written out, the affected images listed.
    const altFinding = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "3 de 4 imagens sem texto alternativo." }) });
    await expect(altFinding.getByText(/usar alt="" nas que são só decorativas/)).toBeVisible();
    const images = altFinding.getByRole("list", { name: "As 3 imagens afetadas" });
    await expect(images.getByText("/img/hero.jpg")).toBeVisible();
    await expect(images.getByText("(imagem sem endereço no HTML)")).toBeVisible();
    await expect(altFinding.getByRole("link")).toHaveCount(0);

    // Attention: the fix is one tap away.
    const linksFinding = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "2 de 8 links testados na home estão quebrados." }) });
    await linksFinding.getByText("Como resolver").click();
    await expect(linksFinding.getByText("Os 2 links quebrados")).toBeVisible();
    await expect(linksFinding.getByText("https://exemplo.com.br/contato.php")).toBeVisible();
    await expect(linksFinding.getByRole("link")).toHaveCount(0);
  });

  test("explains unmeasured categories and offers a manual review for a blocking site", async ({ page }) => {
    await mockAnalysis(page, PARTIAL_REPORT);
    await analyze(page, "bloqueado.com.br");

    await expect(page.getByText("Nota baseada em 1 de 4 categorias", { exact: false })).toBeVisible();
    await expect(page.getByText("O site recusou nosso acesso automático.").first()).toBeVisible();
    await expect(page.getByText("A medição demorou demais. Vale tentar de novo.")).toBeVisible();

    await page.getByRole("button", { name: "Pedir análise manual →" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /sem depender de robô/ })).toBeVisible();
    await expect(page.getByLabel("Mensagem")).toHaveValue("Quero uma análise manual de bloqueado.com.br.");
  });

  test("goes to the contact step and back, and starts over from the header", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByRole("heading", { name: "O que pode ser feito", exact: true })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await page.getByLabel("Nome").fill("Ana");
    await page.getByLabel("Mensagem").fill("Quero ajuda com o HTTPS.");

    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Resolver primeiro" })).toBeVisible();

    // Going back to the report doesn't throw away what was typed.
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("Nome")).toHaveValue("Ana");
    await expect(page.getByLabel("Mensagem")).toHaveValue("Quero ajuda com o HTTPS.");
    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();

    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
    await expect(page).not.toHaveTitle(/exemplo.com.br/);
    // The plan starts over, not showing the previous run as done.
    const plan = page.getByRole("region", { name: /plano da varredura/i });
    await expect(plan.getByRole("status")).toHaveText("0 / 7 concluídas");
    await expect(plan.getByText("em espera")).toHaveCount(7);
  });

  test("never scrolls sideways", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    await page.getByText("Ver a melhoria opcional").click();
    for (const toggle of await page.getByText("Como resolver", { exact: true }).all()) await toggle.click();

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
    await expect(page.getByLabel("Endereço do site")).toHaveValue("isso não é um site");
  });

  test("tells a rate-limited visitor how long to wait", async ({ page }) => {
    await mockAnalysisError(page, 429, { code: "rate-limited", retryAfterSeconds: 1500 });
    await analyze(page, "exemplo.com.br");

    await expect(formError(page)).toHaveText(/Tenta de novo em 25 minutos/);
  });
});
