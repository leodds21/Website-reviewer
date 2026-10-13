// Fails when a page's initial JavaScript grows past its budget, or when a
// language starts shipping the other one's dictionary. Run after `next build`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// gzip KB. Set from measured sizes plus about 5% headroom: room for small
// changes, not for a new dependency or a whole screen landing in the first load.
const BUDGETS = {
  "pt-BR": 157,
  en: 157,
  "pt-BR/report/[id]": 166,
  "en/report/[id]": 166,
};

// A string only each dictionary has, to catch both languages in one bundle.
const DICTIONARY_MARKER = { "pt-BR": "Calculando a nota geral", en: "Calculating the overall score" };

const NEXT = ".next";
const read = (path) => readFileSync(join(NEXT, path));
const rootFiles = JSON.parse(read("build-manifest.json")).rootMainFiles.map((file) => file.replace(/^\/?_next\//, ""));

function initialFiles(route) {
  const manifest = read(join("server/app", route, "page_client-reference-manifest.js")).toString();
  // entryJSFiles: the chunks the route's layouts and page load up front.
  const entries = [...manifest.matchAll(/"entryJSFiles":(\{.*?\})\s*[,}]/g)].map((match) => JSON.parse(match[1]));
  if (entries.length === 0) throw new Error(`No entryJSFiles in ${route}'s manifest; the Next build format may have changed.`);
  return new Set([...rootFiles, ...entries.flatMap((entry) => Object.values(entry).flat())]);
}

let failed = false;
for (const [route, budget] of Object.entries(BUDGETS)) {
  const contents = [...initialFiles(route)].map((file) => read(file));
  const kb = contents.reduce((sum, content) => sum + gzipSync(content).length, 0) / 1024;
  const text = contents.join("\n");
  const locale = route.split("/")[0];
  const foreign = Object.entries(DICTIONARY_MARKER).filter(([other, marker]) => other !== locale && text.includes(marker));

  const over = kb > budget;
  console.log(`${over ? "✗" : "✓"} /${route}: ${kb.toFixed(1)} KB gzip (budget ${budget} KB)`);
  if (foreign.length) console.log(`✗ /${route} ships the ${foreign.map(([other]) => other).join(", ")} dictionary`);
  failed ||= over || foreign.length > 0;
}

process.exitCode = failed ? 1 : 0;
