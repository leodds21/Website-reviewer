import { deriveIssues } from "./issues";

function assert(condition: boolean, message: string) {
  console.log(condition ? "OK  " : "FAIL", message);
}

const cleanSite = deriveIssues({
  pagespeed: { scores: { performance: 95, accessibility: 95, "best-practices": 92, seo: 90 } },
  https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
  metaTags: { hasViewport: true, hasTitle: true, title: "Papelaria Central", hasDescription: true, description: "Y" },
  altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
  sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
});
console.log("site limpo →", cleanSite);
assert(cleanSite.length === 0, "site sem problema nenhum não gera issue");

const messySite = deriveIssues({
  pagespeed: { scores: { performance: 41, accessibility: 67, "best-practices": 80, seo: 58 } },
  https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
  metaTags: { hasViewport: false, hasTitle: true, title: "Home", hasDescription: false, description: null },
  altImages: { sampledCount: 12, missingAltCount: 8, missingAltSrcs: [] },
  sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
});
console.log("site bagunçado →", messySite);
assert(messySite.some((i) => i.code === "no-https" && i.severity === "critico"), "sem https gera issue crítica de segurança");
assert(messySite.some((i) => i.code === "generic-title" && i.params?.title === "Home"), "título genérico 'Home' é detectado especificamente, com o título nos params");
assert(messySite.filter((i) => i.severity === "critico").length >= 3, "site ruim acumula vários críticos (https, título, alt-images maioria ausente)");
assert(
  messySite.some((i) => i.code === "missing-alt" && i.params?.missing === 8 && i.params?.sampled === 12),
  "contagem de alt-images ausentes vai nos params, não numa frase pronta",
);
