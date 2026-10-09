// `||`, not `??`: a copied .env.example leaves it empty, and new URL("") throws.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://scan.lsdias.dev";
