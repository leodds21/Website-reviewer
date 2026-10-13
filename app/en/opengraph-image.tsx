import { OG_SIZE, homeOgAlt, homeOgImage } from "../_shared/homeOgImage";

export const alt = homeOgAlt("en");
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return homeOgImage("en");
}
