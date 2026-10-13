import { OG_SIZE } from "../../../_shared/homeOgImage";
import { reportOgImage } from "../../../_shared/reportOgImage";

export const alt = "Relatório do lsdias.dev scanner";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  return reportOgImage("pt-BR", (await params).id);
}
