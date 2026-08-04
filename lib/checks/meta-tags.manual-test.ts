import { checkMetaTags } from "./meta-tags";

const urls = ["https://example.com", "https://neverssl.com", "https://wikipedia.org"];

async function main() {
  for (const url of urls) {
    try {
      const result = await checkMetaTags(url);
      console.log(url, "→", result);
    } catch (error) {
      console.log(url, "→ erro:", (error as Error).message);
    }
  }
}

main();
