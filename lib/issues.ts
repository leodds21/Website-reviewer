import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/meta-tags";
import type { AltImagesCheckResult } from "./checks/alt-images";
import type { SitemapRobotsCheckResult } from "./checks/sitemap-robots";

export type IssueCategory = "performance" | "seo" | "accessibility" | "security";
export type IssueSeverity = "critico" | "atencao";

export type Issue = {
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
};

/**
 * Turns the raw check/PageSpeed results into human-readable findings for
 * the "o que encontramos" list. Kept separate from the checks themselves
 * so each check module stays a pure data source — this is the only place
 * that turns data into copy, and severity thresholds live here instead of
 * scattered across every check.
 */
export function deriveIssues(input: {
  pagespeed: PageSpeedResult;
  https: HttpsCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
}): Issue[] {
  const issues: Issue[] = [];

  if (!input.https.passed) {
    issues.push({
      category: "security",
      severity: "critico",
      title: "O site não é servido em HTTPS.",
      description: "Navegadores marcam a conexão como não segura, e isso afasta visitante e cliente.",
    });
  }

  if (!input.metaTags.hasTitle) {
    issues.push({
      category: "seo",
      severity: "critico",
      title: "A página não tem título.",
      description: "O Google não sabe do que o site trata.",
    });
  } else if (input.metaTags.title === "Home" || input.metaTags.title === "Início") {
    issues.push({
      category: "seo",
      severity: "critico",
      title: `O título da home é só "${input.metaTags.title}".`,
      description: "O Google não sabe do que o site trata.",
    });
  }

  if (!input.metaTags.hasDescription) {
    issues.push({
      category: "seo",
      severity: "atencao",
      title: "Falta a meta description.",
      description: "É o texto que aparece embaixo do link nos resultados de busca.",
    });
  }

  if (!input.metaTags.hasViewport) {
    issues.push({
      category: "accessibility",
      severity: "critico",
      title: "Falta a meta tag de viewport.",
      description: "Em celular, a página pode aparecer minúscula ou exigir zoom pra ler.",
    });
  }

  if (input.altImages.missingAltCount > 0) {
    const ratio = input.altImages.missingAltCount / input.altImages.sampledCount;
    issues.push({
      category: "accessibility",
      severity: ratio > 0.5 ? "critico" : "atencao",
      title: `${input.altImages.missingAltCount} de ${input.altImages.sampledCount} imagens sem texto alternativo.`,
      description: "Quem usa leitor de tela não sabe o que essas imagens mostram.",
    });
  }

  if (!input.sitemapRobots.hasSitemap) {
    issues.push({
      category: "seo",
      severity: "atencao",
      title: "Não encontramos um sitemap.xml.",
      description: "Ajuda o Google a achar todas as páginas do site, principalmente as mais novas.",
    });
  }

  if (input.pagespeed.scores.performance < 80) {
    issues.push({
      category: "performance",
      severity: input.pagespeed.scores.performance < 50 ? "critico" : "atencao",
      title: `Performance em ${input.pagespeed.scores.performance}/100 no Lighthouse.`,
      description: "Tempo de sobra pra alguém desistir de esperar a página carregar.",
    });
  }

  return issues;
}
