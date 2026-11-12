import type { ReactNode } from "react";

import { LogoMark } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { usePageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";

/**
 * A postmark: two rings with today's date, and wavy cancellation lines. It
 * sits over the corner of the stamp, the way a real one cancels it. Drawn
 * in the current text colour; decoration only.
 */
function Postmark({ className }: { className?: string }) {
  const today = new Date();
  const day = today.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  return (
    <svg
      viewBox="0 0 150 70"
      width="118"
      height="55"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="34" cy="35" r="27" />
      <circle cx="34" cy="35" r="20" strokeWidth="1" />
      <g fill="currentColor" stroke="none" textAnchor="middle" fontWeight="700" letterSpacing="1">
        <text x="34" y="33" fontSize="7.5">
          {day}
        </text>
        <text x="34" y="43" fontSize="6.5">
          {today.getFullYear()}
        </text>
      </g>
      {[20, 30, 40, 50].map((y) => (
        <path key={y} d={`M66 ${y}q7 -6 14 0t14 0t14 0t14 0t14 0t14 0`} />
      ))}
    </svg>
  );
}

interface AuthCardProps {
  /** The page's heading, and the browser tab's name. */
  title: string;
  /** Keeps the heading for screen readers only, where the description says it all. */
  titleHidden?: boolean;
  description: ReactNode;
  /** Presses the stamp onto the page once as it opens (sign-in and setup). */
  animate?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * The card every signed-out screen shares (sign-in, setup, and the password
 * pages): the airmail stripe along its top, the stamp at a slight tilt with
 * a postmark beside it, the wordmark, then the page's heading and form
 * (#332). It's the page's `main`, and its heading is the `h1`.
 */
export function AuthCard({ title, titleHidden, description, animate, contentClassName, children }: AuthCardProps) {
  usePageTitle(title);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="airmail-stripe" aria-hidden="true" />
        <CardHeader className="items-center text-center">
          <div className="flex flex-col items-center gap-3 pb-1 pt-2">
            <span className="relative inline-flex">
              <LogoMark size={64} className={cn("stamp-tilt", animate && "stamp-press")} />
              <Postmark className={cn("absolute left-[46px] top-1.5 text-muted-foreground/70", animate && "postmark-in")} />
            </span>
            <span className="font-brand text-3xl tracking-tight text-foreground">
              <span className="font-bold">Latest</span>
              <span className="font-normal">Arr</span>
            </span>
          </div>
          <h1 className={titleHidden ? "sr-only" : "text-lg font-semibold leading-none tracking-tight"}>{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </main>
  );
}
