import { OG_SIZE } from "../../../_shared/homeOgImage";
import { reportOgImage } from "../../../_shared/reportOgImage";

export const alt = "lsdias.dev scanner report";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  return reportOgImage("en", (await params).id);
}
