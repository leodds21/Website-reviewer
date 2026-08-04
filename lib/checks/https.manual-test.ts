import { checkHttps } from "./https";

const urls = ["google.com", "http://neverssl.com", "http://example.com"];

async function main() {
  for (const url of urls) {
    try {
      const result = await checkHttps(url);
      console.log(url, "→", result);
    } catch (error) {
      console.log(url, "→ erro:", (error as Error).message);
    }
  }
}

main();
