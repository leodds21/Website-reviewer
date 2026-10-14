// The LD symbol (app/components/LogoMark.tsx) for the preview images, which
// can't run client components. One per image, so a fixed gradient id is safe.
export function OgMark({ height }: { height: number }) {
  return (
    <svg viewBox="16 2 210 193" height={height} width={Math.round((height * 210) / 193)} style={{ marginRight: height * 0.42 }}>
      <defs>
        <linearGradient id="ld" x1="60" y1="30" x2="180" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6BCFFA" />
          <stop offset=".46" stopColor="#2E8BFF" />
          <stop offset="1" stopColor="#0B4FF5" />
        </linearGradient>
      </defs>
      <g fill="url(#ld)">
        <path d="M18 4H41V132H124L111 155H18Z" />
        <path d="M77 25H140A84 84 0 0 1 140 193H109L122 171H140A62 62 0 0 0 140 47H77Z" />
      </g>
    </svg>
  );
}
