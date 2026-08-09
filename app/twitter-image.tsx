// Same image, same convention as opengraph-image.tsx — Next treats
// each file as its own route regardless, so this just points Twitter's
// card at the identical generator instead of duplicating the JSX.
export { default, alt, size, contentType } from "./opengraph-image";
