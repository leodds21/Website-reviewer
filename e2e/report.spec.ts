import { expect, test, type Page } from "@playwright/test";
import { CLEAN_REPORT, PARTIAL_REPORT, REPORT_WITH_FINDINGS, analyze, mockAnalysis, mockAnalysisError } from "./fixtures";

test.describe("home", () => {
  test("lists the seven real checks before anything runs", async ({ page }) => {
    await page.goto("/?lang=pt");

    const plan = page.getByRole("region", { name: /plano da varredura/i });
    await expect(plan.getByRole("listitem")).toHaveCount(7);
    await expect(plan.getByText("em espera")).toHaveCount(7);
    await expect(plan.getByRole("status")).toHaveText("0 / 7 concluídas");
    await expect(plan.getByRole("progressbar", { name: "Progresso" })).toHaveAttribute("aria-valuenow", "0");
    await expect(plan.getByText("0%")).toBeVisible();
    // The scan animation belongs to a run; the idle plan has the standby wave instead.
    await expect(plan.locator(".scan-overlay")).toHaveCount(0);
    await expect(plan.locator(".idle-wave")).toHaveCount(7);
  });

  test("keeps the live progress on screen while the checks run, phone included", async ({ page }) => {
    // Never answered, so the analysis stays running for the assertion.
    await page.route("**/api/analyze?**", () => {});
    await analyze(page, "exemplo.com.br");

    await expect(page.getByRole("button", { name: "Analisando…" })).toBeDisabled();
    await expect(page.getByRole("progressbar", { name: "Progresso" })).toBeInViewport();
    await expect(page.locator(".scan-overlay")).toHaveCount(1);
    await expect(page.locator(".idle-wave")).toHaveCount(0);
  });
});

