import { expect, test, type Page } from "@playwright/test";
import { SCAN_STEPS } from "@/lib/scanSteps";
import {
  CLEAN_REPORT,
  IN_PROGRESS_REPORT,
  PARTIAL_REPORT,
  REPORT_WITH_FINDINGS,
  analyze,
  closeAnalysis,
  mockAnalysis,
  mockAnalysisError,
  mockLiveAnalysis,
  seedSharedReport,
  sendAnalysisEvent,
  withId,
} from "./fixtures";

test.describe("security policy", () => {
  test("runs the page on a per-request script nonce, with nothing blocked", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });

    const first = await page.goto("/pt-BR");
    // Exactly one policy: two would be enforced together.
    expect((await first!.headersArray()).filter((header) => header.name.toLowerCase() === "content-security-policy")).toHaveLength(1);
    const csp = first!.headers()["content-security-policy"];
    const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"))!;
    expect(scriptSrc).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
    expect(scriptSrc).not.toContain("unsafe-inline");

    // A fresh nonce on every view.
    const second = await page.goto("/pt-BR");
    expect(second!.headers()["content-security-policy"]).not.toBe(csp);

    // The page still hydrates and works under it.
    await page.getByLabel("Endereço do site").fill("exemplo.com.br");
    await expect(page.getByRole("button", { name: /Rodar diagnóstico/ })).toBeEnabled();
    expect(violations).toEqual([]);
  });
});

test.describe("structured data", () => {
  test("describes the home page as a web application, in each language", async ({ page }) => {
    for (const [locale, language] of [["pt-BR", "pt-BR"], ["en", "en"]] as const) {
      await page.goto(`/${locale}`);
      const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
      expect(data).toMatchObject({ "@type": "WebApplication", name: "lsdias.dev scanner", inLanguage: language });
      expect(data.url).toMatch(new RegExp(`/${locale}$`));
    }
  });
});

