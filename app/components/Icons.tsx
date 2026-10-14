// The two icons the app uses, drawn like lucide's (24px grid, round caps)
// without the dependency.
type IconProps = { size: number; strokeWidth: number; className?: string };

function Icon({ size, strokeWidth, className, d }: IconProps & { d: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => <Icon {...props} d="M20 6 9 17l-5-5" />;
export const SpinnerIcon = (props: IconProps) => <Icon {...props} d="M21 12a9 9 0 1 1-6.219-8.56" />;