test.describe("report", () => {
  test("leads with the overall score and groups findings by what to do", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    // The finished plan stays up for a moment before the report replaces it.
    await expect(page.getByRole("status")).toHaveText("7 / 7 concluídas");
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    await expect(page).toHaveTitle("56 · exemplo.com.br | lsdias.dev, diagnóstico de site");
    const summary = page.getByRole("complementary", { name: "Nota geral" });
    await expect(summary.getByText("56", { exact: true })).toBeVisible();
    await expect(summary.getByText("2 críticos")).toBeVisible();
    await expect(summary.getByText("Carrega em 2,4s no celular")).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Atenção" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "O site não é servido em HTTPS." })).toBeVisible();

    // Suggestions never cost points, so they wait behind one toggle.
    const optional = page.getByRole("region", { name: "Melhorias opcionais" });
    await expect(optional.getByRole("heading", { level: 3 })).toBeHidden();
    await optional.getByText("Ver a melhoria opcional").click();
    await expect(optional.getByRole("heading", { level: 3, name: /Content-Security-Policy/ })).toBeVisible();
  });

  test("starts with what to fix first, each item leading to its full finding", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    const top = page.getByRole("region", { name: "Corrija primeiro" });
    const items = top.getByRole("listitem");
    // Critical first (HTTPS zeroes security, then the alt text), then the
    // attention finding costing the most points; never the suggestion.
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("O site não é servido em HTTPS.");
    await expect(items.nth(0)).toContainText("Alto impacto");
    await expect(items.nth(1)).toContainText("3 de 4 imagens");
    await expect(items.nth(2)).toContainText("Falta a meta description.");
    await expect(items.nth(2)).toContainText("Médio impacto");

    await items.nth(2).getByRole("button", { name: /Ver detalhes/ }).click();
    const finding = page.locator("#finding-no-description");
    await expect(finding).toBeFocused();
    await expect(finding).toBeInViewport();
  });

  test("explains each category's score from the measurements it was averaged from", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    const summary = page.getByRole("complementary", { name: "Nota geral" });

    const seo = summary.getByRole("listitem").filter({ hasText: "SEO" });
    await seo.getByText("Entenda esta nota").click();
    await expect(seo.getByText("Média de 4 medições: cada uma vale 1/4 da nota.")).toBeVisible();
    // From 100, what each measurement took off, most first: 100 − 25 − 6 − 3 − 0 = 66.
    const lines = seo.locator("dl > div");
    await expect(lines).toHaveText([/Partindo de\s*100/, /Meta description ausente\s*−25/, /Links da home funcionando: 75%\s*−6/, /Avaliação de SEO do Google: 89\s*−3/, /Título da página presente\s*0/, /Nota\s*66/]);

    // A score straight from one source says so instead of a made-up subtraction.
    const security = summary.getByRole("listitem").filter({ hasText: "Segurança" });
    await security.getByText("Entenda esta nota").click();
    await expect(security.getByText("Sem HTTPS confiável, a segurança fica em 0, independente do resto.")).toBeVisible();

    // The overall score's own arithmetic.
    await summary.getByText("Como calculamos esta nota").click();
    await expect(summary.getByText("(100 + 66 + 58 + 0) ÷ 4 = 56")).toBeVisible();
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

  test("lists what's working, collapsed under the findings", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");

    const passes = page.getByRole("region", { name: "O que está certo" });
    await expect(passes.getByText("Carrega rápido no celular")).toBeHidden();
    await passes.getByText("Ver os 2 pontos que passaram").click();
    await expect(passes.getByText("Carrega rápido no celular")).toBeVisible();
  });

  test("opens what's working right away when nothing is wrong", async ({ page }) => {
    await mockAnalysis(page, CLEAN_REPORT);
    await analyze(page, "tudocerto.com.br");

    await expect(page.getByText("Não encontramos problema nenhum nas checagens que rodamos.")).toBeVisible();
    await expect(page.getByText("Conexão segura: o site abre em HTTPS")).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();

    // Going back to the report doesn't throw away what was typed.
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("Nome")).toHaveValue("Ana");
    await expect(page.getByLabel("Mensagem")).toHaveValue("Quero ajuda com o HTTPS.");
    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();

    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
    await expect(page).toHaveTitle("lsdias.dev, diagnóstico de site");
    // The plan starts over, not showing the previous run as done.
    const plan = page.getByRole("region", { name: /plano da varredura/i });
    await expect(plan.getByRole("status")).toHaveText("0 / 7 concluídas");
    await expect(plan.getByText("em espera")).toHaveCount(7);
  });

  test("puts the report in the address bar, so it can be shared, reloaded and navigated", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    const reportHeading = page.getByRole("heading", { level: 2, name: "Críticos" });
    await expect(reportHeading).toBeVisible();
    await expect(page).toHaveURL(/[?&]url=exemplo\.com\.br(&|$)/);
    await expect(page).toHaveURL(/[?&]lang=pt/);

    // A reload (or the link opened elsewhere) runs it again and lands on the report.
    await page.reload();
    await expect(reportHeading).toBeVisible();
    await expect(page.getByLabel("Endereço do site")).toHaveCount(0);

    // Back and forward move between the app's screens.
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await page.goBack();
    await expect(reportHeading).toBeVisible();
    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page).not.toHaveURL(/[?&]url=/);
    await page.goBack();
    await expect(reportHeading).toBeVisible();
    // One entry per screen, even across the reload: one more step back is home.
    await page.goBack();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]url=/);
  });

  test("opens a shared report link directly", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await page.goto("/?lang=pt&url=exemplo.com.br");

    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
  });

  test("prints a clean copy, with every section open and no buttons", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    await expect(page.getByRole("button", { name: "Imprimir ou salvar PDF" })).toBeVisible();
    const optional = page.getByText("Falta o cabeçalho Content-Security-Policy.");

    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Nova análise" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Imprimir ou salvar PDF" })).toBeHidden();
    await expect(page.getByText("Diagnóstico gerado em scan.lsdias.dev")).toBeVisible();
    await expect(page.getByText("Carrega rápido no celular")).toBeVisible();
    await expect(optional).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    await expect(page.getByText("Carrega rápido no celular")).toBeHidden();
  });

  test("offers to run a link whose report is no longer cached, instead of running it", async ({ page }) => {
    let analyses = 0;
    // Routes registered later win, so the general mock goes first.
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await page.route("**/api/analyze?**", (route) => {
      if (new URL(route.request().url()).searchParams.get("cached") === "only") {
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "not-cached" }) });
      }
      analyses++;
      return route.fallback();
    });
    await page.goto("/?lang=pt&url=exemplo.com.br");

    await expect(page.getByText("O relatório desse link não está mais guardado.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
    expect(analyses).toBe(0);

    await page.getByRole("button", { name: /Rodar diagnóstico/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    expect(analyses).toBe(1);
  });

  test("never scrolls sideways", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    await page.getByText("Ver a melhoria opcional").click();
    for (const toggle of await page.getByText("Como resolver", { exact: true }).all()) await toggle.click();
    for (const toggle of await page.getByText("Entenda esta nota", { exact: true }).all()) await toggle.click();

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
