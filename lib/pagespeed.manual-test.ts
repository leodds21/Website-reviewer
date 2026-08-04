import { runPageSpeed } from "./pagespeed";

const urls = ["https://example.com"];

async function main() {
  for (const url of urls) {
    try {
      const result = await runPageSpeed(url);
      console.log(url, "→", result);
    } catch (error) {
      console.log(url, "→ erro:", (error as Error).message);
    }
  }
}

main();
