import { useId, type SVGAttributes } from "react";

import {
  LOGO_COLOURS,
  LOGO_FACE,
  LOGO_HOLE_R,
  LOGO_HOLES,
  LOGO_L_PATH,
  LOGO_SHADOW_DROP,
} from "@/components/logo-geometry";
import { cn } from "@/lib/utils";

interface LogoMarkProps extends SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * The LatestArr mark: a postage stamp with an L, lifted off a rose tile.
 * "Delivered to your inbox" without the stock envelope. The geometry comes
 * from docs/assets/brand/generate.mjs (via logo-geometry.ts), the same
 * source as the favicon and brand files. IDs are per instance because the
 * header can render the mark twice.
 */
export function LogoMark({ size = 32, className, ...props }: LogoMarkProps) {
  const id = useId().replace(/:/g, "");
  const { x, y, size: face } = LOGO_FACE;
  const holes = LOGO_HOLES.map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={LOGO_HOLE_R} />);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="LatestArr"
      {...props}
    >
      <defs>
        <mask id={`${id}-stamp`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect x={x} y={y} width={face} height={face} fill="#fff" />
          <g fill="#000">{holes}</g>
        </mask>
        <clipPath id={`${id}-below`}>
          <rect x="0" y={y + face - 1} width="64" height={64 - y - face + 1} />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="18" fill={LOGO_COLOURS.tile} />
      <g clipPath={`url(#${id}-below)`}>
        <rect
          width="64"
          height="64"
          fill={LOGO_COLOURS.shadow}
          mask={`url(#${id}-stamp)`}
          transform={`translate(0 ${LOGO_SHADOW_DROP})`}
        />
      </g>
      <rect width="64" height="64" fill={LOGO_COLOURS.paper} mask={`url(#${id}-stamp)`} />
      <path d={LOGO_L_PATH} fill={LOGO_COLOURS.ink} />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

export function Logo({ className, iconClassName, textClassName }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={iconClassName} />
      {/* Plain foreground text, not a rose gradient — production feedback
       * was that the gradient/clip-text treatment read as too "loud" next
       * to the mark itself, and that the wordmark should match how the
       * rest of the header's text behaves (`text-foreground`: white in
       * dark mode). Split into two spans so "Latest" (bold) and "Arr"
       * (regular weight) read as a deliberate two-part wordmark rather
       * than one uniformly-bold word — and sized up from `text-xl` since
       * a plain-color wordmark needs the extra size to hold its own next
       * to the mark the way the gradient used to. `textClassName` (used
       * by the login/setup pages for a smaller variant) still overrides
       * this size via `cn`/tailwind-merge; the two inner spans inherit
       * whatever size ends up on this wrapper. */}
      <span className={cn("font-brand text-2xl tracking-tight text-foreground", textClassName)}>
        <span className="font-bold">Latest</span>
        <span className="font-normal">Arr</span>
      </span>
    </span>
  );
}
