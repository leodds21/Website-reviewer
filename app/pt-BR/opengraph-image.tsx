import { OG_SIZE, homeOgAlt, homeOgImage } from "../_shared/homeOgImage";

export const alt = homeOgAlt("pt-BR");
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return homeOgImage("pt-BR");
}
