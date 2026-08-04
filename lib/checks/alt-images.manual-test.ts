import { checkAltImages } from "./alt-images";

const urls = ["https://wikipedia.org", "https://example.com", "https://news.ycombinator.com"];

async function main() {
  for (const url of urls) {
    try {
      const result = await checkAltImages(url);
      console.log(url, "→", result);
    } catch (error) {
      console.log(url, "→ erro:", (error as Error).message);
    }
  }
}

main();
