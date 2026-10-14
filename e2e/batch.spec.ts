import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { CLEAN_REPORT, REPORT_WITH_FINDINGS, withId } from "./fixtures";

const TOKEN = "e2e-batch-token";

// The real route checks the token on the server; this stands in for it.
async function mockBatchAnalysis(page: Page): Promise<string[]> {
  const authorizations: string[] = [];
  await page.route("**/api/analyze?**", (route) => {
    const authorization = route.request().headers()["authorization"] ?? "";
    authorizations.push(authorization);
    if (authorization !== `Bearer ${TOKEN}`) {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "unauthorized" }) });
    }
    const target = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (target.includes("fora-do-ar")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: `event: failed\ndata: ${JSON.stringify({ code: "site-unreachable" })}\n\n` });
    }
    const report = withId(target.includes("tudocerto") ? CLEAN_REPORT : REPORT_WITH_FINDINGS);
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: `event: done\ndata: ${JSON.stringify(report)}\n\n` });
  });
  return authorizations;
}

async function runBatch(page: Page, urls: string[], token = TOKEN): Promise<void> {
  await page.goto("/pt-BR/batch");
  await page.getByLabel("Endereços").fill(urls.join("\n"));
  await page.getByLabel("Código de acesso").fill(token);
  await page.getByRole("button", { name: "Analisar a lista" }).click();
}

test.describe("batch analysis", () => {
  test("isn't indexed", async ({ page }) => {
    await page.goto("/pt-BR/batch");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("fills the table, row by row, and exports it as CSV", async ({ page }) => {
    const authorizations = await mockBatchAnalysis(page);
    await runBatch(page, ["exemplo.com.br", "tudocerto.com.br", "fora-do-ar.com.br", "exemplo.com.br"]);

    await expect(page.getByRole("status")).toHaveText("3 de 3 prontos");
    const rows = page.getByRole("row");
    await expect(rows.filter({ hasText: "exemplo.com.br" })).toContainText("pronto");
    await expect(rows.filter({ hasText: "exemplo.com.br" })).toContainText("O site não é servido em HTTPS.");
    await expect(rows.filter({ hasText: "tudocerto.com.br" })).toContainText("97");
    await expect(rows.filter({ hasText: "fora-do-ar.com.br" })).toContainText("falhou: Não conseguimos chegar até esse site.");
    await expect(rows.filter({ hasText: "exemplo.com.br" }).getByRole("link", { name: /abrir/ })).toHaveAttribute("href", /^\/pt-BR\/report\//);
    expect(authorizations.every((value) => value === `Bearer ${TOKEN}`)).toBe(true);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar CSV" }).click();
    const csv = await readFile((await (await download).path())!, "utf8");
    const [header, first] = csv.replace(/^﻿/, "").split("\r\n");
    expect(header).toBe("Site;Estado;Geral;Performance;SEO;Acessibilidade;Segurança;Críticos;Principal problema;Relatório");
    expect(first).toMatch(/^exemplo\.com\.br;pronto;56;100;66;58;0;2;O site não é servido em HTTPS\.;http:\/\/localhost:\d+\/pt-BR\/report\/\w+$/);
  });

  test("stops at a wrong access code and says so once", async ({ page }) => {
    await mockBatchAnalysis(page);
    await runBatch(page, ["a.com.br", "b.com.br", "c.com.br"], "errado");

    // Next keeps an empty route announcer with the same role.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("O código de acesso não confere.");
    await expect(page.getByRole("button", { name: "Analisar a lista" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "c.com.br" })).toContainText("não rodou");
  });

  test("remembers the access code in the tab", async ({ page }) => {
    await mockBatchAnalysis(page);
    await runBatch(page, ["tudocerto.com.br"]);
    await expect(page.getByRole("status")).toHaveText("1 de 1 prontos");

    await page.reload();
    await expect(page.getByLabel("Código de acesso")).toHaveValue(TOKEN);
  });
});
