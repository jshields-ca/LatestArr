import audiobookshelfLogo from "@/assets/logos/audiobookshelf.svg";
import booklorelogo from "@/assets/logos/booklore.svg";
import bookorbitLogo from "@/assets/logos/bookorbit.svg";
import grimmoryLogo from "@/assets/logos/grimmory.svg";
import plexLogo from "@/assets/logos/plex.svg";
import rommLogo from "@/assets/logos/romm.svg";
import tautulliLogo from "@/assets/logos/tautulli.svg";
import { cn } from "@/lib/utils";

// Every logo below is a full-color brand mark that already paints its own
// circular/rounded backing shape edge-to-edge (see NOTICE.md next to the
// source files for where each one comes from and its license), so it stays
// legible on both a light and a dark page background without any theme-
// aware swapping — except Grimmory's, which is drawn transparent with a
// plain white accent shape that all but disappears on a light background.
// GRIMMORY_NEEDS_PLATE gives just that one a fixed dark backing plate (it
// isn't theme-reactive on purpose: it's standing in for the background the
// mark itself is missing, the same job every other logo's own artwork
// already does).
const LOGO_SRC: Record<string, string> = {
  tautulli: tautulliLogo,
  plex: plexLogo,
  booklore: booklorelogo,
  bookorbit: bookorbitLogo,
  grimmory: grimmoryLogo,
  audiobookshelf: audiobookshelfLogo,
  romm: rommLogo,
};

const GRIMMORY_NEEDS_PLATE = new Set(["grimmory"]);

export interface SourceLogoProps {
  kind: string;
  /** Accessible label for the logo, typically the kind's friendly name
   *  (e.g. "Tautulli"). When omitted the image is treated as decorative. */
  label?: string;
  className?: string;
}

/** A small brand-logo badge for a source kind, or `null` when this kind has
 *  no bundled logo yet — callers should fall back to a generic icon/badge
 *  in that case rather than rendering nothing in its place. */
export function SourceLogo({ kind, label, className }: SourceLogoProps) {
  const src = LOGO_SRC[kind];
  if (!src) return null;

  return (
    <span
      // Vite inlines these (they're all well under the default 4KB
      // assetsInlineLimit) as `data:image/svg+xml,...` URLs rather than
      // file paths, so `kind` isn't otherwise recoverable from the
      // rendered DOM — this attribute is a hook for that, not for styling.
      data-kind={kind}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full",
        GRIMMORY_NEEDS_PLATE.has(kind) && "bg-neutral-900 dark:bg-neutral-950",
        className,
      )}
    >
      <img
        src={src}
        alt={label ? `${label} logo` : ""}
        aria-hidden={label ? undefined : true}
        className="size-full"
      />
    </span>
  );
}
