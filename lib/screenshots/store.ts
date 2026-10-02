/**
 * Turns a captured image into something the report can point to.
 *
 * For now that's an inline data URL: the project has no persistent
 * storage, a filesystem write wouldn't survive between serverless
 * invocations, and two WebP viewport captures add only a few hundred KB
 * to the report (which already travels as one SSE event and sits in
 * the analysis cache). The page's CSP already allows `data:` images.
 *
 * This is the one function to change to move to Vercel Blob, S3, R2 or
 * Supabase Storage: upload the bytes, return the public URL. Nothing
 * else in the report or the UI needs to know which it is.
 */
export async function storeScreenshot(webpBase64: string): Promise<string> {
  return `data:image/webp;base64,${webpBase64}`;
}