test.describe("home", () => {
  test("lists the seven real checks before anything runs", async ({ page }) => {
    await page.goto("/pt-BR");

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
    await expect(page.getByRole("region", { name: /plano da varredura/i }).getByRole("status")).toHaveText("7 / 7 concluídas");
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
    await linksFinding.getByText("Como resolver", { exact: true }).click();
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

  test("puts the report at its own address, so it can be shared, reloaded and navigated", async ({ page }) => {
    const report = withId(REPORT_WITH_FINDINGS);
    await seedSharedReport(report);
    await mockAnalysis(page, report);
    await analyze(page, "exemplo.com.br");
    const reportHeading = page.getByRole("heading", { level: 2, name: "Críticos" });
    await expect(reportHeading).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/pt-BR/report/${report.id}$`));

    // A reload renders the stored report on the server; nothing runs again.
    await page.reload();
    await expect(reportHeading).toBeVisible();
    await expect(page.getByLabel("Endereço do site")).toHaveCount(0);

    // Back and forward move between the app's screens.
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await page.goBack();
    await expect(reportHeading).toBeVisible();
    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page).toHaveURL(/\/pt-BR$/);
    await page.goBack();
    await expect(reportHeading).toBeVisible();
    // One entry per screen, even across the reload: one more step back is home.
    await page.goBack();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
    await expect(page).toHaveURL(/\/pt-BR$/);
  });

  test("opens a shared report link directly, in either language", async ({ page }) => {
    const report = withId(REPORT_WITH_FINDINGS);
    await seedSharedReport(report);
    let analyses = 0;
    await page.route("**/api/analyze?**", (route) => {
      analyses++;
      return route.abort();
    });

    await page.goto(`/pt-BR/report/${report.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    await expect(page).toHaveTitle("56 · exemplo.com.br | lsdias.dev, diagnóstico de site");

    await page.goto(`/en/report/${report.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Report for exemplo.com.br" })).toBeAttached();
    expect(analyses).toBe(0);
  });

  test("describes a shared report for link previews, without indexing it", async ({ page, request }) => {
    const report = withId(REPORT_WITH_FINDINGS);
    await seedSharedReport(report);
    await page.goto(`/pt-BR/report/${report.id}`);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", "exemplo.com.br tirou 56/100 em segurança, SEO, acessibilidade e performance.");
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    const response = await request.get(new URL(image!).pathname);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  test("explains an expired report and offers a new analysis", async ({ page }) => {
    await page.goto("/pt-BR/report/abcDEF1234");

    await expect(page.getByRole("heading", { name: "Este relatório expirou." })).toBeVisible();
    await page.getByRole("link", { name: "Fazer uma nova análise" }).click();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
  });

  test("prints with a cover and without the screen's toggles", async ({ page }) => {
    await mockAnalysis(page, withId(REPORT_WITH_FINDINGS));
    await analyze(page, "exemplo.com.br");
    const cover = page.locator(".report-cover");
    await expect(cover).toBeHidden();

    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    await expect(cover).toBeVisible();
    await expect(cover).toContainText("exemplo.com.br");
    await expect(cover).toContainText("56");
    await expect(cover).toContainText(/Relatório online: scan\.lsdias\.dev\/pt-BR\/report\/\w+/);
    await expect(page.getByText("Entenda esta nota").first()).toBeHidden();
    await expect(page.getByRole("button", { name: /Ver detalhes/ }).first()).toBeHidden();
    // The toggle doesn't print, so its label goes with the text.
    await expect(page.getByText("Como resolver:").first()).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    await expect(cover).toBeHidden();
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

  test("fills the field from an older ?url= link instead of running it", async ({ page }) => {
    let analyses = 0;
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await page.route("**/api/analyze?**", (route) => {
      analyses++;
      return route.fallback();
    });
    await page.goto("/pt-BR?url=exemplo.com.br");

    await expect(page.getByText("Este endereço veio de um link antigo.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
    await expect(page).toHaveURL(/\/pt-BR$/);
    expect(analyses).toBe(0);

    await page.getByRole("button", { name: /Rodar diagnóstico/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de exemplo.com.br" })).toBeAttached();
    expect(analyses).toBe(1);
  });

  test("an address typed on the portfolio comes filled with the run button focused, no note", async ({ page }) => {
    let analyses = 0;
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await page.route("**/api/analyze?**", (route) => {
      analyses++;
      return route.fallback();
    });
    await page.goto("/pt-BR?url=exemplo.com.br&from=portfolio");

    await expect(page.getByLabel("Endereço do site")).toHaveValue("exemplo.com.br");
    await expect(page.getByRole("button", { name: /Rodar diagnóstico/ })).toBeFocused();
    await expect(page.getByText("Este endereço veio de um link antigo.", { exact: false })).toHaveCount(0);
    await expect(page).toHaveURL(/\/pt-BR$/);
    expect(analyses).toBe(0);

    await page.keyboard.press("Enter");
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

  test("brings a failure into view after the run scrolled to the plan (phone)", async ({ page }) => {
    // Answered after a beat, so the phone has already scrolled down to the
    // live progress when the failure arrives.
    await page.route("**/api/analyze?**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: 'event: failed\ndata: {"code":"site-unreachable"}\n\n' });
    });
    await analyze(page, "exemplo.com.br");

    await expect(formError(page)).toHaveText(/Não conseguimos chegar até esse site/);
    await expect(formError(page)).toBeInViewport();
  });
});

test.describe("progressive report", () => {
  const OWN_STEPS = SCAN_STEPS.filter((step) => step !== "pagespeed");

  test("shows our own checks' report before Google's measurement, then completes it", async ({ page }) => {
    await mockLiveAnalysis(page);
    await analyze(page, "exemplo.com.br");
    for (const step of OWN_STEPS) await sendAnalysisEvent(page, "step", { step });
    await sendAnalysisEvent(page, "partial", IN_PROGRESS_REPORT);

    const summary = page.getByRole("complementary", { name: "Nota geral" });
    await expect(summary.getByText("Calculando a nota geral")).toBeVisible();
    await expect(summary.getByRole("listitem").filter({ hasText: "Performance" })).toContainText("Aguardando a medição do Google");
    await expect(summary.getByRole("listitem").filter({ hasText: "SEO" })).toContainText("provisório");
    await expect(page.getByText("Provisório: a medição do Google ainda pode mudar esta ordem.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Relatório parcial pronto" })).toBeAttached();

    await sendAnalysisEvent(page, "step", { step: "pagespeed" });
    await sendAnalysisEvent(page, "done", REPORT_WITH_FINDINGS);
    await closeAnalysis(page);

    await expect(summary.getByText("56", { exact: true })).toBeVisible();
    await expect(summary.getByText("Calculando a nota geral")).toHaveCount(0);
    await expect(page.getByText(/^Provisório/)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Relatório completo." })).toBeAttached();
  });

  test("keeps the partial report and says so when Google's measurement never arrives", async ({ page }) => {
    await mockLiveAnalysis(page);
    await analyze(page, "exemplo.com.br");
    await sendAnalysisEvent(page, "partial", IN_PROGRESS_REPORT);
    await closeAnalysis(page);

    await expect(page.getByText("A medição do Google não terminou.", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova análise" })).toBeVisible();
  });
});

test.describe("languages", () => {
  test("sends the root address to the visitor's language", async ({ browser }) => {
    for (const [locale, path] of [["pt-BR", "/pt-BR"], ["en-US", "/en"]] as const) {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await context.close();
    }
  });

  test("keeps older ?lang= links working", async ({ page }) => {
    await page.goto("/?lang=pt&url=exemplo.com.br");
    await expect(page).toHaveURL(/\/pt-BR(\?url=exemplo\.com\.br)?$/);
  });

  test("switches language through the other locale's address, and remembers it", async ({ page }) => {
    await page.goto("/pt-BR");
    await page.getByRole("link", { name: /EN/ }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByLabel("Site address")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("describes each language version for search engines", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute("href", /\/pt-BR$/);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
  });

  test("shows a page of its own for an address that doesn't exist", async ({ page }) => {
    const response = await page.goto("/pt-BR/nada-aqui");
    expect(response!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Esta página não existe." })).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("moves between every screen without the transitions", async ({ page }) => {
    await mockAnalysis(page, REPORT_WITH_FINDINGS);
    await analyze(page, "exemplo.com.br");
    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();

    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await page.getByLabel("Nome").fill("Ana");
    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("Nome")).toHaveValue("Ana");

    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();
    await page.getByRole("button", { name: "Nova análise" }).click();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
  });
});

test.describe("review fixes", () => {
  test.describe("in another time zone than the server", () => {
    test.use({ timezoneId: "Asia/Tokyo" });

    test("hydrates a shared report without throwing the server's HTML away", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      const report = withId(REPORT_WITH_FINDINGS);
      await seedSharedReport(report);

      await page.goto(`/pt-BR/report/${report.id}`);
      // The footer's copy; the opening and the print cover show it too.
      await expect(page.locator("footer").getByText(/05\/10\/2026, 21:00/)).toBeVisible();

      // Production React reports a mismatch as minified errors #418/#423/#425.
      expect(errors.filter((text) => /hydrat|react\.dev\/errors\/4(18|23|25)/i.test(text))).toEqual([]);
    });
  });

  test("never shows a newer report for an older analysis's history entry", async ({ page }) => {
    const newer = withId({ ...CLEAN_REPORT });
    await seedSharedReport(newer);
    await mockLiveAnalysis(page);
    await analyze(page, "exemplo.com.br");
    await sendAnalysisEvent(page, "partial", IN_PROGRESS_REPORT);
    await expect(page.getByRole("complementary", { name: "Nota geral" }).getByText("Calculando a nota geral")).toBeVisible();

    // A new analysis before the first one finished, which then completes.
    await page.getByRole("button", { name: "Nova análise" }).click();
    await page.getByLabel("Endereço do site").fill("tudocerto.com.br");
    await page.getByRole("button", { name: /Rodar diagnóstico/ }).click();
    await sendAnalysisEvent(page, "done", newer);
    await expect(page).toHaveURL(new RegExp(`/pt-BR/report/${newer.id}$`));

    await page.goBack();
    await page.goBack();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de tudocerto.com.br" })).toHaveCount(0);
  });

  test("comes back to the report when the next step is reloaded", async ({ page }) => {
    const report = withId(REPORT_WITH_FINDINGS);
    await seedSharedReport(report);
    await mockAnalysis(page, report);
    await analyze(page, "exemplo.com.br");
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await expect(page.getByLabel("E-mail")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();
    await page.getByRole("button", { name: "Ver como corrigir →" }).first().click();
    await page.getByRole("button", { name: /Voltar ao relatório/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Críticos" })).toBeVisible();
  });

  test("drops the older-link note once the address is edited", async ({ page }) => {
    await page.goto("/pt-BR?url=exemplo.com.br");
    const note = page.getByText("Este endereço veio de um link antigo.", { exact: false });
    await expect(note).toBeVisible();

    await page.getByLabel("Endereço do site").fill("outro.com.br");
    await expect(note).toHaveCount(0);
  });

  test("stops saying Google is measuring once its measurement failed", async ({ page }) => {
    await mockLiveAnalysis(page);
    await analyze(page, "exemplo.com.br");
    await sendAnalysisEvent(page, "partial", IN_PROGRESS_REPORT);
    await closeAnalysis(page);

    const summary = page.getByRole("complementary", { name: "Nota geral" });
    await expect(summary.getByText("Não deu para calcular a nota geral")).toBeVisible();
    await expect(summary.getByRole("listitem").filter({ hasText: "Performance" })).toContainText("A medição do Google não terminou");
    await expect(summary.getByText("Calculando a nota geral")).toHaveCount(0);
    await expect(page.getByText(/^Provisório/)).toHaveCount(0);
  });
});
