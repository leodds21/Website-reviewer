import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The app's fonts, as static TTF: the image renderer reads neither WOFF2
// nor variable fonts. Licenses (OFL) sit next to the files.
const FONTS = [
  { name: "Space Grotesk", file: "SpaceGrotesk-SemiBold.ttf", weight: 600 },
  { name: "Manrope", file: "Manrope-Medium.ttf", weight: 500 },
  { name: "JetBrains Mono", file: "JetBrainsMono-Medium.ttf", weight: 500 },
] as const;

export const OG_FONT = { heading: "Space Grotesk", body: "Manrope", mono: "JetBrains Mono" } as const;

let loaded: ReturnType<typeof load> | null = null;

function load() {
  return Promise.all(
    FONTS.map(async ({ name, file, weight }) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "app/_shared/fonts", file)),
    })),
  );
}

// Read once per server instance; a failed read is retried on the next image.
export function ogFonts() {
  loaded ??= load().catch((error: unknown) => {
    loaded = null;
    throw error;
  });
  return loaded;
}
