import type { SVGAttributes } from "react";

import { cn } from "@/lib/utils";

interface LogoMarkProps extends SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * An envelope with a spark reads as "a newsletter just arrived" — the
 * literal core concept of the app — and stays legible down to favicon
 * size (the spark's point-length is deliberately generous; a subtler
 * sparkle nearly disappeared at 16px).
 */
export function LogoMark({ size = 32, className, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="LatestArr"
      {...props}
    >
      <rect width="32" height="32" rx="9" fill="#ef5d86" />
      <path
        d="M8.5 13h13v8.5h-13z"
        fill="none"
        stroke="#0e1425"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13l6.5 5 6.5-5"
        fill="none"
        stroke="#0e1425"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 3.4 L25.9 7.1 L29.6 9 L25.9 10.9 L24 14.6 L22.1 10.9 L18.4 9 L22.1 7.1 Z"
        fill="#0e1425"
      />
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
      {/* A subtle two-stop gradient (same hue, just a lighter tint of
       * itself) on the wordmark — reads as a soft sheen rather than a
       * loud rainbow effect, the same restraint as .shadow-elevated's
       * tinted-not-flashy shadow. */}
      <span
        className={cn(
          "font-brand text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent",
          textClassName,
        )}
      >
        LatestArr
      </span>
    </span>
  );
}
