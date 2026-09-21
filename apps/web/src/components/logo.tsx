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
