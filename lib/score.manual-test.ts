import { aggregateScore } from "./score";

function assert(condition: boolean, message: string) {
  console.log(condition ? "OK  " : "FAIL", message);
}

const strongSite = aggregateScore({
  pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
  https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
  metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
  altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
  sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
});
console.log("site forte →", strongSite);
assert(strongSite.security.score === 96, "https ok + best-practices 92 → security = média(100,92) = 96");
assert(strongSite.overallSeverity === "ok", "site forte cai em severidade ok");

const noHttps = aggregateScore({
  pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
  https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
  metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
  altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
  sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
});
console.log("sem https →", noHttps);
assert(noHttps.security.score === 0, "sem https, security cai a zero mesmo com o resto bom");
assert(noHttps.security.severity === "critico", "security zero é sempre crítico");

const weakSeo = aggregateScore({
  pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 40 } },
  https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
  metaTags: { hasViewport: true, hasTitle: false, title: null, hasDescription: false, description: null },
  altImages: { sampledCount: 10, missingAltCount: 3, missingAltSrcs: ["a.png", "b.png", "c.png"] },
  sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
});
console.log("seo fraco →", weakSeo);
assert(weakSeo.seo.score === 10, "seo: média(40,0,0,0) = 10");
assert(weakSeo.seo.severity === "critico", "seo 10 é crítico");
assert(weakSeo.accessibility.score === Math.round((95 + 100 + 70) / 3), "acessibilidade combina lighthouse + viewport + amostra de alt");
