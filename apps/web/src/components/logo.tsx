import type { SVGAttributes } from "react";

import { cn } from "@/lib/utils";

interface LogoMarkProps extends SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * The double-chevron mark reads as "newly added, trending up" — the core
 * concept of the app — and is deliberately simple so it stays legible down
 * to favicon size.
 */
export function LogoMark({ size = 28, className, ...props }: LogoMarkProps) {
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
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0d9488" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
      <path
        d="M10 14 L16 8 L22 14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M8 21 L16 13 L24 21"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      <span className={cn("text-base font-semibold tracking-tight", textClassName)}>
        LatestArr
      </span>
    </span>
  );
}
